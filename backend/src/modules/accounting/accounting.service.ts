import { and, asc, desc, eq, gte, inArray, lt, lte, type SQL } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
    customers,
    deliveryOrderLines,
    deliveryOrders,
    inventoryStock,
    inventoryTransactions,
    items,
    locations,
    lots,
    packingOrders,
    purchaseOrderLines,
    purchaseOrders,
    suppliers,
    uoms,
    users,
    salesOrderLines,
    salesOrders,
} from '../../db/schema.ts';
import { getSettings } from '../company-settings/company-setting.service.ts';
import {
    computeVat4,
    dividePerUnit4,
    formatScaled4,
    multiplyScaled4,
    percentString,
    resolveEffectiveCost,
    scaled4,
    type LotSourceKind,
} from './accounting.rules.ts';
import type { AccountingQuery } from './accounting.schema.ts';

const LEDGER_LIMIT = 300;
const ITEM_TYPES = [
    'Raw Material - Bulk',
    'Packaging - Hardware',
    'Packaging - Label',
    'Finished Good',
] as const;

function toIsoDate(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

function inDateRange(value: Date | string | null | undefined, query: AccountingQuery): boolean {
    if (!query.fromDate && !query.toDate) return true;
    const iso = toIsoDate(value);
    const day = iso?.slice(0, 10);
    if (!day) return false;
    if (query.fromDate && day < query.fromDate) return false;
    if (query.toDate && day > query.toDate) return false;
    return true;
}

function nextUtcDay(day: string): Date {
    const end = new Date(`${day}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return end;
}

function timestampRangeConditions(
    column: typeof inventoryTransactions.createdAt | typeof purchaseOrders.orderDate,
    query: AccountingQuery,
): SQL[] {
    const conditions: SQL[] = [];
    if (query.fromDate) conditions.push(gte(column, new Date(`${query.fromDate}T00:00:00.000Z`)));
    if (query.toDate) conditions.push(lt(column, nextUtcDay(query.toDate)));
    return conditions;
}

function dateRangeConditions(column: typeof salesOrders.orderDate, query: AccountingQuery): SQL[] {
    const conditions: SQL[] = [];
    if (query.fromDate) conditions.push(gte(column, query.fromDate));
    if (query.toDate) conditions.push(lte(column, query.toDate));
    return conditions;
}

export async function getAccountingOverview(query: AccountingQuery = {}, database: typeof db = db) {
    return database.transaction(async (tx) => {
        const settings = await getSettings(tx);
        const poDateConditions = timestampRangeConditions(purchaseOrders.orderDate, query);
        const txnDateConditions = timestampRangeConditions(inventoryTransactions.createdAt, query);
        const soDateConditions = dateRangeConditions(salesOrders.orderDate, query);

        const [
            itemRows,
            lotRows,
            stockRows,
            poRows,
            packingRows,
            consumeTxnRows,
            ledgerTxnRows,
            shrinkageTxnRows,
            salesOrderRows,
            salesLineRows,
            deliveryLineRows,
        ] = await Promise.all([
            tx
                .select({
                    itemId: items.itemId,
                    sku: items.sku,
                    name: items.name,
                    itemType: items.itemType,
                    unitCost: items.unitCost,
                    primaryUomName: uoms.name,
                    isActive: items.isActive,
                })
                .from(items)
                .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
                .orderBy(asc(items.sku)),

            tx
                .select({
                    lotId: lots.lotId,
                    lotNumber: lots.lotNumber,
                    itemId: lots.itemId,
                    poLineId: lots.poLineId,
                    packingOrderId: lots.packingOrderId,
                    unitCost: lots.unitCost,
                    qcStatus: lots.qcStatus,
                    createdAt: lots.createdAt,
                    poId: purchaseOrderLines.poId,
                    poUnitPrice: purchaseOrderLines.unitPrice,
                    purchaseUomName: uoms.name,
                    poNumber: purchaseOrders.poNumber,
                    supplierName: suppliers.name,
                    packingOrderNumber: packingOrders.packingOrderNumber,
                })
                .from(lots)
                .leftJoin(purchaseOrderLines, eq(lots.poLineId, purchaseOrderLines.poLineId))
                .leftJoin(uoms, eq(purchaseOrderLines.uomId, uoms.uomId))
                .leftJoin(purchaseOrders, eq(purchaseOrderLines.poId, purchaseOrders.poId))
                .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.supplierId))
                .leftJoin(packingOrders, eq(lots.packingOrderId, packingOrders.packingOrderId))
                .orderBy(desc(lots.lotId)),

            tx
                .select({
                    itemId: inventoryStock.itemId,
                    lotId: inventoryStock.lotId,
                    locationId: inventoryStock.locationId,
                    qtyOnHand: inventoryStock.qtyOnHand,
                    locationCode: locations.code,
                    locationName: locations.name,
                    locationType: locations.locationType,
                })
                .from(inventoryStock)
                .innerJoin(locations, eq(inventoryStock.locationId, locations.locationId)),

            tx
                .select({
                    poId: purchaseOrders.poId,
                    poNumber: purchaseOrders.poNumber,
                    supplierName: suppliers.name,
                    status: purchaseOrders.status,
                    orderDate: purchaseOrders.orderDate,
                    expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
                    qtyOrdered: purchaseOrderLines.qtyOrdered,
                    qtyReceived: purchaseOrderLines.qtyReceived,
                    unitPrice: purchaseOrderLines.unitPrice,
                    vatRatePercent: purchaseOrderLines.vatRatePercent,
                })
                .from(purchaseOrders)
                .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.supplierId))
                .innerJoin(purchaseOrderLines, eq(purchaseOrders.poId, purchaseOrderLines.poId))
                .where(poDateConditions.length ? and(...poDateConditions) : undefined)
                .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.poId)),

            tx
                .select({
                    packingOrderId: packingOrders.packingOrderId,
                    packingOrderNumber: packingOrders.packingOrderNumber,
                    itemId: packingOrders.itemId,
                    status: packingOrders.status,
                    targetQty: packingOrders.targetQty,
                    actualQty: packingOrders.actualQty,
                    scheduledDate: packingOrders.scheduledDate,
                    completedAt: packingOrders.completedAt,
                    createdAt: packingOrders.createdAt,
                })
                .from(packingOrders)
                .orderBy(desc(packingOrders.packingOrderId)),

            tx
                .select({
                    packingOrderId: inventoryTransactions.packingOrderId,
                    itemId: inventoryTransactions.itemId,
                    lotId: inventoryTransactions.lotId,
                    qtyChange: inventoryTransactions.qtyChange,
                })
                .from(inventoryTransactions)
                .where(eq(inventoryTransactions.transactionType, 'Consume')),

            tx
                .select({
                    transactionId: inventoryTransactions.transactionId,
                    transactionType: inventoryTransactions.transactionType,
                    itemId: inventoryTransactions.itemId,
                    lotId: inventoryTransactions.lotId,
                    qtyChange: inventoryTransactions.qtyChange,
                    referenceId: inventoryTransactions.referenceId,
                    createdAt: inventoryTransactions.createdAt,
                    locationName: locations.name,
                    authorizedFirstName: users.firstName,
                    authorizedLastName: users.lastName,
                })
                .from(inventoryTransactions)
                .innerJoin(locations, eq(inventoryTransactions.locationId, locations.locationId))
                .innerJoin(users, eq(inventoryTransactions.authorizedByUserId, users.userId))
                .where(txnDateConditions.length ? and(...txnDateConditions) : undefined)
                .orderBy(
                    desc(inventoryTransactions.createdAt),
                    desc(inventoryTransactions.transactionId),
                )
                .limit(LEDGER_LIMIT),

            tx
                .select({
                    transactionType: inventoryTransactions.transactionType,
                    itemId: inventoryTransactions.itemId,
                    lotId: inventoryTransactions.lotId,
                    qtyChange: inventoryTransactions.qtyChange,
                })
                .from(inventoryTransactions)
                .where(
                    and(
                        inArray(inventoryTransactions.transactionType, ['Scrap', 'Adjustment']),
                        ...txnDateConditions,
                    ),
                ),

            tx
                .select({
                    salesOrderId: salesOrders.salesOrderId,
                    salesOrderNumber: salesOrders.salesOrderNumber,
                    customerPoNumber: salesOrders.customerPoNumber,
                    customerName: customers.name,
                    status: salesOrders.status,
                    orderDate: salesOrders.orderDate,
                })
                .from(salesOrders)
                .innerJoin(customers, eq(salesOrders.customerId, customers.customerId))
                .where(soDateConditions.length ? and(...soDateConditions) : undefined)
                .orderBy(desc(salesOrders.orderDate), desc(salesOrders.salesOrderId)),

            tx
                .select({
                    salesOrderLineId: salesOrderLines.salesOrderLineId,
                    salesOrderId: salesOrderLines.salesOrderId,
                    itemId: salesOrderLines.itemId,
                    qtyOrdered: salesOrderLines.qtyOrdered,
                    unitPrice: salesOrderLines.unitPrice,
                    vatRatePercent: salesOrderLines.vatRatePercent,
                })
                .from(salesOrderLines),

            tx
                .select({
                    deliveryOrderId: deliveryOrders.deliveryOrderId,
                    salesOrderId: deliveryOrders.salesOrderId,
                    deliveryStatus: deliveryOrders.status,
                    deliveryDate: deliveryOrders.deliveryDate,
                    completedAt: deliveryOrders.completedAt,
                    salesOrderLineId: deliveryOrderLines.salesOrderLineId,
                    itemId: deliveryOrderLines.itemId,
                    lotId: deliveryOrderLines.lotId,
                    qtyDelivered: deliveryOrderLines.qtyDelivered,
                })
                .from(deliveryOrderLines)
                .innerJoin(
                    deliveryOrders,
                    eq(deliveryOrderLines.deliveryOrderId, deliveryOrders.deliveryOrderId),
                ),
        ]);

        const itemMap = new Map(itemRows.map((row) => [row.itemId, row]));
        const lotMetaMap = new Map<
            number,
            {
                lotId: number;
                lotNumber: string;
                itemId: number;
                sourceType: LotSourceKind;
                sourceReference: string;
                supplierName: string | null;
                purchaseUnitPrice: string | null;
                purchaseUomName: string | null;
                lotUnitCost: string | null;
                effectiveUnitCost: string;
                costBasis: ReturnType<typeof resolveEffectiveCost>['costBasis'];
                qcStatus: string;
                packingOrderId: number | null;
                createdAt: string;
            }
        >();

        let costedLotsCount = 0;
        let uncostedLotsCount = 0;

        for (const lot of lotRows) {
            const item = itemMap.get(lot.itemId);
            if (!item) continue;
            const sourceType: LotSourceKind =
                lot.poLineId !== null
                    ? 'Purchase'
                    : lot.packingOrderId !== null
                      ? 'Packing'
                      : 'Opening';
            const sourceReference =
                sourceType === 'Purchase'
                    ? (lot.poNumber ?? `PO Line #${lot.poLineId}`)
                    : sourceType === 'Packing'
                      ? (lot.packingOrderNumber ?? `Packing #${lot.packingOrderId}`)
                      : 'Opening / Manual';
            const { effectiveUnitCost, costBasis } = resolveEffectiveCost(
                lot.unitCost,
                item.unitCost,
                sourceType,
            );
            if (lot.unitCost !== null) costedLotsCount += 1;
            else uncostedLotsCount += 1;

            lotMetaMap.set(lot.lotId, {
                lotId: lot.lotId,
                lotNumber: lot.lotNumber,
                itemId: lot.itemId,
                sourceType,
                sourceReference,
                supplierName: lot.supplierName ?? null,
                purchaseUnitPrice: lot.poUnitPrice ?? null,
                purchaseUomName: lot.purchaseUomName ?? null,
                lotUnitCost: lot.unitCost,
                effectiveUnitCost,
                costBasis,
                qcStatus: lot.qcStatus,
                packingOrderId: lot.packingOrderId,
                createdAt: lot.createdAt.toISOString(),
            });
        }

        // Aggregate current stock asset values by lot, category, and location
        const qtyOnHandByLot = new Map<number, bigint>();
        const assetByCategory = new Map<
            (typeof ITEM_TYPES)[number],
            { itemIds: Set<number>; lotIds: Set<number>; valueUnits: bigint }
        >(
            ITEM_TYPES.map((type) => [
                type,
                { itemIds: new Set(), lotIds: new Set(), valueUnits: 0n },
            ]),
        );
        const assetByLocation = new Map<
            number,
            {
                locationId: number;
                locationCode: string;
                locationName: string;
                locationType: string;
                itemIds: Set<number>;
                lotIds: Set<number>;
                valueUnits: bigint;
            }
        >();

        let totalInventoryAssetUnits = 0n;
        let rawMaterialAssetUnits = 0n;
        let packagingAssetUnits = 0n;
        let finishedGoodsAssetUnits = 0n;

        for (const stock of stockRows) {
            const qtyUnits = scaled4(stock.qtyOnHand);
            qtyOnHandByLot.set(stock.lotId, (qtyOnHandByLot.get(stock.lotId) ?? 0n) + qtyUnits);
            if (qtyUnits <= 0n) continue;

            const item = itemMap.get(stock.itemId);
            const lotMeta = lotMetaMap.get(stock.lotId);
            if (!item || !lotMeta) continue;

            const costUnits = scaled4(lotMeta.effectiveUnitCost);
            const valueUnits = multiplyScaled4(qtyUnits, costUnits);

            totalInventoryAssetUnits += valueUnits;
            if (item.itemType === 'Raw Material - Bulk') rawMaterialAssetUnits += valueUnits;
            else if (
                item.itemType === 'Packaging - Hardware' ||
                item.itemType === 'Packaging - Label'
            ) {
                packagingAssetUnits += valueUnits;
            } else {
                finishedGoodsAssetUnits += valueUnits;
            }

            const catBucket = assetByCategory.get(item.itemType);
            if (catBucket) {
                catBucket.itemIds.add(item.itemId);
                catBucket.lotIds.add(stock.lotId);
                catBucket.valueUnits += valueUnits;
            }

            let locBucket = assetByLocation.get(stock.locationId);
            if (!locBucket) {
                locBucket = {
                    locationId: stock.locationId,
                    locationCode: stock.locationCode,
                    locationName: stock.locationName,
                    locationType: stock.locationType,
                    itemIds: new Set(),
                    lotIds: new Set(),
                    valueUnits: 0n,
                };
                assetByLocation.set(stock.locationId, locBucket);
            }
            locBucket.itemIds.add(item.itemId);
            locBucket.lotIds.add(stock.lotId);
            locBucket.valueUnits += valueUnits;
        }

        const lotCosting = Array.from(lotMetaMap.values()).map((meta) => {
            const item = itemMap.get(meta.itemId)!;
            const qtyUnits = qtyOnHandByLot.get(meta.lotId) ?? 0n;
            const effectiveUnits = scaled4(meta.effectiveUnitCost);
            const catalogUnits = scaled4(item.unitCost);
            const assetUnits = multiplyScaled4(qtyUnits, effectiveUnits);
            return {
                lotId: meta.lotId,
                lotNumber: meta.lotNumber,
                itemId: item.itemId,
                itemSku: item.sku,
                itemName: item.name,
                itemType: item.itemType,
                primaryUomName: item.primaryUomName,
                sourceType: meta.sourceType,
                sourceReference: meta.sourceReference,
                supplierName: meta.supplierName,
                purchaseUnitPrice: meta.purchaseUnitPrice,
                purchaseUomName: meta.purchaseUomName,
                catalogUnitCost: item.unitCost,
                lotUnitCost: meta.lotUnitCost,
                effectiveUnitCost: meta.effectiveUnitCost,
                costBasis: meta.costBasis,
                unitVariance: formatScaled4(effectiveUnits - catalogUnits),
                qtyOnHand: formatScaled4(qtyUnits),
                assetValue: formatScaled4(assetUnits),
                qcStatus: meta.qcStatus,
                createdAt: meta.createdAt,
            };
        });

        // Purchasing Commitments & Input VAT (PO level)
        const poAgg = new Map<
            number,
            {
                poId: number;
                poNumber: string;
                supplierName: string;
                status: string;
                orderDate: string;
                expectedDeliveryDate: string | null;
                lineCount: number;
                orderedNetUnits: bigint;
                orderedVatUnits: bigint;
                receivedNetUnits: bigint;
                receivedVatUnits: bigint;
            }
        >();

        for (const row of poRows) {
            if (!inDateRange(row.orderDate, query)) continue;
            let entry = poAgg.get(row.poId);
            if (!entry) {
                entry = {
                    poId: row.poId,
                    poNumber: row.poNumber,
                    supplierName: row.supplierName,
                    status: row.status,
                    orderDate: row.orderDate.toISOString(),
                    expectedDeliveryDate: row.expectedDeliveryDate,
                    lineCount: 0,
                    orderedNetUnits: 0n,
                    orderedVatUnits: 0n,
                    receivedNetUnits: 0n,
                    receivedVatUnits: 0n,
                };
                poAgg.set(row.poId, entry);
            }
            entry.lineCount += 1;
            const priceUnits = scaled4(row.unitPrice);
            const orderedNet = multiplyScaled4(scaled4(row.qtyOrdered), priceUnits);
            const receivedNet = multiplyScaled4(scaled4(row.qtyReceived), priceUnits);
            entry.orderedNetUnits += orderedNet;
            entry.orderedVatUnits += computeVat4(orderedNet, row.vatRatePercent);
            entry.receivedNetUnits += receivedNet;
            entry.receivedVatUnits += computeVat4(receivedNet, row.vatRatePercent);
        }

        let purchaseCommittedNetUnits = 0n;
        let purchaseCommittedVatUnits = 0n;
        let purchaseCommittedUnits = 0n;
        let purchaseReceivedNetUnits = 0n;
        let purchaseInputVatUnits = 0n;
        let purchaseReceivedUnits = 0n;
        let purchaseOutstandingUnits = 0n;

        const purchasingCosting = Array.from(poAgg.values()).map((po) => {
            const orderedGrossUnits = po.orderedNetUnits + po.orderedVatUnits;
            const receivedGrossUnits = po.receivedNetUnits + po.receivedVatUnits;
            const outstandingUnits =
                po.status === 'Cancelled' ? 0n : orderedGrossUnits - receivedGrossUnits;
            if (po.status !== 'Cancelled') {
                purchaseCommittedNetUnits += po.orderedNetUnits;
                purchaseCommittedVatUnits += po.orderedVatUnits;
                purchaseCommittedUnits += orderedGrossUnits;
                purchaseReceivedNetUnits += po.receivedNetUnits;
                purchaseInputVatUnits += po.receivedVatUnits;
                purchaseReceivedUnits += receivedGrossUnits;
                purchaseOutstandingUnits += outstandingUnits > 0n ? outstandingUnits : 0n;
            }
            return {
                poId: po.poId,
                poNumber: po.poNumber,
                supplierName: po.supplierName,
                status: po.status,
                orderDate: po.orderDate,
                expectedDeliveryDate: po.expectedDeliveryDate,
                lineCount: po.lineCount,
                netAmount: formatScaled4(po.orderedNetUnits),
                vatAmount: formatScaled4(po.orderedVatUnits),
                totalAmount: formatScaled4(orderedGrossUnits),
                receivedNetAmount: formatScaled4(po.receivedNetUnits),
                receivedVatAmount: formatScaled4(po.receivedVatUnits),
                receivedAmount: formatScaled4(receivedGrossUnits),
                outstandingAmount: formatScaled4(outstandingUnits > 0n ? outstandingUnits : 0n),
            };
        });

        // Production Cost Roll-Up (Packing orders + consumed components)
        const consumedByPacking = new Map<
            number,
            {
                componentSku: string;
                componentName: string;
                qtyConsumedUnits: bigint;
                uomName: string;
                unitCost: string;
                totalCostUnits: bigint;
            }[]
        >();
        const finishedLotByPacking = new Map<
            number,
            { lotNumber: string; unitCost: string | null }
        >();
        for (const lot of lotMetaMap.values()) {
            if (lot.packingOrderId !== null) {
                finishedLotByPacking.set(lot.packingOrderId, {
                    lotNumber: lot.lotNumber,
                    unitCost: lot.lotUnitCost,
                });
            }
        }

        for (const txn of consumeTxnRows) {
            if (txn.packingOrderId === null) continue;
            const item = itemMap.get(txn.itemId);
            const lotMeta = lotMetaMap.get(txn.lotId);
            if (!item || !lotMeta) continue;
            const qtyConsumedUnits = -scaled4(txn.qtyChange);
            if (qtyConsumedUnits <= 0n) continue;
            const costUnits = multiplyScaled4(qtyConsumedUnits, scaled4(lotMeta.effectiveUnitCost));
            const list = consumedByPacking.get(txn.packingOrderId) ?? [];
            list.push({
                componentSku: item.sku,
                componentName: item.name,
                qtyConsumedUnits,
                uomName: item.primaryUomName,
                unitCost: lotMeta.effectiveUnitCost,
                totalCostUnits: costUnits,
            });
            consumedByPacking.set(txn.packingOrderId, list);
        }

        let totalProductionCostUnits = 0n;
        const packingCosting = packingRows
            .filter((order) => inDateRange(order.completedAt ?? order.createdAt, query))
            .map((order) => {
                const item = itemMap.get(order.itemId)!;
                const components = consumedByPacking.get(order.packingOrderId) ?? [];
                const totalCostUnits = components.reduce(
                    (sum, component) => sum + component.totalCostUnits,
                    0n,
                );
                if (order.status === 'Completed') {
                    totalProductionCostUnits += totalCostUnits;
                }
                const finishedLot = finishedLotByPacking.get(order.packingOrderId);
                const actualUnits = scaled4(order.actualQty);
                const computedUnitCost = dividePerUnit4(totalCostUnits, actualUnits);
                const effectiveFinishedUnit =
                    finishedLot?.unitCost ?? computedUnitCost ?? item.unitCost;
                const unitVarianceUnits = scaled4(effectiveFinishedUnit) - scaled4(item.unitCost);

                return {
                    packingOrderId: order.packingOrderId,
                    packingOrderNumber: order.packingOrderNumber,
                    status: order.status,
                    itemId: item.itemId,
                    itemSku: item.sku,
                    itemName: item.name,
                    primaryUomName: item.primaryUomName,
                    targetQty: order.targetQty,
                    actualQty: order.actualQty,
                    consumedMaterialCost: formatScaled4(totalCostUnits),
                    finishedLotNumber: finishedLot?.lotNumber ?? null,
                    recordedLotUnitCost: finishedLot?.unitCost ?? null,
                    computedUnitCost,
                    catalogUnitCost: item.unitCost,
                    unitVariance: formatScaled4(unitVarianceUnits),
                    scheduledDate: order.scheduledDate,
                    completedAt: toIsoDate(order.completedAt),
                    components: components.map((component) => ({
                        componentSku: component.componentSku,
                        componentName: component.componentName,
                        qtyConsumed: formatScaled4(component.qtyConsumedUnits),
                        uomName: component.uomName,
                        unitCost: component.unitCost,
                        totalCost: formatScaled4(component.totalCostUnits),
                    })),
                };
            });

        // Sales Revenue, Output VAT & COGS Margin
        const salesLineById = new Map(salesLineRows.map((line) => [line.salesOrderLineId, line]));
        const bookedByOrder = new Map<number, { netUnits: bigint; vatUnits: bigint }>();
        for (const line of salesLineRows) {
            const net = multiplyScaled4(scaled4(line.qtyOrdered), scaled4(line.unitPrice));
            const vat = computeVat4(net, line.vatRatePercent);
            const bucket = bookedByOrder.get(line.salesOrderId) ?? { netUnits: 0n, vatUnits: 0n };
            bucket.netUnits += net;
            bucket.vatUnits += vat;
            bookedByOrder.set(line.salesOrderId, bucket);
        }

        const deliveryStatsByOrder = new Map<
            number,
            {
                deliveryIds: Set<number>;
                completedDeliveryIds: Set<number>;
                deliveredRevenueUnits: bigint;
                deliveredVatUnits: bigint;
                deliveredCogsUnits: bigint;
            }
        >();

        for (const dLine of deliveryLineRows) {
            let bucket = deliveryStatsByOrder.get(dLine.salesOrderId);
            if (!bucket) {
                bucket = {
                    deliveryIds: new Set(),
                    completedDeliveryIds: new Set(),
                    deliveredRevenueUnits: 0n,
                    deliveredVatUnits: 0n,
                    deliveredCogsUnits: 0n,
                };
                deliveryStatsByOrder.set(dLine.salesOrderId, bucket);
            }
            bucket.deliveryIds.add(dLine.deliveryOrderId);
            if (dLine.deliveryStatus === 'Completed') {
                bucket.completedDeliveryIds.add(dLine.deliveryOrderId);
                const qtyDeliveredUnits = scaled4(dLine.qtyDelivered);
                const sLine = salesLineById.get(dLine.salesOrderLineId);
                if (sLine) {
                    const lineNet = multiplyScaled4(qtyDeliveredUnits, scaled4(sLine.unitPrice));
                    bucket.deliveredRevenueUnits += lineNet;
                    bucket.deliveredVatUnits += computeVat4(lineNet, sLine.vatRatePercent);
                }
                const lotMeta = lotMetaMap.get(dLine.lotId);
                const item = itemMap.get(dLine.itemId);
                const unitCost = lotMeta?.effectiveUnitCost ?? item?.unitCost ?? '0';
                bucket.deliveredCogsUnits += multiplyScaled4(qtyDeliveredUnits, scaled4(unitCost));
            }
        }

        let totalBookedRevenueUnits = 0n;
        let totalBookedVatUnits = 0n;
        let totalDeliveredRevenueUnits = 0n;
        let totalOutputVatUnits = 0n;
        let totalDeliveredCogsUnits = 0n;

        const salesCosting = salesOrderRows
            .filter((order) => inDateRange(order.orderDate, query))
            .map((order) => {
                const booked = bookedByOrder.get(order.salesOrderId) ?? {
                    netUnits: 0n,
                    vatUnits: 0n,
                };
                const dStats = deliveryStatsByOrder.get(order.salesOrderId);
                const delivRevUnits = dStats?.deliveredRevenueUnits ?? 0n;
                const delivVatUnits = dStats?.deliveredVatUnits ?? 0n;
                const delivCogsUnits = dStats?.deliveredCogsUnits ?? 0n;
                const profitUnits = delivRevUnits - delivCogsUnits;

                if (order.status !== 'Cancelled') {
                    totalBookedRevenueUnits += booked.netUnits;
                    totalBookedVatUnits += booked.vatUnits;
                    totalDeliveredRevenueUnits += delivRevUnits;
                    totalOutputVatUnits += delivVatUnits;
                    totalDeliveredCogsUnits += delivCogsUnits;
                }

                return {
                    salesOrderId: order.salesOrderId,
                    salesOrderNumber: order.salesOrderNumber,
                    customerPoNumber: order.customerPoNumber,
                    customerName: order.customerName,
                    status: order.status,
                    orderDate: order.orderDate,
                    bookedRevenue: formatScaled4(booked.netUnits),
                    bookedVatAmount: formatScaled4(booked.vatUnits),
                    bookedBilling: formatScaled4(booked.netUnits + booked.vatUnits),
                    deliveredRevenue: formatScaled4(delivRevUnits),
                    deliveredVatAmount: formatScaled4(delivVatUnits),
                    deliveredBilling: formatScaled4(delivRevUnits + delivVatUnits),
                    deliveredCogs: formatScaled4(delivCogsUnits),
                    grossProfit: formatScaled4(profitUnits),
                    grossMarginPercent: percentString(profitUnits, delivRevUnits),
                    deliveryCount: dStats?.deliveryIds.size ?? 0,
                    completedDeliveryCount: dStats?.completedDeliveryIds.size ?? 0,
                };
            });

        // Costed Movement Ledger + Shrinkage / Adjustment Totals
        let scrapLossUnits = 0n;
        let adjustmentNetUnits = 0n;
        const costLedger: {
            transactionId: number;
            createdAt: string;
            transactionType: string;
            referenceId: string | null;
            itemSku: string;
            itemName: string;
            lotNumber: string;
            locationName: string;
            primaryUomName: string;
            qtyChange: string;
            effectiveUnitCost: string;
            costBasis: string;
            totalCostImpact: string;
            authorizedByName: string;
        }[] = [];

        for (const txn of shrinkageTxnRows) {
            const item = itemMap.get(txn.itemId);
            const lotMeta = lotMetaMap.get(txn.lotId);
            if (!item || !lotMeta) continue;

            const qtyUnits = scaled4(txn.qtyChange);
            const costUnits = scaled4(lotMeta.effectiveUnitCost);
            const impactUnits = multiplyScaled4(qtyUnits, costUnits);

            if (txn.transactionType === 'Scrap') {
                scrapLossUnits += -impactUnits;
            } else if (txn.transactionType === 'Adjustment') {
                adjustmentNetUnits += impactUnits;
            }
        }

        for (const txn of ledgerTxnRows) {
            const item = itemMap.get(txn.itemId);
            const lotMeta = lotMetaMap.get(txn.lotId);
            if (!item || !lotMeta) continue;

            const qtyUnits = scaled4(txn.qtyChange);
            const costUnits = scaled4(lotMeta.effectiveUnitCost);
            const impactUnits = multiplyScaled4(qtyUnits, costUnits);

            costLedger.push({
                transactionId: txn.transactionId,
                createdAt: txn.createdAt.toISOString(),
                transactionType: txn.transactionType,
                referenceId: txn.referenceId,
                itemSku: item.sku,
                itemName: item.name,
                lotNumber: lotMeta.lotNumber,
                locationName: txn.locationName,
                primaryUomName: item.primaryUomName,
                qtyChange: txn.qtyChange,
                effectiveUnitCost: lotMeta.effectiveUnitCost,
                costBasis: lotMeta.costBasis,
                totalCostImpact: formatScaled4(impactUnits),
                authorizedByName: `${txn.authorizedFirstName} ${txn.authorizedLastName}`.trim(),
            });
        }

        const grossProfitUnits = totalDeliveredRevenueUnits - totalDeliveredCogsUnits;
        const netVatPayableUnits = totalOutputVatUnits - purchaseInputVatUnits;

        return {
            generatedAt: new Date().toISOString(),
            currencyCode: settings.currencyCode,
            summary: {
                currencyCode: settings.currencyCode,
                vatRatePercent: settings.vatRatePercent,
                totalInventoryAssetValue: formatScaled4(totalInventoryAssetUnits),
                rawMaterialAssetValue: formatScaled4(rawMaterialAssetUnits),
                packagingAssetValue: formatScaled4(packagingAssetUnits),
                finishedGoodsAssetValue: formatScaled4(finishedGoodsAssetUnits),
                purchaseCommittedNetValue: formatScaled4(purchaseCommittedNetUnits),
                purchaseCommittedVatValue: formatScaled4(purchaseCommittedVatUnits),
                purchaseCommittedValue: formatScaled4(purchaseCommittedUnits),
                purchaseReceivedNetValue: formatScaled4(purchaseReceivedNetUnits),
                totalInputVat: formatScaled4(purchaseInputVatUnits),
                purchaseReceivedValue: formatScaled4(purchaseReceivedUnits),
                purchaseOutstandingValue: formatScaled4(purchaseOutstandingUnits),
                totalProductionCost: formatScaled4(totalProductionCostUnits),
                totalBookedRevenue: formatScaled4(totalBookedRevenueUnits),
                totalBookedOutputVat: formatScaled4(totalBookedVatUnits),
                totalBookedBilling: formatScaled4(totalBookedRevenueUnits + totalBookedVatUnits),
                totalDeliveredRevenue: formatScaled4(totalDeliveredRevenueUnits),
                totalOutputVat: formatScaled4(totalOutputVatUnits),
                totalDeliveredBilling: formatScaled4(
                    totalDeliveredRevenueUnits + totalOutputVatUnits,
                ),
                netVatPayable: formatScaled4(netVatPayableUnits),
                totalDeliveredCogs: formatScaled4(totalDeliveredCogsUnits),
                grossProfit: formatScaled4(grossProfitUnits),
                grossMarginPercent: percentString(grossProfitUnits, totalDeliveredRevenueUnits),
                scrapLossValue: formatScaled4(scrapLossUnits),
                adjustmentNetValue: formatScaled4(adjustmentNetUnits),
                costedLotsCount,
                uncostedLotsCount,
            },
            valuationByCategory: ITEM_TYPES.map((itemType) => {
                const bucket = assetByCategory.get(itemType)!;
                return {
                    itemType,
                    itemCount: bucket.itemIds.size,
                    lotCount: bucket.lotIds.size,
                    assetValue: formatScaled4(bucket.valueUnits),
                    sharePercent: percentString(bucket.valueUnits, totalInventoryAssetUnits),
                };
            }),
            valuationByLocation: Array.from(assetByLocation.values())
                .sort((a, b) =>
                    b.valueUnits === a.valueUnits
                        ? a.locationName.localeCompare(b.locationName)
                        : b.valueUnits > a.valueUnits
                          ? 1
                          : -1,
                )
                .map((loc) => ({
                    locationId: loc.locationId,
                    locationCode: loc.locationCode,
                    locationName: loc.locationName,
                    locationType: loc.locationType,
                    itemCount: loc.itemIds.size,
                    lotCount: loc.lotIds.size,
                    assetValue: formatScaled4(loc.valueUnits),
                })),
            lotCosting,
            packingCosting,
            salesCosting,
            purchasingCosting,
            costLedger,
        };
    });
}
