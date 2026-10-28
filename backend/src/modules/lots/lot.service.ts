import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
    lots,
    items,
    uoms,
    suppliers,
    purchaseOrders,
    purchaseOrderLines,
    packingOrders,
    inventoryStock,
    inventoryReservations,
    inventoryTransactions,
    locations,
} from '../../db/schema.ts';
import type { UpdateLotInput } from './lot.schema.ts';
import { assertLotMetadataChange, lotQuantityString, lotQuantityUnits } from './lot.rules.ts';

type Reader = Pick<typeof db, 'select'>;
const onHand = sql`coalesce((select sum(${inventoryStock.qtyOnHand}) from ${inventoryStock} where ${inventoryStock.lotId}=${lots.lotId}),0)`;
const reserved = sql`coalesce((select sum(${inventoryReservations.qtyReserved}-${inventoryReservations.qtyConsumed}) from ${inventoryReservations} where ${inventoryReservations.lotId}=${lots.lotId} and ${inventoryReservations.releasedAt} is null),0)`;
const lotFields = {
    lotId: lots.lotId,
    lotNumber: lots.lotNumber,
    supplierLotNumber: lots.supplierLotNumber,
    itemId: lots.itemId,
    itemSku: items.sku,
    itemName: items.name,
    itemType: items.itemType,
    primaryUomId: items.primaryUomId,
    primaryUomName: uoms.name,
    manufactureDate: lots.manufactureDate,
    expirationDate: lots.expirationDate,
    qcStatus: lots.qcStatus,
    unitCost: lots.unitCost,
    poLineId: lots.poLineId,
    poId: purchaseOrders.poId,
    poNumber: purchaseOrders.poNumber,
    supplierId: suppliers.supplierId,
    supplierName: suppliers.name,
    packingOrderId: lots.packingOrderId,
    packingOrderNumber: packingOrders.packingOrderNumber,
    sourceType: sql<
        'Purchased' | 'Packed' | 'Opening Balance'
    >`case when ${lots.poLineId} is not null then 'Purchased' when ${lots.packingOrderId} is not null then 'Packed' else 'Opening Balance' end`,
    qtyOnHand: sql<string>`${onHand}::text`,
    qtyReserved: sql<string>`${reserved}::text`,
    qtyAvailable: sql<string>`(${onHand}-${reserved})::text`,
    locationCount: sql<number>`(select count(*) from ${inventoryStock} where ${inventoryStock.lotId}=${lots.lotId})::integer`,
    createdBy: lots.createdBy,
    createdAt: lots.createdAt,
    updatedBy: lots.updatedBy,
    updatedAt: lots.updatedAt,
};
const lotQuery = (database: Reader) =>
    database
        .select(lotFields)
        .from(lots)
        .innerJoin(items, eq(lots.itemId, items.itemId))
        .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
        .leftJoin(purchaseOrderLines, eq(lots.poLineId, purchaseOrderLines.poLineId))
        .leftJoin(purchaseOrders, eq(purchaseOrderLines.poId, purchaseOrders.poId))
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.supplierId))
        .leftJoin(packingOrders, eq(lots.packingOrderId, packingOrders.packingOrderId));
const normalized = <T extends { qtyOnHand: string; qtyReserved: string; qtyAvailable: string }>(
    row: T,
) => ({
    ...row,
    qtyOnHand: lotQuantityString(lotQuantityUnits(row.qtyOnHand)),
    qtyReserved: lotQuantityString(lotQuantityUnits(row.qtyReserved)),
    qtyAvailable: lotQuantityString(lotQuantityUnits(row.qtyAvailable)),
});

