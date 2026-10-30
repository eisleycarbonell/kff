import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import {
    inventoryReservations,
    inventoryStock,
    inventoryTransactions,
    items,
    locations,
    lots,
    stockTransferLines,
    stockTransfers,
    uoms,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import { requireActiveLocation } from '../locations/location.service.ts';
import {
    quantityString,
    quantityUnits,
    outstandingReservations,
} from '../inventory-stocks/inventory-stock.rules.ts';
import type {
    CreateTransferInput,
    UpdateTransferInput,
    DispatchTransferInput,
    ReceiveTransferInput,
} from './transfer.schema.ts';

type Reader = Pick<typeof db, 'select'>;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Line = typeof stockTransferLines.$inferSelect;
const source = alias(locations, 'transfer_source');
const destination = alias(locations, 'transfer_destination');
const zero = '0.0000';
const maxQuantity = 99_999_999_999_999n;
const today = () => new Date().toISOString().slice(0, 10);
const transitId = sql<number | null>`(
    select min(t.location_id) from inventory_transactions t
    join stock_transfer_lines l on l.transfer_line_id=t.transfer_line_id
    join locations p on p.location_id=t.location_id
    where l.transfer_id=${stockTransfers.transferId} and t.transaction_type='Transfer'
        and t.qty_change>0 and p.location_type='In Transit'
)`;
const headerFields = {
    transferId: stockTransfers.transferId,
    transferNumber: stockTransfers.transferNumber,
    sourceLocationId: stockTransfers.sourceLocationId,
    sourceLocationCode: source.code,
    sourceLocationName: source.name,
    destinationLocationId: stockTransfers.destinationLocationId,
    destinationLocationCode: destination.code,
    destinationLocationName: destination.name,
    status: stockTransfers.status,
    requestedAt: stockTransfers.requestedAt,
    dispatchedAt: stockTransfers.dispatchedAt,
    receivedAt: stockTransfers.receivedAt,
    notes: stockTransfers.notes,
    createdBy: stockTransfers.createdBy,
    createdAt: stockTransfers.createdAt,
    updatedBy: stockTransfers.updatedBy,
    updatedAt: stockTransfers.updatedAt,
    lineCount: sql<number>`(select count(*)::integer from ${stockTransferLines} where ${stockTransferLines.transferId}=${stockTransfers.transferId})`,
    transitLocationId: transitId,
};
const headerQuery = (database: Reader) =>
    database
        .select(headerFields)
        .from(stockTransfers)
        .innerJoin(source, eq(stockTransfers.sourceLocationId, source.locationId))
        .innerJoin(destination, eq(stockTransfers.destinationLocationId, destination.locationId));

export async function listTransfers(database: Reader = db) {
    return headerQuery(database).orderBy(
        desc(stockTransfers.createdAt),
        desc(stockTransfers.transferId),
    );
}
export async function getTransfer(id: number, database: Reader = db) {
    const [header] = await headerQuery(database).where(eq(stockTransfers.transferId, id)).limit(1);
    if (!header) return null;
    const lines = await database
        .select({
            transferLineId: stockTransferLines.transferLineId,
            itemId: stockTransferLines.itemId,
            itemSku: items.sku,
            itemName: items.name,
            lotId: stockTransferLines.lotId,
            lotNumber: lots.lotNumber,
            packingOrderId: lots.packingOrderId,
            primaryUomId: items.primaryUomId,
            primaryUomName: uoms.name,
            qtyRequested: stockTransferLines.qtyRequested,
            qtyShipped: stockTransferLines.qtyShipped,
            qtyReceived: stockTransferLines.qtyReceived,
            qtyOutstanding: sql<string>`(${stockTransferLines.qtyShipped}-${stockTransferLines.qtyReceived})::numeric(14,4)::text`,
            expirationDate: lots.expirationDate,
            qcStatus: lots.qcStatus,
        })
        .from(stockTransferLines)
        .innerJoin(items, eq(stockTransferLines.itemId, items.itemId))
        .innerJoin(lots, eq(stockTransferLines.lotId, lots.lotId))
        .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
        .where(eq(stockTransferLines.transferId, id))
        .orderBy(asc(stockTransferLines.transferLineId));
    return { ...header, lines };
}
const activeReserved = sql`coalesce((select sum(${inventoryReservations.qtyReserved}-${inventoryReservations.qtyConsumed})
    from ${inventoryReservations} where ${inventoryReservations.lotId}=${inventoryStock.lotId}
    and ${inventoryReservations.locationId}=${inventoryStock.locationId}
    and ${inventoryReservations.releasedAt} is null),0)`;
export async function getTransferOptions(database: Reader = db) {
    const locationRows = await database
        .select({
            locationId: locations.locationId,
            code: locations.code,
            name: locations.name,
            locationType: locations.locationType,
        })
        .from(locations)
        .where(
            and(
                eq(locations.isActive, true),
                inArray(locations.locationType, ['Warehouse', 'Branch', 'Store', 'In Transit']),
            ),
        )
        .orderBy(asc(locations.name), asc(locations.locationId));
    const stock = await database
        .select({
            itemId: items.itemId,
            itemSku: items.sku,
            itemName: items.name,
            lotId: lots.lotId,
            lotNumber: lots.lotNumber,
            packingOrderId: lots.packingOrderId,
            locationId: inventoryStock.locationId,
            primaryUomId: items.primaryUomId,
            primaryUomName: uoms.name,
            qtyOnHand: inventoryStock.qtyOnHand,
            qtyReserved: sql<string>`${activeReserved}::numeric(14,4)::text`,
            qtyAvailable: sql<string>`(${inventoryStock.qtyOnHand}-${activeReserved})::numeric(14,4)::text`,
            expirationDate: lots.expirationDate,
            qcStatus: lots.qcStatus,
        })
        .from(inventoryStock)
        .innerJoin(items, eq(inventoryStock.itemId, items.itemId))
        .innerJoin(lots, eq(inventoryStock.lotId, lots.lotId))
        .innerJoin(locations, eq(inventoryStock.locationId, locations.locationId))
        .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
        .where(
            and(
                eq(items.isActive, true),
                eq(items.itemType, 'Finished Good'),
                eq(locations.isActive, true),
                eq(locations.locationType, 'Warehouse'),
                eq(lots.qcStatus, 'Approved'),
                isNotNull(lots.packingOrderId),
                or(isNull(lots.expirationDate), sql`${lots.expirationDate}>${today()}`),
                gt(inventoryStock.qtyOnHand, zero),
                sql`${inventoryStock.qtyOnHand}>${activeReserved}`,
            ),
        )
        .orderBy(asc(items.name), asc(lots.lotNumber), asc(inventoryStock.locationId));
    return { locations: locationRows, stock };
}
function assertStatus(status: string, expected: string) {
    if (status !== expected)
        throw new AppError(409, `This operation requires a transfer in ${expected} status.`);
}
async function lockHeader(tx: Transaction, id: number) {
    const [header] = await tx
        .select()
        .from(stockTransfers)
        .where(eq(stockTransfers.transferId, id))
        .for('update');
    return header ?? null;
}
async function lockLines(tx: Transaction, id: number) {
    const lines = await tx
        .select()
        .from(stockTransferLines)
        .where(eq(stockTransferLines.transferId, id))
        .orderBy(asc(stockTransferLines.transferLineId))
        .for('update');
    if (!lines.length) throw new AppError(409, 'The transfer has no lot lines.');
    return lines;
}
async function savedTransfer(tx: Reader, id: number) {
    const value = await getTransfer(id, tx);
    if (!value) throw new Error('The saved stock transfer could not be loaded.');
    return value;
}
async function lockParents(
    tx: Transaction,
    lines: Pick<Line, 'itemId' | 'lotId'>[],
    eligible: boolean,
) {
    const itemIds = [...new Set(lines.map((line) => line.itemId))].sort((a, b) => a - b);
    const lotIds = [...new Set(lines.map((line) => line.lotId))].sort((a, b) => a - b);
    if (!lines.length || lotIds.length !== lines.length)
        throw new AppError(400, 'Select at least one unique lot line.');
    const itemRows = await tx
        .select()
        .from(items)
        .where(inArray(items.itemId, itemIds))
        .orderBy(asc(items.itemId))
        .for('share');
    // Use the same parent-lot lock as packing, QC changes, and stock counts.
    const lotRows = await tx
        .select()
        .from(lots)
        .where(inArray(lots.lotId, lotIds))
        .orderBy(asc(lots.lotId))
        .for('update');
    for (const line of lines) {
        const item = itemRows.find((row) => row.itemId === line.itemId);
        const lot = lotRows.find((row) => row.lotId === line.lotId);
        if (!item || !lot || lot.itemId !== line.itemId)
            throw new AppError(400, 'A selected lot does not belong to its item.');
        if (
            eligible &&
            (!item.isActive || item.itemType !== 'Finished Good' || !lot.packingOrderId)
        )
            throw new AppError(
                409,
                'Transfers require active finished goods traceable to a packing order.',
            );
        if (
            eligible &&
            (lot.qcStatus !== 'Approved' ||
                (lot.expirationDate !== null && lot.expirationDate <= today()))
        )
            throw new AppError(409, 'Dispatch requires approved, unexpired finished-product lots.');
    }
    return lotIds;
}
async function lockLocations(
    tx: Transaction,
    sourceId: number,
    destinationId: number,
    transitLocationId?: number,
) {
    if (
        sourceId === destinationId ||
        transitLocationId === sourceId ||
        transitLocationId === destinationId
    )
        throw new AppError(400, 'Source, destination, and transit locations must be distinct.');
    const ids = [
        ...new Set([sourceId, destinationId, ...(transitLocationId ? [transitLocationId] : [])]),
    ].sort((a, b) => a - b);
    for (const id of ids) await requireActiveLocation(tx, id);
    const rows = await tx
        .select({ id: locations.locationId, type: locations.locationType })
        .from(locations)
        .where(inArray(locations.locationId, ids));
    if (rows.find((row) => row.id === sourceId)?.type !== 'Warehouse')
        throw new AppError(400, 'The transfer source must be an active warehouse.');
    if (
        !['Warehouse', 'Branch', 'Store'].includes(
            rows.find((row) => row.id === destinationId)?.type ?? '',
        )
    )
        throw new AppError(400, 'The destination must be an active warehouse, branch, or store.');
    if (
        transitLocationId &&
        rows.find((row) => row.id === transitLocationId)?.type !== 'In Transit'
    )
        throw new AppError(400, 'Select an active In Transit location for dispatch.');
}
async function lockStock(tx: Transaction, lotIds: number[], locationIds: number[]) {
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
            ),
        )
        .orderBy(asc(inventoryReservations.reservationId))
        .for('update');
    return { balances, reservations };
}
async function validateDraft(
    tx: Transaction,
    sourceId: number,
    destinationId: number,
    lines: Pick<Line, 'itemId' | 'lotId'>[],
) {
    const lotIds = await lockParents(tx, lines, true);
    await lockLocations(tx, sourceId, destinationId);
    const { balances } = await lockStock(tx, lotIds, [sourceId]);
    for (const line of lines)
        if (
            !balances.some(
                (row) =>
                    row.lotId === line.lotId &&
                    row.itemId === line.itemId &&
                    quantityUnits(row.qtyOnHand) > 0n,
            )
        )
            throw new AppError(
                409,
                'A selected finished-product lot has no stock at the source warehouse.',
            );
}
export async function createTransfer(
    input: CreateTransferInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        await validateDraft(tx, input.sourceLocationId, input.destinationLocationId, input.lines);
        const { lines, ...header } = input;
        const [created] = await tx
            .insert(stockTransfers)
            .values({ ...header, createdBy: actorId, updatedBy: actorId })
            .returning({ id: stockTransfers.transferId });
        if (!created) throw new Error('The stock transfer could not be created.');
        await tx.insert(stockTransferLines).values(
            lines.map((line) => ({
                ...line,
                transferId: created.id,
                qtyRequested: quantityString(quantityUnits(line.qtyRequested)),
                createdBy: actorId,
                updatedBy: actorId,
            })),
        );
        return savedTransfer(tx, created.id);
    });
}
export async function updateTransfer(
    id: number,
    input: UpdateTransferInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const header = await lockHeader(tx, id);
        if (!header) return null;
        assertStatus(header.status, 'Draft');
        const currentLines = await lockLines(tx, id);
        await validateDraft(
            tx,
            input.sourceLocationId ?? header.sourceLocationId,
            input.destinationLocationId ?? header.destinationLocationId,
            input.lines ?? currentLines,
        );
        const { lines, ...changes } = input;
        await tx
            .update(stockTransfers)
            .set({ ...changes, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(stockTransfers.transferId, id));
        if (lines !== undefined) {
            await tx.delete(stockTransferLines).where(eq(stockTransferLines.transferId, id));
            await tx.insert(stockTransferLines).values(
                lines.map((line) => ({
                    ...line,
                    transferId: id,
                    qtyRequested: quantityString(quantityUnits(line.qtyRequested)),
                    createdBy: actorId,
                    updatedBy: actorId,
                })),
            );
        }
        return savedTransfer(tx, id);
    });
}
async function moveStock(
    tx: Transaction,
    line: Line,
    from: number,
    to: number,
    quantity: string,
    actorId: number,
    reference: string,
    context: Awaited<ReturnType<typeof lockStock>>,
) {
    const amount = quantityUnits(quantity);
    if (amount <= 0n) throw new AppError(400, 'Movement quantities must be positive.');
    const sourceStock = context.balances.find(
        (row) => row.lotId === line.lotId && row.locationId === from,
    );
    const targetStock = context.balances.find(
        (row) => row.lotId === line.lotId && row.locationId === to,
    );
    const reserved = quantityUnits(
        outstandingReservations(
            context.reservations.filter(
                (row) => row.lotId === line.lotId && row.locationId === from,
            ),
        ),
    );
    if (!sourceStock || quantityUnits(sourceStock.qtyOnHand) - reserved < amount)
        throw new AppError(
            409,
            'There is not enough available stock for this movement. Refresh the transfer and stock.',
        );
    if (quantityUnits(targetStock?.qtyOnHand ?? zero) + amount > maxQuantity)
        throw new AppError(409, 'This movement would exceed the destination stock quantity limit.');
    const remaining = quantityString(quantityUnits(sourceStock.qtyOnHand) - amount);
    await tx
        .update(inventoryStock)
        .set({ qtyOnHand: remaining, lastUpdated: new Date() })
        .where(eq(inventoryStock.stockId, sourceStock.stockId));
    await tx
        .insert(inventoryStock)
        .values({
            itemId: line.itemId,
            lotId: line.lotId,
            locationId: to,
            qtyOnHand: quantityString(amount),
            lastUpdated: new Date(),
        })
        .onConflictDoUpdate({
            target: [inventoryStock.lotId, inventoryStock.locationId],
            set: {
                qtyOnHand: sql`${inventoryStock.qtyOnHand}+${quantityString(amount)}`,
                lastUpdated: new Date(),
            },
        });
    await tx.insert(inventoryTransactions).values([
        {
            itemId: line.itemId,
            lotId: line.lotId,
            locationId: from,
            qtyChange: quantityString(-amount),
            transactionType: 'Transfer',
            transferLineId: line.transferLineId,
            referenceId: reference,
            authorizedByUserId: actorId,
        },
        {
            itemId: line.itemId,
            lotId: line.lotId,
            locationId: to,
            qtyChange: quantityString(amount),
            transactionType: 'Transfer',
            transferLineId: line.transferLineId,
            referenceId: reference,
            authorizedByUserId: actorId,
        },
    ]);
}
function assertActionLines(lines: Line[], supplied: { transferLineId: number }[], all: boolean) {
    if (
        !supplied.length ||
        new Set(supplied.map((line) => line.transferLineId)).size !== supplied.length ||
        supplied.some(
            (line) => !lines.some((saved) => saved.transferLineId === line.transferLineId),
        ) ||
        (all && lines.length !== supplied.length)
    )
        throw new AppError(
            400,
            all
                ? 'Dispatch must include every transfer line exactly once.'
                : 'Include each selected transfer line only once.',
        );
}
export async function dispatchTransfer(
    id: number,
    input: DispatchTransferInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const header = await lockHeader(tx, id);
        if (!header) return null;
        assertStatus(header.status, 'Draft');
        const lines = await lockLines(tx, id);
        assertActionLines(lines, input.lines, true);
        const lotIds = await lockParents(tx, lines, true);
        await lockLocations(
            tx,
            header.sourceLocationId,
            header.destinationLocationId,
            input.transitLocationId,
        );
        const context = await lockStock(tx, lotIds, [
            header.sourceLocationId,
            input.transitLocationId,
        ]);
        for (const line of lines) {
            const supplied = input.lines.find((row) => row.transferLineId === line.transferLineId)!;
            const quantity = quantityUnits(supplied.qtyShipped);
            if (quantity <= 0n || quantity > quantityUnits(line.qtyRequested))
                throw new AppError(
                    409,
                    'Shipped quantity must be positive and cannot exceed the requested quantity.',
                );
            await moveStock(
                tx,
                line,
                header.sourceLocationId,
                input.transitLocationId,
                supplied.qtyShipped,
                actorId,
                header.transferNumber,
                context,
            );
            await tx
                .update(stockTransferLines)
                .set({
                    qtyShipped: quantityString(quantity),
                    updatedBy: actorId,
                    updatedAt: new Date(),
                })
                .where(eq(stockTransferLines.transferLineId, line.transferLineId));
        }
        await tx
            .update(stockTransfers)
            .set({
                status: 'In Transit',
                dispatchedAt: sql`greatest(now(),${stockTransfers.requestedAt})`,
                updatedBy: actorId,
                updatedAt: new Date(),
            })
            .where(eq(stockTransfers.transferId, id));
        return savedTransfer(tx, id);
    });
}
async function originalTransit(tx: Reader, lines: Line[]) {
    const rows = await tx
        .select({
            lineId: inventoryTransactions.transferLineId,
            locationId: inventoryTransactions.locationId,
            quantity: inventoryTransactions.qtyChange,
        })
        .from(inventoryTransactions)
        .innerJoin(locations, eq(inventoryTransactions.locationId, locations.locationId))
        .where(
            and(
                inArray(
                    inventoryTransactions.transferLineId,
                    lines.map((line) => line.transferLineId),
                ),
                eq(inventoryTransactions.transactionType, 'Transfer'),
                gt(inventoryTransactions.qtyChange, zero),
                eq(locations.locationType, 'In Transit'),
            ),
        );
    const locationIds = [...new Set(rows.map((row) => row.locationId))];
    if (
        locationIds.length !== 1 ||
        lines.some(
            (line) =>
                rows
                    .filter((row) => row.lineId === line.transferLineId)
                    .reduce((sum, row) => sum + quantityUnits(row.quantity), 0n) !==
                quantityUnits(line.qtyShipped),
        )
    )
        throw new AppError(
            409,
            'The original dispatch ledger is incomplete or has inconsistent transit locations.',
        );
    return locationIds[0]!;
}
export async function receiveTransfer(
    id: number,
    input: ReceiveTransferInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const header = await lockHeader(tx, id);
        if (!header) return null;
        assertStatus(header.status, 'In Transit');
        const lines = await lockLines(tx, id);
        assertActionLines(lines, input.lines, false);
        const lotIds = await lockParents(tx, lines, false);
        const transitLocationId = await originalTransit(tx, lines);
        await lockLocations(
            tx,
            header.sourceLocationId,
            header.destinationLocationId,
            transitLocationId,
        );
        const context = await lockStock(tx, lotIds, [
            transitLocationId,
            header.destinationLocationId,
        ]);
        const received = new Map<number, bigint>();
        for (const supplied of input.lines) {
            const line = lines.find((row) => row.transferLineId === supplied.transferLineId)!;
            const quantity = quantityUnits(supplied.qtyReceived);
            const cumulative = quantityUnits(line.qtyReceived) + quantity;
            if (quantity <= 0n || cumulative > quantityUnits(line.qtyShipped))
                throw new AppError(
                    409,
                    "Received quantity must be positive and cannot exceed this line's outstanding shipment.",
                );
            await moveStock(
                tx,
                line,
                transitLocationId,
                header.destinationLocationId,
                supplied.qtyReceived,
                actorId,
                header.transferNumber,
                context,
            );
            await tx
                .update(stockTransferLines)
                .set({
                    qtyReceived: quantityString(cumulative),
                    updatedBy: actorId,
                    updatedAt: new Date(),
                })
                .where(eq(stockTransferLines.transferLineId, line.transferLineId));
            received.set(line.transferLineId, cumulative);
        }
        const complete = lines.every(
            (line) =>
                (received.get(line.transferLineId) ?? quantityUnits(line.qtyReceived)) ===
                quantityUnits(line.qtyShipped),
        );
        await tx
            .update(stockTransfers)
            .set({
                status: complete ? 'Completed' : 'In Transit',
                ...(complete
                    ? { receivedAt: sql`greatest(now(),${stockTransfers.dispatchedAt})` }
                    : {}),
                updatedBy: actorId,
                updatedAt: new Date(),
            })
            .where(eq(stockTransfers.transferId, id));
        return savedTransfer(tx, id);
    });
}
export async function cancelTransfer(id: number, actorId: number, database: typeof db = db) {
    return database.transaction(async (tx) => {
        const header = await lockHeader(tx, id);
        if (!header) return null;
        assertStatus(header.status, 'Draft');
        await tx
            .update(stockTransfers)
            .set({ status: 'Cancelled', updatedBy: actorId, updatedAt: new Date() })
            .where(eq(stockTransfers.transferId, id));
        return savedTransfer(tx, id);
    });
}
