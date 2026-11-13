import { desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import {
    inventoryReservations,
    inventoryStock,
    inventoryTransactions,
    items,
    locations,
    lots,
    packingOrders,
    purchaseOrderLines,
    purchaseOrders,
    stockTransfers,
    suppliers,
    uoms,
    reorderPolicies,
} from '../../db/schema.ts';
import { getSettings } from '../company-settings/company-setting.service.ts';
import { purchaseOrderAmounts } from '../purchase-orders/purchase-order.rules.ts';
import type {
    DashboardActivePackingOrder,
    DashboardActiveTransfer,
    DashboardData,
    DashboardExpiringLot,
    DashboardLowStockItem,
    DashboardPendingPurchaseOrder,
    DashboardRecentActivity,
    DashboardStockByLocation,
    DashboardStockByType,
    DashboardSummary,
} from './dashboard.schema.ts';

const SCALE = 10_000n;

function parseUnits(value: string | null | undefined): bigint {
    if (!value || typeof value !== 'string') return 0n;
    const trimmed = value.trim();
    if (!/^-?\d+(?:\.\d{1,4})?$/.test(trimmed)) return 0n;
    const isNegative = trimmed.startsWith('-');
    const clean = isNegative ? trimmed.slice(1) : trimmed;
    const [whole = '0', fraction = ''] = clean.split('.');
    const units = BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, '0').slice(0, 4));
    return isNegative ? -units : units;
}

function formatUnits(units: bigint, places = 4): string {
    const scale = 10n ** BigInt(places);
    const negative = units < 0n;
    const abs = negative ? -units : units;
    const whole = abs / scale;
    const frac = (abs % scale).toString().padStart(places, '0');
    return `${negative ? '-' : ''}${whole}.${frac}`;
}

