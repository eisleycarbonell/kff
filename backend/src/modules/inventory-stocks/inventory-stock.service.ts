import { requireActiveLocation } from '../locations/location.service.ts';
import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
    inventoryStock,
    inventoryReservations,
    inventoryTransactions,
    items,
    lots,
    locations,
    uoms,
    scrapReasonCodes,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type { StockQuery, StockAdjustmentInput } from './inventory-stock.schema.ts';
import { outstandingReservations, planStockAdjustment } from './inventory-stock.rules.ts';

// Use the active lot/location index; correlated aggregation avoids multiplying
// balances when a lot has several reservations or stock in several locations.
const reserved = sql`coalesce((
    select sum(${inventoryReservations.qtyReserved} - ${inventoryReservations.qtyConsumed})
    from ${inventoryReservations}
    where ${inventoryReservations.itemId} = ${inventoryStock.itemId}
      and ${inventoryReservations.lotId} = ${inventoryStock.lotId}
      and ${inventoryReservations.locationId} = ${inventoryStock.locationId}
      and ${inventoryReservations.releasedAt} is null
), 0)`;
const fields = {
    stockId: inventoryStock.stockId,
    itemId: inventoryStock.itemId,
    sku: items.sku,
    itemName: items.name,
    itemType: items.itemType,
    primaryUomId: items.primaryUomId,
    primaryUomName: uoms.name,
    lotId: inventoryStock.lotId,
    lotNumber: lots.lotNumber,
    supplierLotNumber: lots.supplierLotNumber,
    manufactureDate: lots.manufactureDate,
    expirationDate: lots.expirationDate,
    qcStatus: lots.qcStatus,
    lotUnitCost: lots.unitCost,
    locationId: inventoryStock.locationId,
    locationCode: locations.code,
    locationName: locations.name,
    locationType: locations.locationType,
    qtyOnHand: inventoryStock.qtyOnHand,
    qtyReserved: sql<string>`${reserved}::text`,
    qtyAvailable: sql<string>`(${inventoryStock.qtyOnHand} - ${reserved})::text`,
    lastUpdated: inventoryStock.lastUpdated,
};
type Reader = Pick<typeof db, 'select'>;
const stockQuery = (database: Reader = db) =>
    database
        .select(fields)
        .from(inventoryStock)
        .innerJoin(items, eq(inventoryStock.itemId, items.itemId))
        .innerJoin(lots, eq(inventoryStock.lotId, lots.lotId))
        .innerJoin(locations, eq(inventoryStock.locationId, locations.locationId))
        .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId));
