import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import { itemUnitRatio } from '../item-packaging/item-package.service.ts';
import {
    purchaseOrders,
    purchaseOrderLines,
    suppliers,
    items,
    uoms,
    lots,
    locations,
    inventoryStock,
    inventoryTransactions,
    itemPackaging,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import { requireActiveLocation } from '../locations/location.service.ts';
import { assertLotDates } from '../lots/lot.rules.ts';
import type { ReceivePurchaseOrderInput } from './receiving.schema.ts';
import {
    assertReceivableStatus,
    assertReceivingLocation,
    convertReceiptQuantity,
    inverseReceiptQuantity,
    planReceiptQuantities,
    receiptQuantityString,
    receiptQuantityUnits,
    receiptUnitCost,
} from './receiving.rules.ts';

type Reader = Pick<typeof db, 'select'>;
const purchaseUom = alias(uoms, 'receiving_purchase_uom');
const primaryUom = alias(uoms, 'receiving_primary_uom');
async function readReceipts(database: Reader, ids?: number[]) {
    const rows = await database
        .select({
            transactionId: inventoryTransactions.transactionId,
            lotId: lots.lotId,
            lotNumber: lots.lotNumber,
            supplierLotNumber: lots.supplierLotNumber,
            poId: purchaseOrders.poId,
            poNumber: purchaseOrders.poNumber,
            poLineId: purchaseOrderLines.poLineId,
            supplierId: suppliers.supplierId,
            supplierName: suppliers.name,
            itemId: items.itemId,
            itemSku: items.sku,
            itemName: items.name,
            itemType: items.itemType,
            locationId: locations.locationId,
            locationCode: locations.code,
            locationName: locations.name,
            purchaseUomId: purchaseUom.uomId,
            purchaseUomName: purchaseUom.name,
            primaryUomId: primaryUom.uomId,
            primaryUomName: primaryUom.name,
            purchaseUomFactor: sql<string>`coalesce(${itemPackaging.baseQty},${purchaseUom.factorToBase})::text`,
            primaryUomFactor: sql<string>`case when ${itemPackaging.packagingId} is null then ${primaryUom.factorToBase}::text else '1' end`,
            qtyPrimary: inventoryTransactions.qtyChange,
            unitPrice: purchaseOrderLines.unitPrice,
            unitCost: lots.unitCost,
            qcStatus: lots.qcStatus,
            manufactureDate: lots.manufactureDate,
            expirationDate: lots.expirationDate,
            authorizedByUserId: inventoryTransactions.authorizedByUserId,
            createdAt: inventoryTransactions.createdAt,
        })
        .from(inventoryTransactions)
        .innerJoin(lots, eq(inventoryTransactions.lotId, lots.lotId))
        .innerJoin(
            purchaseOrderLines,
            eq(inventoryTransactions.poLineId, purchaseOrderLines.poLineId),
        )
        .innerJoin(purchaseOrders, eq(purchaseOrderLines.poId, purchaseOrders.poId))
        .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.supplierId))
        .innerJoin(items, eq(inventoryTransactions.itemId, items.itemId))
        .innerJoin(locations, eq(inventoryTransactions.locationId, locations.locationId))
        .innerJoin(purchaseUom, eq(purchaseOrderLines.uomId, purchaseUom.uomId))
        .innerJoin(primaryUom, eq(items.primaryUomId, primaryUom.uomId))
        .leftJoin(
            itemPackaging,
            and(eq(itemPackaging.itemId, items.itemId), eq(itemPackaging.uomId, purchaseUom.uomId)),
        )
        .where(
            and(
                eq(inventoryTransactions.transactionType, 'Receive'),
                ids ? inArray(inventoryTransactions.transactionId, ids) : undefined,
            ),
        )
        .orderBy(desc(inventoryTransactions.createdAt), desc(inventoryTransactions.transactionId));
    return rows.map(({ purchaseUomFactor, primaryUomFactor, ...row }) => ({
        ...row,
        qtyReceived: inverseReceiptQuantity(row.qtyPrimary, purchaseUomFactor, primaryUomFactor),
    }));
}
export async function listReceipts(database: Reader = db) {
    return readReceipts(database);
}
export async function getReceivingOptions(database: Reader = db) {
    const [orders, lines, locationRows] = await Promise.all([
        database
            .select({
                poId: purchaseOrders.poId,
                poNumber: purchaseOrders.poNumber,
                supplierId: purchaseOrders.supplierId,
                supplierName: suppliers.name,
                status: purchaseOrders.status,
            })
            .from(purchaseOrders)
            .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.supplierId))
            .where(inArray(purchaseOrders.status, ['Sent', 'Partially Received']))
            .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.poId)),
        database
            .select({
                poId: purchaseOrderLines.poId,
                poLineId: purchaseOrderLines.poLineId,
                itemId: items.itemId,
                itemSku: items.sku,
                itemName: items.name,
                itemType: items.itemType,
                itemIsActive: items.isActive,
                requiresQc: items.requiresQc,
                uomId: purchaseUom.uomId,
                uomName: purchaseUom.name,
                purchaseUomFactor: sql<string>`coalesce(${itemPackaging.baseQty},${purchaseUom.factorToBase})::text`,
                primaryUomId: primaryUom.uomId,
                primaryUomName: primaryUom.name,
                primaryUomFactor: sql<string>`case when ${itemPackaging.packagingId} is null then ${primaryUom.factorToBase}::text else '1' end`,
                qtyOrdered: purchaseOrderLines.qtyOrdered,
                qtyReceived: purchaseOrderLines.qtyReceived,
                unitPrice: purchaseOrderLines.unitPrice,
            })
            .from(purchaseOrderLines)
            .innerJoin(purchaseOrders, eq(purchaseOrderLines.poId, purchaseOrders.poId))
            .innerJoin(items, eq(purchaseOrderLines.itemId, items.itemId))
            .innerJoin(purchaseUom, eq(purchaseOrderLines.uomId, purchaseUom.uomId))
            .innerJoin(primaryUom, eq(items.primaryUomId, primaryUom.uomId))
            .leftJoin(
                itemPackaging,
                and(
                    eq(itemPackaging.itemId, items.itemId),
                    eq(itemPackaging.uomId, purchaseUom.uomId),
                ),
            )
            .where(
                and(
                    inArray(purchaseOrders.status, ['Sent', 'Partially Received']),
                    lt(purchaseOrderLines.qtyReceived, purchaseOrderLines.qtyOrdered),
                ),
            )
            .orderBy(asc(purchaseOrderLines.poLineId)),
        database
            .select({
                locationId: locations.locationId,
                code: locations.code,
                name: locations.name,
                locationType: locations.locationType,
                isActive: locations.isActive,
            })
            .from(locations)
            .where(eq(locations.locationType, 'Warehouse'))
            .orderBy(asc(locations.name)),
    ]);
    const linesByOrder = new Map<number, typeof lines>();
    for (const line of lines) {
        const group = linesByOrder.get(line.poId) ?? [];
        group.push(line);
        linesByOrder.set(line.poId, group);
    }
    return {
        orders: orders
            .map((order) => ({
                ...order,
                status: order.status as 'Sent' | 'Partially Received',
                lines: (linesByOrder.get(order.poId) ?? []).map(({ poId: _poId, ...line }) => ({
                    ...line,
                    qtyRemaining: receiptQuantityString(
                        receiptQuantityUnits(line.qtyOrdered) -
                            receiptQuantityUnits(line.qtyReceived),
                    ),
                })),
            }))
            .filter((order) => order.lines.length > 0),
        locations: locationRows,
    };
}