export async function listLots(database: Reader = db) {
    const rows = await lotQuery(database).orderBy(desc(lots.createdAt), desc(lots.lotId));
    return rows.map(normalized);
}
export async function getLot(id: number, database: Reader = db) {
    const [row] = await lotQuery(database).where(eq(lots.lotId, id)).limit(1);
    if (!row) return null;
    const stockReserved = sql`coalesce((select sum(${inventoryReservations.qtyReserved}-${inventoryReservations.qtyConsumed}) from ${inventoryReservations} where ${inventoryReservations.lotId}=${inventoryStock.lotId} and ${inventoryReservations.locationId}=${inventoryStock.locationId} and ${inventoryReservations.releasedAt} is null),0)`;
    const [stocks, transactions] = await Promise.all([
        database
            .select({
                stockId: inventoryStock.stockId,
                locationId: locations.locationId,
                locationCode: locations.code,
                locationName: locations.name,
                locationType: locations.locationType,
                locationIsActive: locations.isActive,
                qtyOnHand: inventoryStock.qtyOnHand,
                qtyReserved: sql<string>`${stockReserved}::text`,
                qtyAvailable: sql<string>`(${inventoryStock.qtyOnHand}-${stockReserved})::text`,
                lastUpdated: inventoryStock.lastUpdated,
            })
            .from(inventoryStock)
            .innerJoin(locations, eq(inventoryStock.locationId, locations.locationId))
            .where(eq(inventoryStock.lotId, id))
            .orderBy(asc(locations.name), asc(inventoryStock.stockId)),
        database
            .select({
                transactionId: inventoryTransactions.transactionId,
                locationId: locations.locationId,
                locationCode: locations.code,
                locationName: locations.name,
                qtyChange: inventoryTransactions.qtyChange,
                transactionType: inventoryTransactions.transactionType,
                poLineId: inventoryTransactions.poLineId,
                packingOrderId: inventoryTransactions.packingOrderId,
                transferLineId: inventoryTransactions.transferLineId,
                referenceId: inventoryTransactions.referenceId,
                authorizedByUserId: inventoryTransactions.authorizedByUserId,
                createdAt: inventoryTransactions.createdAt,
            })
            .from(inventoryTransactions)
            .innerJoin(locations, eq(inventoryTransactions.locationId, locations.locationId))
            .where(eq(inventoryTransactions.lotId, id))
            .orderBy(
                desc(inventoryTransactions.createdAt),
                desc(inventoryTransactions.transactionId),
            ),
    ]);
    return { ...normalized(row), stocks: stocks.map(normalized), transactions };
}
export async function updateLot(
    id: number,
    input: UpdateLotInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const [current] = await tx
            .select({
                manufactureDate: lots.manufactureDate,
                expirationDate: lots.expirationDate,
                qcStatus: lots.qcStatus,
            })
            .from(lots)
            .where(eq(lots.lotId, id))
            .for('update');
        if (!current) return null;
        // Parent lot first, then reservations: matches inventory writers and blocks concurrent new FK references.
        const reservations = await tx
            .select({
                qtyReserved: inventoryReservations.qtyReserved,
                qtyConsumed: inventoryReservations.qtyConsumed,
                releasedAt: inventoryReservations.releasedAt,
            })
            .from(inventoryReservations)
            .where(eq(inventoryReservations.lotId, id))
            .orderBy(asc(inventoryReservations.reservationId))
            .for('update');
        const outstanding = reservations.reduce(
            (sum, row) =>
                sum +
                (row.releasedAt
                    ? 0n
                    : lotQuantityUnits(row.qtyReserved) - lotQuantityUnits(row.qtyConsumed)),
            0n,
        );
        const next = {
            manufactureDate:
                input.manufactureDate === undefined
                    ? current.manufactureDate
                    : input.manufactureDate,
            expirationDate:
                input.expirationDate === undefined ? current.expirationDate : input.expirationDate,
            qcStatus: input.qcStatus ?? current.qcStatus,
        };
        assertLotMetadataChange(current, next, outstanding);
        await tx
            .update(lots)
            .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(lots.lotId, id));
        return getLot(id, tx);
    });
}