export async function listStocks(query: StockQuery = {}) {
    const filters: SQL[] = [];
    if (query.itemId) filters.push(eq(inventoryStock.itemId, query.itemId));
    if (query.lotId) filters.push(eq(inventoryStock.lotId, query.lotId));
    if (query.locationId) filters.push(eq(inventoryStock.locationId, query.locationId));
    if (query.qcStatus) filters.push(eq(lots.qcStatus, query.qcStatus));
    if (query.availability === 'available')
        filters.push(sql`${inventoryStock.qtyOnHand} > ${reserved}`);
    if (query.availability === 'unavailable')
        filters.push(sql`${inventoryStock.qtyOnHand} <= ${reserved}`);
    return stockQuery()
        .where(and(...filters))
        .orderBy(
            asc(items.name),
            asc(locations.name),
            asc(lots.lotNumber),
            asc(inventoryStock.stockId),
        );
}
export async function getStock(
    id: number,
    database: Reader = db,
): Promise<Awaited<ReturnType<typeof listStocks>>[number] | null> {
    const [stock] = await stockQuery(database).where(eq(inventoryStock.stockId, id)).limit(1);
    return stock ?? null;
}
export async function listStockOptions() {
    const [lotOptions, locationOptions, reasons] = await Promise.all([
        db
            .select({
                lotId: lots.lotId,
                lotNumber: lots.lotNumber,
                itemId: items.itemId,
                itemName: items.name,
                sku: items.sku,
                primaryUomName: uoms.name,
            })
            .from(lots)
            .innerJoin(items, eq(lots.itemId, items.itemId))
            .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
            .orderBy(asc(items.name), asc(lots.lotNumber)),
        db
            .select({
                locationId: locations.locationId,
                name: locations.name,
                code: locations.code,
                locationType: locations.locationType,
                isActive: locations.isActive,
            })
            .from(locations)
            .orderBy(asc(locations.name)),
        db
            .select({
                reasonId: scrapReasonCodes.reasonId,
                codeName: scrapReasonCodes.codeName,
                description: scrapReasonCodes.description,
            })
            .from(scrapReasonCodes)
            .where(eq(scrapReasonCodes.category, 'Inventory Adjustment'))
            .orderBy(asc(scrapReasonCodes.codeName)),
    ]);
    return { lots: lotOptions, locations: locationOptions, reasons };
}
export async function recordStockAdjustment(input: StockAdjustmentInput, actorId: number) {
    return db.transaction(async (tx) => {
        // Lock the parent lot first. FK checks for concurrent reservation/stock
        // inserts wait for this lock; existing reservation rows are locked below.
        const [lot] = await tx
            .select({ itemId: lots.itemId })
            .from(lots)
            .where(eq(lots.lotId, input.lotId))
            .for('update');
        if (!lot)
            throw new AppError(
                400,
                'Select an existing lot. Receive or create the lot through its source workflow first.',
            );
        await requireActiveLocation(tx, input.locationId);
        const [reason] = await tx
            .select({ id: scrapReasonCodes.reasonId })
            .from(scrapReasonCodes)
            .where(
                and(
                    eq(scrapReasonCodes.reasonId, input.reasonId),
                    eq(scrapReasonCodes.category, 'Inventory Adjustment'),
                ),
            )
            .limit(1);
        if (!reason) throw new AppError(400, 'Select an inventory adjustment reason.');
        // A count can establish a new balance for an existing lot/location.
        // The initial zero row rolls back if any subsequent check/write fails.
        await tx
            .insert(inventoryStock)
            .values({
                itemId: lot.itemId,
                lotId: input.lotId,
                locationId: input.locationId,
                qtyOnHand: '0',
            })
            .onConflictDoNothing({ target: [inventoryStock.lotId, inventoryStock.locationId] });
        const [current] = await tx
            .select()
            .from(inventoryStock)
            .where(
                and(
                    eq(inventoryStock.lotId, input.lotId),
                    eq(inventoryStock.locationId, input.locationId),
                ),
            )
            .for('update');
        if (!current) throw new Error('Stock balance could not be loaded.');
        // Lock released rows too so a concurrent change cannot reactivate a
        // reservation while this counted balance is being checked.
        const reservations = await tx
            .select({
                qtyReserved: inventoryReservations.qtyReserved,
                qtyConsumed: inventoryReservations.qtyConsumed,
                releasedAt: inventoryReservations.releasedAt,
            })
            .from(inventoryReservations)
            .where(
                and(
                    eq(inventoryReservations.itemId, lot.itemId),
                    eq(inventoryReservations.lotId, input.lotId),
                    eq(inventoryReservations.locationId, input.locationId),
                ),
            )
            .orderBy(asc(inventoryReservations.reservationId))
            .for('update');
        const qtyChange = planStockAdjustment(
            current.qtyOnHand,
            outstandingReservations(reservations),
            input.expectedQtyOnHand,
            input.qtyOnHand,
        );
        await tx
            .update(inventoryStock)
            .set({ qtyOnHand: input.qtyOnHand, lastUpdated: new Date() })
            .where(eq(inventoryStock.stockId, current.stockId));
        const [entry] = await tx
            .insert(inventoryTransactions)
            .values({
                itemId: lot.itemId,
                lotId: input.lotId,
                locationId: input.locationId,
                qtyChange,
                transactionType: 'Adjustment',
                reasonId: input.reasonId,
                referenceId: input.referenceId,
                authorizedByUserId: actorId,
            })
            .returning({ transactionId: inventoryTransactions.transactionId });
        if (!entry) throw new Error('Stock adjustment could not be recorded.');
        const stock = await getStock(current.stockId, tx);
        if (!stock) throw new Error('Updated stock could not be loaded.');
        return { stock, transactionId: entry.transactionId, qtyChange };
    });
}