export async function receivePurchaseOrder(
    input: ReceivePurchaseOrderInput,
    actorId: number,
    database: typeof db = db,
) {
    const [observed] = await database
        .select({ supplierId: purchaseOrders.supplierId })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.poId, input.poId))
        .limit(1);
    if (!observed) throw new AppError(404, 'Purchase order not found.');
    return database.transaction(async (tx) => {
        // Match purchasing: supplier -> PO -> every PO line -> sorted items -> sorted units.
        const [supplier] = await tx
            .select({ supplierId: suppliers.supplierId })
            .from(suppliers)
            .where(eq(suppliers.supplierId, observed.supplierId))
            .for('update');
        if (!supplier)
            throw new AppError(409, 'The purchase order supplier is no longer available.');
        const [order] = await tx
            .select({
                supplierId: purchaseOrders.supplierId,
                status: purchaseOrders.status,
                poNumber: purchaseOrders.poNumber,
            })
            .from(purchaseOrders)
            .where(eq(purchaseOrders.poId, input.poId))
            .for('update');
        if (!order) throw new AppError(404, 'Purchase order not found.');
        if (order.supplierId !== observed.supplierId)
            throw new AppError(409, 'The purchase order changed. Refresh before receiving.');
        assertReceivableStatus(order.status);
        const poLines = await tx
            .select({
                poLineId: purchaseOrderLines.poLineId,
                itemId: purchaseOrderLines.itemId,
                uomId: purchaseOrderLines.uomId,
                qtyOrdered: purchaseOrderLines.qtyOrdered,
                qtyReceived: purchaseOrderLines.qtyReceived,
                unitPrice: purchaseOrderLines.unitPrice,
            })
            .from(purchaseOrderLines)
            .where(eq(purchaseOrderLines.poId, input.poId))
            .orderBy(asc(purchaseOrderLines.poLineId))
            .for('update');
        const plan = planReceiptQuantities(poLines, input.lines);
        const targetLines = poLines.filter((line) => plan.next.has(line.poLineId));
        const itemIds = [...new Set(targetLines.map((line) => line.itemId))].sort((a, b) => a - b);
        const materials = await tx
            .select({
                itemId: items.itemId,
                itemType: items.itemType,
                isActive: items.isActive,
                primaryUomId: items.primaryUomId,
                requiresQc: items.requiresQc,
            })
            .from(items)
            .where(inArray(items.itemId, itemIds))
            .orderBy(asc(items.itemId))
            .for('update');
        const unitIds = [
            ...new Set([
                ...targetLines.map((line) => line.uomId),
                ...materials.map((item) => item.primaryUomId),
            ]),
        ].sort((a, b) => a - b);
        const units = await tx
            .select({
                uomId: uoms.uomId,
                uomClassId: uoms.uomClassId,
                factorToBase: uoms.factorToBase,
            })
            .from(uoms)
            .where(inArray(uoms.uomId, unitIds))
            .orderBy(asc(uoms.uomId))
            .for('share');
        const linesById = new Map(poLines.map((line) => [line.poLineId, line]));
        const itemsById = new Map(materials.map((item) => [item.itemId, item]));
        const unitsById = new Map(units.map((unit) => [unit.uomId, unit]));
        const ratios = new Map<number, { sourceFactor: string; primaryFactor: string }>();
        for (const line of targetLines) {
            const item = itemsById.get(line.itemId)!;
            const source = unitsById.get(line.uomId);
            const primary = unitsById.get(item.primaryUomId);
            if (source && primary)
                ratios.set(
                    line.poLineId,
                    await itemUnitRatio(
                        tx,
                        item.itemId,
                        line.uomId,
                        source.factorToBase,
                        primary.factorToBase,
                    ),
                );
        }
        const prepared = input.lines.map((entry) => {
            const line = linesById.get(entry.poLineId)!;
            const item = itemsById.get(line.itemId);
            if (!item || !item.isActive || item.itemType === 'Finished Good')
                throw new AppError(
                    400,
                    'Receive only active raw materials, packaging materials, or labels.',
                );
            const purchaseUnit = unitsById.get(line.uomId);
            const primaryUnit = unitsById.get(item.primaryUomId);
            if (!purchaseUnit || !primaryUnit || purchaseUnit.uomClassId !== primaryUnit.uomClassId)
                throw new AppError(
                    400,
                    'The purchase unit must be compatible with the item primary unit.',
                );
            assertLotDates(entry.manufactureDate, entry.expirationDate);
            return {
                entry,
                item,
                qtyPrimary: convertReceiptQuantity(
                    entry.qtyReceived,
                    ratios.get(line.poLineId)!.sourceFactor,
                    ratios.get(line.poLineId)!.primaryFactor,
                ),
                unitCost: receiptUnitCost(
                    line.unitPrice,
                    ratios.get(line.poLineId)!.sourceFactor,
                    ratios.get(line.poLineId)!.primaryFactor,
                ),
            };
        });
        const created = await tx
            .insert(lots)
            .values(
                prepared.map(({ entry, item, unitCost }) => ({
                    lotNumber: entry.lotNumber,
                    supplierLotNumber: entry.supplierLotNumber,
                    itemId: item.itemId,
                    poLineId: entry.poLineId,
                    packingOrderId: null,
                    manufactureDate: entry.manufactureDate,
                    expirationDate: entry.expirationDate,
                    qcStatus: 'Approved' as const,
                    unitCost,
                    createdBy: actorId,
                    updatedBy: actorId,
                })),
            )
            .returning({ lotId: lots.lotId, lotNumber: lots.lotNumber });
        const lotsByNumber = new Map(created.map((lot) => [lot.lotNumber, lot.lotId]));
        const createdLots = prepared.map((line) => {
            const lotId = lotsByNumber.get(line.entry.lotNumber);
            if (!lotId) throw new Error('The received lot could not be created.');
            return { ...line, lotId };
        });
        // New lots are private until commit. Acquire all destination guards before balance/ledger writes.
        for (const locationId of [...new Set(input.lines.map((entry) => entry.locationId))].sort(
            (a, b) => a - b,
        )) {
            await requireActiveLocation(tx, locationId);
            const [location] = await tx
                .select({ locationType: locations.locationType })
                .from(locations)
                .where(eq(locations.locationId, locationId));
            if (!location) throw new AppError(400, 'Select an existing receiving location.');
            assertReceivingLocation(location.locationType);
        }
        await tx.insert(inventoryStock).values(
            createdLots.map((received) => ({
                itemId: received.item.itemId,
                lotId: received.lotId,
                locationId: received.entry.locationId,
                qtyOnHand: received.qtyPrimary,
            })),
        );
        const ledgerRows = await tx
            .insert(inventoryTransactions)
            .values(
                createdLots.map((received) => ({
                    itemId: received.item.itemId,
                    lotId: received.lotId,
                    locationId: received.entry.locationId,
                    qtyChange: received.qtyPrimary,
                    transactionType: 'Receive' as const,
                    poLineId: received.entry.poLineId,
                    referenceId: order.poNumber,
                    authorizedByUserId: actorId,
                })),
            )
            .returning({
                transactionId: inventoryTransactions.transactionId,
                lotId: inventoryTransactions.lotId,
            });
        const ledgerByLot = new Map(ledgerRows.map((row) => [row.lotId, row.transactionId]));
        const transactionIds = createdLots.map((received) => {
            const id = ledgerByLot.get(received.lotId);
            if (!id) throw new Error('The receiving transaction could not be recorded.');
            return id;
        });
        await tx
            .update(purchaseOrderLines)
            .set({
                qtyReceived: sql`case ${purchaseOrderLines.poLineId} ${sql.join(
                    [...plan.next].map(
                        ([id, quantity]) => sql`when ${id} then ${quantity}::numeric`,
                    ),
                    sql` `,
                )} end`,
                updatedBy: actorId,
                updatedAt: new Date(),
            })
            .where(inArray(purchaseOrderLines.poLineId, [...plan.next.keys()]));
        await tx
            .update(purchaseOrders)
            .set({ status: plan.poStatus, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(purchaseOrders.poId, input.poId));
        const saved = await readReceipts(tx, transactionIds);
        if (saved.length !== transactionIds.length)
            throw new Error('The recorded receipt could not be loaded.');
        const byId = new Map(saved.map((receipt) => [receipt.transactionId, receipt]));
        return {
            receipts: transactionIds.map((id) => byId.get(id)!),
            poId: input.poId,
            poStatus: plan.poStatus,
        };
    });
}