export async function getDashboardData(database: typeof db = db): Promise<DashboardData> {
    return database.transaction(
        async (tx) => {
            const settings = await getSettings(tx);
            const levels = new Map(
                (await tx.select().from(reorderPolicies)).map((r) => [r.itemId, r.reorderLevel]),
            );
            const todayStr = new Date().toISOString().slice(0, 10);
            const todayTime = new Date(`${todayStr}T00:00:00Z`).getTime();

            // 1. Correlated reservation calculation for stock balances
            const reservedSql = sql`coalesce((
        select sum(${inventoryReservations.qtyReserved} - ${inventoryReservations.qtyConsumed})
        from ${inventoryReservations}
        where ${inventoryReservations.itemId} = ${inventoryStock.itemId}
          and ${inventoryReservations.lotId} = ${inventoryStock.lotId}
          and ${inventoryReservations.locationId} = ${inventoryStock.locationId}
          and ${inventoryReservations.releasedAt} is null
    ), 0)`;

            // Fetch all stock rows joined with items, lots, locations, and uoms
            const stockRows = await tx
                .select({
                    stockId: inventoryStock.stockId,
                    itemId: inventoryStock.itemId,
                    sku: items.sku,
                    itemName: items.name,
                    itemType: items.itemType,
                    primaryUomName: uoms.name,
                    primaryUomId: uoms.uomId,
                    isActive: items.isActive,
                    locationActive: locations.isActive,
                    lotId: inventoryStock.lotId,
                    lotNumber: lots.lotNumber,
                    expirationDate: lots.expirationDate,
                    qcStatus: lots.qcStatus,
                    unitCost: sql<string>`coalesce(${lots.unitCost}, ${items.unitCost}, 0)::text`,
                    locationId: inventoryStock.locationId,
                    locationCode: locations.code,
                    locationName: locations.name,
                    locationType: locations.locationType,
                    qtyOnHand: inventoryStock.qtyOnHand,
                    qtyReserved: sql<string>`${reservedSql}::text`,
                    qtyAvailable: sql<string>`(${inventoryStock.qtyOnHand} - ${reservedSql})::text`,
                })
                .from(inventoryStock)
                .innerJoin(items, eq(inventoryStock.itemId, items.itemId))
                .innerJoin(lots, eq(inventoryStock.lotId, lots.lotId))
                .innerJoin(locations, eq(inventoryStock.locationId, locations.locationId))
                .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId));

            // 2. Fetch active catalog items count
            const [{ count: activeItemsCount }] = await tx
                .select({ count: sql<number>`count(*)::int` })
                .from(items)
                .where(eq(items.isActive, true));

            // Calculate aggregated inventory numbers
            let totalInventoryValueUnits = 0n;
            let rawMaterialValueUnits = 0n;
            let packagingValueUnits = 0n;
            let finishedGoodsValueUnits = 0n;

            const typeBuckets: Record<
                string,
                {
                    onHand: bigint;
                    reserved: bigint;
                    available: bigint;
                    value: bigint;
                    items: Set<number>;
                }
            > = {
                'Raw Material - Bulk': {
                    onHand: 0n,
                    reserved: 0n,
                    available: 0n,
                    value: 0n,
                    items: new Set(),
                },
                'Packaging - Hardware': {
                    onHand: 0n,
                    reserved: 0n,
                    available: 0n,
                    value: 0n,
                    items: new Set(),
                },
                'Packaging - Label': {
                    onHand: 0n,
                    reserved: 0n,
                    available: 0n,
                    value: 0n,
                    items: new Set(),
                },
                'Finished Good': {
                    onHand: 0n,
                    reserved: 0n,
                    available: 0n,
                    value: 0n,
                    items: new Set(),
                },
            };

            const locationBuckets = new Map<
                number,
                {
                    locationId: number;
                    locationCode: string;
                    locationName: string;
                    locationType: string;
                    onHand: bigint;
                    reserved: bigint;
                    available: bigint;
                    items: Set<number>;
                }
            >();

            // For low stock tracking by item
            const itemStockAgg = new Map<
                number,
                {
                    itemId: number;
                    sku: string;
                    itemName: string;
                    itemType: (typeof items.$inferSelect)['itemType'];
                    primaryUomName: string;
                    onHand: bigint;
                    reserved: bigint;
                    available: bigint;
                }
            >();

            const catalog = await tx
                .select({
                    itemId: items.itemId,
                    sku: items.sku,
                    itemName: items.name,
                    itemType: items.itemType,
                    primaryUomName: uoms.name,
                })
                .from(items)
                .innerJoin(uoms, eq(uoms.uomId, items.primaryUomId))
                .where(eq(items.isActive, true));
            for (const item of catalog)
                itemStockAgg.set(item.itemId, { ...item, onHand: 0n, reserved: 0n, available: 0n });
            function unitTotals(rows: typeof stockRows) {
                const units = new Map<
                    number,
                    {
                        primaryUomId: number;
                        primaryUomName: string;
                        onHand: bigint;
                        reserved: bigint;
                        available: bigint;
                    }
                >();
                for (const row of rows) {
                    const unit = units.get(row.primaryUomId) ?? {
                        primaryUomId: row.primaryUomId,
                        primaryUomName: row.primaryUomName,
                        onHand: 0n,
                        reserved: 0n,
                        available: 0n,
                    };
                    unit.onHand += parseUnits(row.qtyOnHand);
                    unit.reserved += parseUnits(row.qtyReserved);
                    unit.available += parseUnits(row.qtyAvailable);
                    units.set(row.primaryUomId, unit);
                }
                return [...units.values()].map((u) => ({
                    ...u,
                    onHand: formatUnits(u.onHand),
                    reserved: formatUnits(u.reserved),
                    available: formatUnits(u.available),
                }));
            }
            const expiringLots: DashboardExpiringLot[] = [];

            for (const stock of stockRows) {
                const onHand = parseUnits(stock.qtyOnHand);
                const reserved = parseUnits(stock.qtyReserved);
                const available = parseUnits(stock.qtyAvailable);
                const cost = parseUnits(stock.unitCost);
                const value = (onHand * cost) / SCALE;

                totalInventoryValueUnits += value;

                // Categorize by item type
                if (stock.itemType === 'Raw Material - Bulk') {
                    rawMaterialValueUnits += value;
                } else if (
                    stock.itemType === 'Packaging - Hardware' ||
                    stock.itemType === 'Packaging - Label'
                ) {
                    packagingValueUnits += value;
                } else if (stock.itemType === 'Finished Good') {
                    finishedGoodsValueUnits += value;
                }

                const typeBucket = typeBuckets[stock.itemType];
                if (typeBucket) {
                    typeBucket.onHand += onHand;
                    typeBucket.reserved += reserved;
                    typeBucket.available += available;
                    typeBucket.value += value;
                    typeBucket.items.add(stock.itemId);
                }

                // Location bucket
                let loc = locationBuckets.get(stock.locationId);
                if (!loc) {
                    loc = {
                        locationId: stock.locationId,
                        locationCode: stock.locationCode,
                        locationName: stock.locationName,
                        locationType: stock.locationType,
                        onHand: 0n,
                        reserved: 0n,
                        available: 0n,
                        items: new Set(),
                    };
                    locationBuckets.set(stock.locationId, loc);
                }
                loc.onHand += onHand;
                loc.reserved += reserved;
                loc.available += available;
                loc.items.add(stock.itemId);

                // Aggregate stock per item (for low stock alert)
                if (!stock.isActive) continue;
                let itemAgg = itemStockAgg.get(stock.itemId);
                if (!itemAgg) {
                    itemAgg = {
                        itemId: stock.itemId,
                        sku: stock.sku,
                        itemName: stock.itemName,
                        itemType: stock.itemType,
                        primaryUomName: stock.primaryUomName,
                        onHand: 0n,
                        reserved: 0n,
                        available: 0n,
                    };
                    itemStockAgg.set(stock.itemId, itemAgg);
                }
                itemAgg.onHand += onHand;
                itemAgg.reserved += reserved;
                if (
                    stock.locationActive &&
                    stock.qcStatus === 'Approved' &&
                    !['In Transit', 'Quarantine', 'Scrap'].includes(stock.locationType) &&
                    (!stock.expirationDate || stock.expirationDate > todayStr)
                )
                    itemAgg.available += available;

                // Expiring lots (qtyOnHand > 0 and expirationDate within 30 days or past)
                if (stock.expirationDate && onHand > 0n) {
                    const expTime = new Date(`${stock.expirationDate}T00:00:00Z`).getTime();
                    const daysUntil = Math.round((expTime - todayTime) / (1000 * 60 * 60 * 24));
                    if (daysUntil <= settings.expiryWarningDays) {
                        expiringLots.push({
                            lotId: stock.lotId,
                            lotNumber: stock.lotNumber,
                            itemId: stock.itemId,
                            itemSku: stock.sku,
                            itemName: stock.itemName,
                            itemType: stock.itemType,
                            primaryUomName: stock.primaryUomName,
                            locationName: stock.locationName,
                            qtyOnHand: stock.qtyOnHand,
                            expirationDate: stock.expirationDate,
                            daysUntilExpiry: daysUntil,
                            qcStatus: stock.qcStatus,
                        });
                    }
                }
            }

            // Sort expiring lots by daysUntilExpiry ascending (earliest first)
            expiringLots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

            // Filter low stock items: materials with available <= 10 or <= 0
            const lowStockItems: DashboardLowStockItem[] = [];

            for (const item of itemStockAgg.values()) {
                {
                    if (
                        item.available <=
                        parseUnits(levels.get(item.itemId) ?? settings.defaultReorderLevel)
                    ) {
                        lowStockItems.push({
                            itemId: item.itemId,
                            itemSku: item.sku,
                            itemName: item.itemName,
                            itemType: item.itemType,
                            primaryUomName: item.primaryUomName,
                            qtyOnHand: formatUnits(item.onHand),
                            qtyReserved: formatUnits(item.reserved),
                            qtyAvailable: formatUnits(item.available),
                        });
                    }
                }
            }
            lowStockItems.sort((a, b) =>
                parseUnits(a.qtyAvailable) < parseUnits(b.qtyAvailable)
                    ? -1
                    : parseUnits(a.qtyAvailable) > parseUnits(b.qtyAvailable)
                      ? 1
                      : a.itemId - b.itemId,
            );

            // 3. Stock by Type array
            const stockByType: DashboardStockByType[] = Object.entries(typeBuckets).map(
                ([type, bucket]) => ({
                    itemType: type as (typeof items.$inferSelect)['itemType'],
                    quantities: unitTotals(stockRows.filter((r) => r.itemType === type)),
                    totalValue: formatUnits(bucket.value),
                    itemCount: bucket.items.size,
                }),
            );

            // 4. Stock by Location array
            const stockByLocation: DashboardStockByLocation[] = Array.from(locationBuckets.values())
                .map((loc) => ({
                    locationId: loc.locationId,
                    locationCode: loc.locationCode,
                    locationName: loc.locationName,
                    locationType: loc.locationType,
                    quantities: unitTotals(
                        stockRows.filter((r) => r.locationId === loc.locationId),
                    ),
                    itemCount: loc.items.size,
                }))
                .sort((a, b) => a.locationName.localeCompare(b.locationName));

            // 5. Active Packing Orders (Planned, In Progress, or recent)
            const packingSource = alias(locations, 'packing_source');
            const packingDest = alias(locations, 'packing_destination');
            const packingOrderRows = await tx
                .select({
                    packingOrderId: packingOrders.packingOrderId,
                    packingOrderNumber: packingOrders.packingOrderNumber,
                    itemId: packingOrders.itemId,
                    itemSku: items.sku,
                    itemName: items.name,
                    targetQty: packingOrders.targetQty,
                    actualQty: packingOrders.actualQty,
                    primaryUomName: uoms.name,
                    status: packingOrders.status,
                    scheduledDate: packingOrders.scheduledDate,
                    sourceLocationName: packingSource.name,
                    destinationLocationName: packingDest.name,
                    createdAt: packingOrders.createdAt,
                })
                .from(packingOrders)
                .innerJoin(items, eq(packingOrders.itemId, items.itemId))
                .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
                .innerJoin(
                    packingSource,
                    eq(packingOrders.sourceLocationId, packingSource.locationId),
                )
                .innerJoin(
                    packingDest,
                    eq(packingOrders.destinationLocationId, packingDest.locationId),
                )
                .where(inArray(packingOrders.status, ['Planned', 'In Progress']))
                .orderBy(desc(packingOrders.createdAt))
                .limit(10);

            const activePackingOrders: DashboardActivePackingOrder[] = packingOrderRows.map(
                (po) => ({
                    packingOrderId: po.packingOrderId,
                    packingOrderNumber: po.packingOrderNumber,
                    itemId: po.itemId,
                    itemSku: po.itemSku,
                    itemName: po.itemName,
                    targetQty: po.targetQty,
                    actualQty: po.actualQty,
                    primaryUomName: po.primaryUomName,
                    status: po.status,
                    scheduledDate: po.scheduledDate,
                    sourceLocationName: po.sourceLocationName,
                    destinationLocationName: po.destinationLocationName,
                }),
            );

            const [{ count: activePackingOrdersCount }] = await tx
                .select({ count: sql<number>`count(*)::int` })
                .from(packingOrders)
                .where(inArray(packingOrders.status, ['Planned', 'In Progress']));

            // 6. Pending Purchase Orders (Draft, Sent, Partially Received)
            const poRows = await tx
                .select({
                    poId: purchaseOrders.poId,
                    poNumber: purchaseOrders.poNumber,
                    supplierId: purchaseOrders.supplierId,
                    supplierName: suppliers.name,
                    status: purchaseOrders.status,
                    orderDate: purchaseOrders.orderDate,
                    expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
                })
                .from(purchaseOrders)
                .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.supplierId))
                .where(inArray(purchaseOrders.status, ['Draft', 'Sent', 'Partially Received']))
                .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.poId))
                .limit(10);

            // Compute lines & amounts for each PO
            const pendingPurchaseOrders: DashboardPendingPurchaseOrder[] = [];
            for (const po of poRows) {
                const lines = await tx
                    .select({
                        qtyOrdered: purchaseOrderLines.qtyOrdered,
                        qtyReceived: purchaseOrderLines.qtyReceived,
                        unitPrice: purchaseOrderLines.unitPrice,
                    })
                    .from(purchaseOrderLines)
                    .where(eq(purchaseOrderLines.poId, po.poId));

                const amounts = purchaseOrderAmounts(lines);
                pendingPurchaseOrders.push({
                    poId: po.poId,
                    poNumber: po.poNumber,
                    supplierId: po.supplierId,
                    supplierName: po.supplierName,
                    status: po.status,
                    orderDate:
                        po.orderDate instanceof Date
                            ? po.orderDate.toISOString()
                            : String(po.orderDate),
                    expectedDeliveryDate: po.expectedDeliveryDate,
                    lineCount: lines.length,
                    totalAmount: amounts.totalAmount,
                    receivedAmount: amounts.receivedAmount,
                    outstandingAmount: amounts.outstandingAmount,
                });
            }

            const [{ count: pendingPurchaseOrdersCount }] = await tx
                .select({ count: sql<number>`count(*)::int` })
                .from(purchaseOrders)
                .where(inArray(purchaseOrders.status, ['Draft', 'Sent', 'Partially Received']));

            // 7. Active Transfers (In Transit or Draft)
            const transferSource = alias(locations, 'transfer_source');
            const transferDest = alias(locations, 'transfer_destination');
            const transferRows = await tx
                .select({
                    transferId: stockTransfers.transferId,
                    transferNumber: stockTransfers.transferNumber,
                    sourceLocationName: transferSource.name,
                    destinationLocationName: transferDest.name,
                    status: stockTransfers.status,
                    requestedAt: stockTransfers.requestedAt,
                    dispatchedAt: stockTransfers.dispatchedAt,
                    lineCount: sql<number>`(select count(*)::int from stock_transfer_lines where stock_transfer_lines.transfer_id = ${stockTransfers.transferId})`,
                })
                .from(stockTransfers)
                .innerJoin(
                    transferSource,
                    eq(stockTransfers.sourceLocationId, transferSource.locationId),
                )
                .innerJoin(
                    transferDest,
                    eq(stockTransfers.destinationLocationId, transferDest.locationId),
                )
                .where(eq(stockTransfers.status, 'In Transit'))
                .orderBy(desc(stockTransfers.requestedAt))
                .limit(8);

            const activeTransfers: DashboardActiveTransfer[] = transferRows.map((t) => ({
                transferId: t.transferId,
                transferNumber: t.transferNumber,
                sourceLocationName: t.sourceLocationName,
                destinationLocationName: t.destinationLocationName,
                status: t.status,
                requestedAt:
                    t.requestedAt instanceof Date
                        ? t.requestedAt.toISOString()
                        : String(t.requestedAt),
                dispatchedAt: t.dispatchedAt
                    ? t.dispatchedAt instanceof Date
                        ? t.dispatchedAt.toISOString()
                        : String(t.dispatchedAt)
                    : null,
                lineCount: t.lineCount,
            }));

            const [{ count: activeTransfersCount }] = await tx
                .select({ count: sql<number>`count(*)::int` })
                .from(stockTransfers)
                .where(eq(stockTransfers.status, 'In Transit'));

            // 8. Recent Activity / Transactions
            const txnRows = await tx
                .select({
                    transactionId: inventoryTransactions.transactionId,
                    transactionType: inventoryTransactions.transactionType,
                    itemSku: items.sku,
                    itemName: items.name,
                    lotNumber: lots.lotNumber,
                    locationName: locations.name,
                    qtyChange: inventoryTransactions.qtyChange,
                    primaryUomName: uoms.name,
                    createdAt: inventoryTransactions.createdAt,
                    referenceId: inventoryTransactions.referenceId,
                })
                .from(inventoryTransactions)
                .innerJoin(items, eq(inventoryTransactions.itemId, items.itemId))
                .innerJoin(lots, eq(inventoryTransactions.lotId, lots.lotId))
                .innerJoin(locations, eq(inventoryTransactions.locationId, locations.locationId))
                .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
                .orderBy(desc(inventoryTransactions.transactionId))
                .limit(10);

            const recentActivity: DashboardRecentActivity[] = txnRows.map((t) => ({
                transactionId: t.transactionId,
                transactionType: t.transactionType,
                itemSku: t.itemSku,
                itemName: t.itemName,
                lotNumber: t.lotNumber,
                locationName: t.locationName,
                qtyChange: t.qtyChange,
                primaryUomName: t.primaryUomName,
                createdAt:
                    t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
                referenceId: t.referenceId,
            }));

            // Build summary DTO
            const summary: DashboardSummary = {
                totalInventoryValue: formatUnits(totalInventoryValueUnits),
                rawMaterialValue: formatUnits(rawMaterialValueUnits),
                packagingValue: formatUnits(packagingValueUnits),
                finishedGoodsValue: formatUnits(finishedGoodsValueUnits),
                totalItemsCount: activeItemsCount,
                currencyCode: settings.currencyCode,
                rawMaterialQuantities: unitTotals(
                    stockRows.filter((r) => r.itemType === 'Raw Material - Bulk'),
                ),
                finishedGoodsQuantities: unitTotals(
                    stockRows.filter((r) => r.itemType === 'Finished Good'),
                ),
                activePackingOrdersCount,
                pendingPurchaseOrdersCount,
                activeTransfersCount,
                lowStockItemsCount: lowStockItems.length,
                expiringLotsCount: expiringLots.length,
            };

            return {
                summary,
                stockByType,
                stockByLocation,
                activePackingOrders: activePackingOrders.slice(0, 6),
                pendingPurchaseOrders: pendingPurchaseOrders.slice(0, 6),
                activeTransfers: activeTransfers.slice(0, 6),
                expiringLots: expiringLots.slice(0, 8),
                lowStockItems: lowStockItems.slice(0, 8),
                recentActivity: recentActivity.slice(0, 8),
            };
        },
        { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
}
