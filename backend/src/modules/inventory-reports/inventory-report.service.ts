import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { AppError } from '../../errors/app-error.ts';
import {
    brands,
    items,
    uoms,
    lots,
    locations,
    inventoryStock,
    inventoryTransactions,
    purchaseOrderLines,
    purchaseOrders,
    packingOrders,
    stockTransferLines,
    stockTransfers,
    deliveryOrderLines,
    deliveryOrders,
    salesOrders,
    users,
    scrapReasonCodes,
    reorderPolicies,
    reviewRequests,
} from '../../db/schema.ts';
import { getSettings } from '../company-settings/company-setting.service.ts';
import { buildInventoryReport } from './inventory-report.rules.ts';
import type { InventoryReportQuery } from './inventory-report.schema.ts';

const catalogFields = {
    itemId: items.itemId,
    sku: items.sku,
    itemName: items.name,
    itemType: items.itemType,
    brandId: items.brandId,
    brandName: brands.name,
    primaryUomId: uoms.uomId,
    primaryUomName: uoms.name,
    isActive: items.isActive,
};
export async function getInventoryReport(
    query: InventoryReportQuery,
    database: typeof db = db,
    now = new Date(),
) {
    return database.transaction(
        async (tx) => {
            const settings = await getSettings(tx);
            if (query.useReorderPolicies)
                query = { ...query, threshold: settings.defaultReorderLevel };
            if (query.useCompanyExpiryDays)
                query = { ...query, expiryDays: settings.expiryWarningDays };
            const levels = new Map<number, string>(
                query.useReorderPolicies
                    ? (await tx.select().from(reorderPolicies)).map((r) => [
                          r.itemId,
                          r.reorderLevel,
                      ])
                    : [],
            );
            const catalog = await tx
                .select(catalogFields)
                .from(items)
                .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
                .leftJoin(brands, eq(items.brandId, brands.brandId));
            if (query.itemId && !catalog.some((row) => row.itemId === query.itemId))
                throw new AppError(400, 'Select an existing report item.');
            if (
                query.locationId &&
                !(
                    await tx
                        .select({ id: locations.locationId })
                        .from(locations)
                        .where(eq(locations.locationId, query.locationId))
                        .limit(1)
                )[0]
            )
                throw new AppError(400, 'Select an existing report location.');
            if (
                query.brandId &&
                !(
                    await tx
                        .select({ id: brands.brandId })
                        .from(brands)
                        .where(eq(brands.brandId, query.brandId))
                        .limit(1)
                )[0]
            )
                throw new AppError(400, 'Select an existing report brand.');
            if (query.report === 'movement') {
                const conditions = [];
                if (query.fromDate)
                    conditions.push(
                        gte(
                            inventoryTransactions.createdAt,
                            new Date(query.fromDate + 'T00:00:00Z'),
                        ),
                    );
                if (query.toDate) {
                    const end = new Date(query.toDate + 'T00:00:00Z');
                    end.setUTCDate(end.getUTCDate() + 1);
                    conditions.push(lt(inventoryTransactions.createdAt, end));
                }
                const rows = await tx
                    .select({
                        ...catalogFields,
                        transactionId: inventoryTransactions.transactionId,
                        transactionType: inventoryTransactions.transactionType,
                        qtyChange: inventoryTransactions.qtyChange,
                        occurredAt: inventoryTransactions.createdAt,
                        lotId: lots.lotId,
                        lotNumber: lots.lotNumber,
                        locationId: locations.locationId,
                        locationCode: locations.code,
                        locationName: locations.name,
                        locationType: locations.locationType,
                        referenceId: inventoryTransactions.referenceId,
                        actorName: sql<string>`concat_ws(' ',${users.firstName},${users.lastName})`,
                        reasonCode: scrapReasonCodes.codeName,
                        sourceReference: sql<
                            string | null
                        >`coalesce(nullif(concat_ws(' / ',${deliveryOrders.deliveryOrderNumber},${salesOrders.salesOrderNumber}), ''), ${stockTransfers.transferNumber},${packingOrders.packingOrderNumber},${purchaseOrders.poNumber},${reviewRequests.requestNumber},${inventoryTransactions.referenceId})`,
                    })
                    .from(inventoryTransactions)
                    .leftJoin(
                        reviewRequests,
                        eq(reviewRequests.requestId, inventoryTransactions.reviewRequestId),
                    )
                    .innerJoin(items, eq(items.itemId, inventoryTransactions.itemId))
                    .innerJoin(uoms, eq(uoms.uomId, items.primaryUomId))
                    .leftJoin(brands, eq(brands.brandId, items.brandId))
                    .innerJoin(lots, eq(lots.lotId, inventoryTransactions.lotId))
                    .innerJoin(
                        locations,
                        eq(locations.locationId, inventoryTransactions.locationId),
                    )
                    .innerJoin(users, eq(users.userId, inventoryTransactions.authorizedByUserId))
                    .leftJoin(
                        scrapReasonCodes,
                        eq(scrapReasonCodes.reasonId, inventoryTransactions.reasonId),
                    )
                    .leftJoin(
                        purchaseOrderLines,
                        eq(purchaseOrderLines.poLineId, inventoryTransactions.poLineId),
                    )
                    .leftJoin(purchaseOrders, eq(purchaseOrders.poId, purchaseOrderLines.poId))
                    .leftJoin(
                        packingOrders,
                        eq(packingOrders.packingOrderId, inventoryTransactions.packingOrderId),
                    )
                    .leftJoin(
                        stockTransferLines,
                        eq(stockTransferLines.transferLineId, inventoryTransactions.transferLineId),
                    )
                    .leftJoin(
                        stockTransfers,
                        eq(stockTransfers.transferId, stockTransferLines.transferId),
                    )
                    .leftJoin(
                        deliveryOrderLines,
                        eq(
                            deliveryOrderLines.deliveryOrderLineId,
                            inventoryTransactions.deliveryOrderLineId,
                        ),
                    )
                    .leftJoin(
                        deliveryOrders,
                        eq(deliveryOrders.deliveryOrderId, deliveryOrderLines.deliveryOrderId),
                    )
                    .leftJoin(
                        salesOrders,
                        eq(salesOrders.salesOrderId, deliveryOrders.salesOrderId),
                    )
                    .where(and(...conditions))
                    .orderBy(
                        desc(inventoryTransactions.createdAt),
                        desc(inventoryTransactions.transactionId),
                    );
                return buildInventoryReport(query, catalog, [], rows, now);
            }
            const reserved = sql`coalesce((select sum(r.qty_reserved-r.qty_consumed) from inventory_reservations r where r.item_id=inventory_stock.item_id and r.lot_id=inventory_stock.lot_id and r.location_id=inventory_stock.location_id and r.released_at is null),0)`;
            const stock = await tx
                .select({
                    ...catalogFields,
                    stockId: inventoryStock.stockId,
                    locationIsActive: locations.isActive,
                    lotId: lots.lotId,
                    lotNumber: lots.lotNumber,
                    qcStatus: lots.qcStatus,
                    expirationDate: lots.expirationDate,
                    locationId: locations.locationId,
                    locationCode: locations.code,
                    locationName: locations.name,
                    locationType: locations.locationType,
                    qtyOnHand: inventoryStock.qtyOnHand,
                    qtyReserved: sql<string>`${reserved}::text`,
                    qtyAvailable: sql<string>`(${inventoryStock.qtyOnHand}-${reserved})::text`,
                    sourceReference: sql<
                        string | null
                    >`coalesce(${packingOrders.packingOrderNumber},${purchaseOrders.poNumber})`,
                })
                .from(inventoryStock)
                .innerJoin(items, eq(items.itemId, inventoryStock.itemId))
                .innerJoin(uoms, eq(uoms.uomId, items.primaryUomId))
                .leftJoin(brands, eq(brands.brandId, items.brandId))
                .innerJoin(
                    lots,
                    and(
                        eq(lots.lotId, inventoryStock.lotId),
                        eq(lots.itemId, inventoryStock.itemId),
                    ),
                )
                .innerJoin(locations, eq(locations.locationId, inventoryStock.locationId))
                .leftJoin(packingOrders, eq(packingOrders.packingOrderId, lots.packingOrderId))
                .leftJoin(purchaseOrderLines, eq(purchaseOrderLines.poLineId, lots.poLineId))
                .leftJoin(purchaseOrders, eq(purchaseOrders.poId, purchaseOrderLines.poId));
            return buildInventoryReport(query, catalog, stock, [], now, levels);
        },
        { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
}
export async function getInventoryReportOptions(database: typeof db = db) {
    const [itemOptions, locationOptions, brandOptions] = await Promise.all([
        database
            .select({ itemId: items.itemId, sku: items.sku, name: items.name })
            .from(items)
            .orderBy(asc(items.name)),
        database
            .select({
                locationId: locations.locationId,
                code: locations.code,
                name: locations.name,
            })
            .from(locations)
            .orderBy(asc(locations.name)),
        database
            .select({ brandId: brands.brandId, name: brands.name })
            .from(brands)
            .orderBy(asc(brands.name)),
    ]);
    return { items: itemOptions, locations: locationOptions, brands: brandOptions };
}
