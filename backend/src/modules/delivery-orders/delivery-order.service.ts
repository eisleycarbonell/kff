import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import {
    customers,
    items,
    uoms,
    lots,
    locations,
    salesOrders,
    salesOrderLines,
    deliveryOrders,
    deliveryOrderLines,
    inventoryStock,
    inventoryReservations,
    inventoryTransactions,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import {
    quantityUnits,
    quantityString,
    outstandingReservations,
} from '../inventory-stocks/inventory-stock.rules.ts';
import { requireActiveLocation } from '../locations/location.service.ts';
import { listSalesOrders, lockSalesOrder } from '../sales-orders/sales-order.service.ts';
import type {
    CreateDeliveryOrderInput,
    UpdateDeliveryOrderInput,
    DispatchDeliveryOrderInput,
} from './delivery-order.schema.ts';

type Reader = Pick<typeof db, 'select'>;
type Line = typeof deliveryOrderLines.$inferSelect;
const transit = alias(locations, 'delivery_transit_location');
const fields = {
    deliveryOrderId: deliveryOrders.deliveryOrderId,
    deliveryOrderNumber: deliveryOrders.deliveryOrderNumber,
    salesOrderId: deliveryOrders.salesOrderId,
    salesOrderNumber: salesOrders.salesOrderNumber,
    customerId: salesOrders.customerId,
    customerName: customers.name,
    sourceLocationId: deliveryOrders.sourceLocationId,
    sourceLocationName: locations.name,
    transitLocationId: deliveryOrders.transitLocationId,
    transitLocationName: transit.name,
    deliveryDate: deliveryOrders.deliveryDate,
    status: deliveryOrders.status,
    notes: deliveryOrders.notes,
    dispatchedAt: deliveryOrders.dispatchedAt,
    completedAt: deliveryOrders.completedAt,
    createdBy: deliveryOrders.createdBy,
    updatedBy: deliveryOrders.updatedBy,
    createdAt: deliveryOrders.createdAt,
    updatedAt: deliveryOrders.updatedAt,
};
const query = (database: Reader) =>
    database
        .select(fields)
        .from(deliveryOrders)
        .innerJoin(salesOrders, eq(deliveryOrders.salesOrderId, salesOrders.salesOrderId))
        .innerJoin(customers, eq(salesOrders.customerId, customers.customerId))
        .innerJoin(locations, eq(deliveryOrders.sourceLocationId, locations.locationId))
        .leftJoin(transit, eq(deliveryOrders.transitLocationId, transit.locationId));
async function linesFor(ids: number[], database: Reader) {
    if (!ids.length) return [];
    return database
        .select({
            deliveryOrderLineId: deliveryOrderLines.deliveryOrderLineId,
            deliveryOrderId: deliveryOrderLines.deliveryOrderId,
            salesOrderLineId: deliveryOrderLines.salesOrderLineId,
            itemId: deliveryOrderLines.itemId,
            itemSku: items.sku,
            itemName: items.name,
            lotId: deliveryOrderLines.lotId,
            lotNumber: lots.lotNumber,
            uomId: salesOrderLines.uomId,
            uomName: uoms.name,
            qtyDelivered: deliveryOrderLines.qtyDelivered,
        })
        .from(deliveryOrderLines)
        .innerJoin(
            salesOrderLines,
            eq(deliveryOrderLines.salesOrderLineId, salesOrderLines.salesOrderLineId),
        )
        .innerJoin(items, eq(deliveryOrderLines.itemId, items.itemId))
        .innerJoin(lots, eq(deliveryOrderLines.lotId, lots.lotId))
        .innerJoin(uoms, eq(salesOrderLines.uomId, uoms.uomId))
        .where(inArray(deliveryOrderLines.deliveryOrderId, ids))
        .orderBy(asc(deliveryOrderLines.deliveryOrderLineId));
}
export async function listDeliveryOrders(database: Reader = db) {
    const headers = await query(database).orderBy(
        desc(deliveryOrders.deliveryDate),
        desc(deliveryOrders.deliveryOrderId),
    );
    const lines = await linesFor(
        headers.map((row) => row.deliveryOrderId),
        database,
    );
    return headers.map((header) => ({
        ...header,
        lines: lines.filter((line) => line.deliveryOrderId === header.deliveryOrderId),
    }));
}
export async function getDeliveryOrder(id: number, database: Reader = db) {
    const [header] = await query(database).where(eq(deliveryOrders.deliveryOrderId, id)).limit(1);
    if (!header) return null;
    return { ...header, lines: await linesFor([id], database) };
}
export async function getDeliveryOrderOptions() {
    const [orders, locationRows, stockRows] = await Promise.all([
        listSalesOrders(),
        db
            .select({
                locationId: locations.locationId,
                name: locations.name,
                locationType: locations.locationType,
                isActive: locations.isActive,
            })
            .from(locations)
            .orderBy(asc(locations.name)),
        db
            .select({
                stockId: inventoryStock.stockId,
                itemId: items.itemId,
                itemSku: items.sku,
                itemName: items.name,
                lotId: lots.lotId,
                lotNumber: lots.lotNumber,
                locationId: inventoryStock.locationId,
                qtyOnHand: inventoryStock.qtyOnHand,
                uomId: items.primaryUomId,
                uomName: uoms.name,
                qcStatus: lots.qcStatus,
                expirationDate: lots.expirationDate,
                packingOrderId: lots.packingOrderId,
                qtyReserved: sql<string>`coalesce((select sum(${inventoryReservations.qtyReserved}-${inventoryReservations.qtyConsumed}) from ${inventoryReservations} where ${inventoryReservations.lotId}=${inventoryStock.lotId} and ${inventoryReservations.locationId}=${inventoryStock.locationId} and ${inventoryReservations.releasedAt} is null),0)::numeric(14,4)::text`,
            })
            .from(inventoryStock)
            .innerJoin(items, eq(inventoryStock.itemId, items.itemId))
            .innerJoin(lots, eq(inventoryStock.lotId, lots.lotId))
            .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
            .where(and(eq(items.itemType, 'Finished Good'), eq(items.isActive, true)))
            .orderBy(asc(items.name), asc(lots.lotNumber)),
    ]);
    return {
        salesOrders: orders.filter((order) =>
            ['Confirmed', 'Partially Delivered'].includes(order.status),
        ),
        locations: locationRows,
        stock: stockRows.map((row) => ({
            ...row,
            qtyAvailable: quantityString(
                quantityUnits(row.qtyOnHand) - quantityUnits(row.qtyReserved),
            ),
        })),
    };
}
async function saved(tx: Reader, id: number) {
    const result = await getDeliveryOrder(id, tx);
    if (!result) throw new Error('The saved delivery order could not be loaded.');
    return result;
}
function assertStatus(actual: string, expected: string) {
    if (actual !== expected)
        throw new AppError(409, `This action requires a ${expected.toLowerCase()} delivery order.`);
}
async function observe(tx: Reader, id: number) {
    const [header] = await tx
        .select()
        .from(deliveryOrders)
        .where(eq(deliveryOrders.deliveryOrderId, id))
        .limit(1);
    return header ?? null;
}
async function lockDelivery(tx: Reader, id: number, observedSalesId: number) {
    const [header] = await tx
        .select()
        .from(deliveryOrders)
        .where(eq(deliveryOrders.deliveryOrderId, id))
        .for('update');
    if (header && header.salesOrderId !== observedSalesId)
        throw new AppError(409, 'This delivery changed. Refresh before trying again.');
    return header ?? null;
}
async function lockLines(tx: Reader, id: number) {
    return tx
        .select()
        .from(deliveryOrderLines)
        .where(eq(deliveryOrderLines.deliveryOrderId, id))
        .orderBy(asc(deliveryOrderLines.deliveryOrderLineId))
        .for('update');
}
async function orderLines(tx: Reader, salesOrderId: number) {
    return tx
        .select()
        .from(salesOrderLines)
        .where(eq(salesOrderLines.salesOrderId, salesOrderId))
        .orderBy(asc(salesOrderLines.salesOrderLineId))
        .for('update');
}
async function validateAllocations(
    tx: Reader,
    order: typeof salesOrders.$inferSelect,
    provided: CreateDeliveryOrderInput['lines'],
    excluding?: number,
) {
    if (!['Confirmed', 'Partially Delivered'].includes(order.status))
        throw new AppError(409, 'Select a confirmed sales order with outstanding quantities.');
    const definitions = await orderLines(tx, order.salesOrderId);
    const allocated = await tx
        .select({
            salesOrderLineId: deliveryOrderLines.salesOrderLineId,
            qtyDelivered: deliveryOrderLines.qtyDelivered,
        })
        .from(deliveryOrderLines)
        .innerJoin(
            deliveryOrders,
            eq(deliveryOrderLines.deliveryOrderId, deliveryOrders.deliveryOrderId),
        )
        .where(
            and(
                eq(deliveryOrders.salesOrderId, order.salesOrderId),
                inArray(deliveryOrders.status, ['Draft', 'In Transit']),
                excluding === undefined ? undefined : ne(deliveryOrders.deliveryOrderId, excluding),
            ),
        );
    const totals = new Map<number, bigint>();
    for (const row of [...allocated, ...provided])
        totals.set(
            row.salesOrderLineId,
            (totals.get(row.salesOrderLineId) ?? 0n) + quantityUnits(row.qtyDelivered),
        );
    const mapped = provided.map((line) => {
        const definition = definitions.find(
            (row) => row.salesOrderLineId === line.salesOrderLineId,
        );
        if (!definition)
            throw new AppError(400, 'Every delivery line must belong to the selected sales order.');
        if (
            (totals.get(line.salesOrderLineId) ?? 0n) >
            quantityUnits(definition.qtyOrdered) - quantityUnits(definition.qtyDelivered)
        )
            throw new AppError(
                409,
                'Delivery quantities exceed the unallocated sales-order quantity. Refresh the order.',
            );
        return { ...line, itemId: definition.itemId };
    });
    return mapped;
}
async function lockParents(tx: Reader, lines: Pick<Line, 'itemId' | 'lotId'>[], eligible: boolean) {
    const itemIds = [...new Set(lines.map((line) => line.itemId))].sort((a, b) => a - b);
    const lotIds = [...new Set(lines.map((line) => line.lotId))].sort((a, b) => a - b);
    if (!lines.length || lotIds.length !== lines.length)
        throw new AppError(400, 'Add each selected lot only once.');
    const products = await tx
        .select()
        .from(items)
        .where(inArray(items.itemId, itemIds))
        .orderBy(asc(items.itemId))
        .for('share');
    const batches = await tx
        .select()
        .from(lots)
        .where(inArray(lots.lotId, lotIds))
        .orderBy(asc(lots.lotId))
        .for('update');
    const today = new Date().toISOString().slice(0, 10);
    for (const line of lines) {
        const item = products.find((row) => row.itemId === line.itemId),
            lot = batches.find((row) => row.lotId === line.lotId);
        if (!item || !lot || lot.itemId !== line.itemId)
            throw new AppError(400, 'The selected lot does not belong to its sales item.');
        if (
            eligible &&
            (!item.isActive ||
                item.itemType !== 'Finished Good' ||
                !lot.packingOrderId ||
                lot.qcStatus !== 'Approved' ||
                (lot.expirationDate !== null && lot.expirationDate <= today))
        )
            throw new AppError(
                409,
                'Dispatch requires active finished goods with approved, unexpired lots traceable to packing orders.',
            );
    }
    return lotIds;
}
async function lockLocations(tx: Reader, sourceId: number, transitId?: number) {
    if (sourceId === transitId)
        throw new AppError(400, 'Source and In Transit locations must be different.');
    const ids = [sourceId, ...(transitId ? [transitId] : [])].sort((a, b) => a - b);
    for (const id of ids) await requireActiveLocation(tx, id);
    const rows = await tx.select().from(locations).where(inArray(locations.locationId, ids));
    if (
        !['Warehouse', 'Branch', 'Store'].includes(
            rows.find((row) => row.locationId === sourceId)?.locationType ?? '',
        )
    )
        throw new AppError(400, 'Select an active warehouse, branch, or store as the source.');
    if (
        transitId &&
        rows.find((row) => row.locationId === transitId)?.locationType !== 'In Transit'
    )
        throw new AppError(400, 'Select an active In Transit location.');
}
async function lockStock(tx: Reader, lotIds: number[], locationIds: number[]) {
    const balances = await tx
        .select()
        .from(inventoryStock)
        .where(
            and(
                inArray(inventoryStock.lotId, lotIds),
                inArray(inventoryStock.locationId, locationIds),
            ),
        )
        .orderBy(asc(inventoryStock.lotId), asc(inventoryStock.locationId))
        .for('update');
    const reservations = await tx
        .select()
        .from(inventoryReservations)
        .where(
            and(
                inArray(inventoryReservations.lotId, lotIds),
                inArray(inventoryReservations.locationId, locationIds),
                isNull(inventoryReservations.releasedAt),
            ),
        )
        .orderBy(asc(inventoryReservations.reservationId))
        .for('update');
    return { balances, reservations };
}
async function validateDraft(
    tx: Reader,
    order: typeof salesOrders.$inferSelect,
    input: Pick<CreateDeliveryOrderInput, 'lines' | 'sourceLocationId' | 'deliveryDate'>,
    excluding?: number,
) {
    if (input.deliveryDate < order.orderDate)
        throw new AppError(400, 'Delivery date cannot precede the sales-order date.');
    const lines = await validateAllocations(tx, order, input.lines, excluding);
    const lotIds = await lockParents(tx, lines, true);
    await lockLocations(tx, input.sourceLocationId);
    const { balances } = await lockStock(tx, lotIds, [input.sourceLocationId]);
    for (const line of lines)
        if (
            !balances.some(
                (row) =>
                    row.lotId === line.lotId &&
                    row.itemId === line.itemId &&
                    quantityUnits(row.qtyOnHand) > 0n,
            )
        )
            throw new AppError(409, 'The selected lot has no stock at the source location.');
    return lines;
}
export async function createDeliveryOrder(
    input: CreateDeliveryOrderInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const order = await lockSalesOrder(tx, input.salesOrderId);
        if (!order) throw new AppError(404, 'Sales order not found.');
        const lines = await validateDraft(tx, order, input);
        const { lines: _, ...header } = input;
        const [created] = await tx
            .insert(deliveryOrders)
            .values({ ...header, createdBy: actorId, updatedBy: actorId })
            .returning({ id: deliveryOrders.deliveryOrderId });
        if (!created) throw new Error('The delivery order could not be created.');
        await tx.insert(deliveryOrderLines).values(
            lines.map((line) => ({
                ...line,
                deliveryOrderId: created.id,
                createdBy: actorId,
                updatedBy: actorId,
            })),
        );
        return saved(tx, created.id);
    });
}
export async function updateDeliveryOrder(
    id: number,
    input: UpdateDeliveryOrderInput,
    actorId: number,
    database: typeof db = db,
) {
    const observed = await observe(database, id);
    if (!observed) return null;
    return database.transaction(async (tx) => {
        const ids = [
            ...new Set([observed.salesOrderId, input.salesOrderId ?? observed.salesOrderId]),
        ].sort((a, b) => a - b);
        const orders = [];
        for (const orderId of ids) {
            const order = await lockSalesOrder(tx, orderId);
            if (order) orders.push(order);
        }
        const header = await lockDelivery(tx, id, observed.salesOrderId);
        if (!header) return null;
        assertStatus(header.status, 'Draft');
        const currentLines = await lockLines(tx, id);
        const order = orders.find(
            (row) => row.salesOrderId === (input.salesOrderId ?? header.salesOrderId),
        );
        if (!order) throw new AppError(404, 'Sales order not found.');
        const lines = await validateDraft(
            tx,
            order,
            {
                lines: input.lines ?? currentLines,
                sourceLocationId: input.sourceLocationId ?? header.sourceLocationId,
                deliveryDate: input.deliveryDate ?? header.deliveryDate,
            },
            id,
        );
        const { lines: _, ...changes } = input;
        await tx
            .update(deliveryOrders)
            .set({ ...changes, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(deliveryOrders.deliveryOrderId, id));
        if (input.lines) {
            await tx.delete(deliveryOrderLines).where(eq(deliveryOrderLines.deliveryOrderId, id));
            await tx.insert(deliveryOrderLines).values(
                lines.map((line) => ({
                    ...line,
                    deliveryOrderId: id,
                    createdBy: actorId,
                    updatedBy: actorId,
                })),
            );
        }
        return saved(tx, id);
    });
}
export async function dispatchDeliveryOrder(
    id: number,
    input: DispatchDeliveryOrderInput,
    actorId: number,
    database: typeof db = db,
) {
    const observed = await observe(database, id);
    if (!observed) return null;
    return database.transaction(async (tx) => {
        const order = await lockSalesOrder(tx, observed.salesOrderId);
        if (!order) throw new AppError(404, 'Sales order not found.');
        const header = await lockDelivery(tx, id, observed.salesOrderId);
        if (!header) return null;
        assertStatus(header.status, 'Draft');
        const lines = await lockLines(tx, id);
        await validateAllocations(tx, order, lines, id);
        const lotIds = await lockParents(tx, lines, true);
        await lockLocations(tx, header.sourceLocationId, input.transitLocationId);
        const context = await lockStock(tx, lotIds, [
            header.sourceLocationId,
            input.transitLocationId,
        ]);
        const now = new Date(),
            balances: (typeof inventoryStock.$inferInsert)[] = [],
            ledger: (typeof inventoryTransactions.$inferInsert)[] = [],
            reservations: (typeof inventoryReservations.$inferInsert)[] = [];
        for (const line of lines) {
            const amount = quantityUnits(line.qtyDelivered),
                source = context.balances.find(
                    (row) => row.lotId === line.lotId && row.locationId === header.sourceLocationId,
                ),
                target = context.balances.find(
                    (row) => row.lotId === line.lotId && row.locationId === input.transitLocationId,
                );
            const reserved = quantityUnits(
                outstandingReservations(
                    context.reservations.filter(
                        (row) =>
                            row.lotId === line.lotId && row.locationId === header.sourceLocationId,
                    ),
                ),
            );
            if (!source || amount <= 0n || quantityUnits(source.qtyOnHand) - reserved < amount)
                throw new AppError(
                    409,
                    'Not enough available source stock. Refresh stock and adjust the draft delivery.',
                );
            const destination = quantityUnits(target?.qtyOnHand ?? '0') + amount;
            if (destination > 99999999999999n)
                throw new AppError(409, 'Transit stock would exceed the supported quantity limit.');
            balances.push(
                {
                    itemId: line.itemId,
                    lotId: line.lotId,
                    locationId: header.sourceLocationId,
                    qtyOnHand: quantityString(quantityUnits(source.qtyOnHand) - amount),
                    lastUpdated: now,
                },
                {
                    itemId: line.itemId,
                    lotId: line.lotId,
                    locationId: input.transitLocationId,
                    qtyOnHand: quantityString(destination),
                    lastUpdated: now,
                },
            );
            for (const [locationId, quantity] of [
                [header.sourceLocationId, -amount],
                [input.transitLocationId, amount],
            ] as const)
                ledger.push({
                    itemId: line.itemId,
                    lotId: line.lotId,
                    locationId,
                    qtyChange: quantityString(quantity),
                    transactionType: 'Transfer',
                    deliveryOrderLineId: line.deliveryOrderLineId,
                    referenceId: header.deliveryOrderNumber,
                    authorizedByUserId: actorId,
                });
            reservations.push({
                deliveryOrderLineId: line.deliveryOrderLineId,
                itemId: line.itemId,
                lotId: line.lotId,
                locationId: input.transitLocationId,
                qtyReserved: line.qtyDelivered,
                createdBy: actorId,
                updatedBy: actorId,
            });
        }
        await tx
            .insert(inventoryStock)
            .values(balances)
            .onConflictDoUpdate({
                target: [inventoryStock.lotId, inventoryStock.locationId],
                set: { qtyOnHand: sql`excluded.qty_on_hand`, lastUpdated: now },
            });
        await tx.insert(inventoryTransactions).values(ledger);
        await tx.insert(inventoryReservations).values(reservations);
        await tx
            .update(deliveryOrders)
            .set({
                status: 'In Transit',
                transitLocationId: input.transitLocationId,
                dispatchedAt: now,
                updatedBy: actorId,
                updatedAt: now,
            })
            .where(eq(deliveryOrders.deliveryOrderId, id));
        return saved(tx, id);
    });
}
export async function completeDeliveryOrder(id: number, actorId: number, database: typeof db = db) {
    const observed = await observe(database, id);
    if (!observed) return null;
    return database.transaction(async (tx) => {
        const order = await lockSalesOrder(tx, observed.salesOrderId);
        if (!order) throw new AppError(404, 'Sales order not found.');
        if (!['Confirmed', 'Partially Delivered'].includes(order.status))
            throw new AppError(409, 'This sales order is no longer open for fulfillment.');
        const header = await lockDelivery(tx, id, observed.salesOrderId);
        if (!header) return null;
        assertStatus(header.status, 'In Transit');
        if (!header.transitLocationId)
            throw new AppError(409, 'The delivery has no original In Transit location.');
        const definitions = await orderLines(tx, order.salesOrderId),
            lines = await lockLines(tx, id);
        const lotIds = await lockParents(tx, lines, false);
        await lockLocations(tx, header.sourceLocationId, header.transitLocationId);
        const context = await lockStock(tx, lotIds, [header.transitLocationId]);
        const now = new Date(),
            totals = new Map<number, bigint>();
        for (const line of lines) {
            const amount = quantityUnits(line.qtyDelivered),
                stock = context.balances.find((row) => row.lotId === line.lotId);
            const reservation = context.reservations.find(
                (row) => row.deliveryOrderLineId === line.deliveryOrderLineId,
            );
            const otherReserved = quantityUnits(
                outstandingReservations(
                    context.reservations.filter(
                        (row) =>
                            row.lotId === line.lotId &&
                            row.deliveryOrderLineId !== line.deliveryOrderLineId,
                    ),
                ),
            );
            if (
                !stock ||
                !reservation ||
                reservation.lotId !== line.lotId ||
                reservation.itemId !== line.itemId ||
                quantityUnits(reservation.qtyReserved) - quantityUnits(reservation.qtyConsumed) !==
                    amount ||
                quantityUnits(stock.qtyOnHand) - otherReserved < amount
            )
                throw new AppError(
                    409,
                    'The delivery transit balance or protected shipment allocation is inconsistent.',
                );
            await tx
                .update(inventoryStock)
                .set({
                    qtyOnHand: quantityString(quantityUnits(stock.qtyOnHand) - amount),
                    lastUpdated: now,
                })
                .where(eq(inventoryStock.stockId, stock.stockId));
            await tx.insert(inventoryTransactions).values({
                itemId: line.itemId,
                lotId: line.lotId,
                locationId: header.transitLocationId,
                qtyChange: quantityString(-amount),
                transactionType: 'Sale',
                deliveryOrderLineId: line.deliveryOrderLineId,
                referenceId: header.deliveryOrderNumber,
                authorizedByUserId: actorId,
            });
            await tx
                .update(inventoryReservations)
                .set({
                    qtyConsumed: reservation.qtyReserved,
                    releasedAt: now,
                    updatedBy: actorId,
                    updatedAt: now,
                })
                .where(eq(inventoryReservations.reservationId, reservation.reservationId));
            totals.set(line.salesOrderLineId, (totals.get(line.salesOrderLineId) ?? 0n) + amount);
        }
        let complete = true;
        for (const line of definitions) {
            const delivered =
                quantityUnits(line.qtyDelivered) + (totals.get(line.salesOrderLineId) ?? 0n);
            if (delivered > quantityUnits(line.qtyOrdered))
                throw new AppError(409, 'Delivery exceeds the outstanding sales order.');
            if (delivered !== quantityUnits(line.qtyOrdered)) complete = false;
            if (totals.has(line.salesOrderLineId))
                await tx
                    .update(salesOrderLines)
                    .set({
                        qtyDelivered: quantityString(delivered),
                        updatedBy: actorId,
                        updatedAt: now,
                    })
                    .where(eq(salesOrderLines.salesOrderLineId, line.salesOrderLineId));
        }
        await tx
            .update(salesOrders)
            .set({
                status: complete ? 'Completed' : 'Partially Delivered',
                updatedBy: actorId,
                updatedAt: now,
            })
            .where(eq(salesOrders.salesOrderId, order.salesOrderId));
        await tx
            .update(deliveryOrders)
            .set({ status: 'Completed', completedAt: now, updatedBy: actorId, updatedAt: now })
            .where(eq(deliveryOrders.deliveryOrderId, id));
        return saved(tx, id);
    });
}
export async function cancelDeliveryOrder(id: number, actorId: number, database: typeof db = db) {
    const observed = await observe(database, id);
    if (!observed) return null;
    return database.transaction(async (tx) => {
        await lockSalesOrder(tx, observed.salesOrderId);
        const header = await lockDelivery(tx, id, observed.salesOrderId);
        if (!header) return null;
        assertStatus(header.status, 'Draft');
        await tx
            .update(deliveryOrders)
            .set({ status: 'Cancelled', updatedBy: actorId, updatedAt: new Date() })
            .where(eq(deliveryOrders.deliveryOrderId, id));
        return saved(tx, id);
    });
}
