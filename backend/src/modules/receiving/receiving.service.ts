import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
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
            purchaseUomFactor: purchaseUom.factorToBase,
            primaryUomFactor: primaryUom.factorToBase,
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
                purchaseUomFactor: purchaseUom.factorToBase,
                primaryUomId: primaryUom.uomId,
                primaryUomName: primaryUom.name,
                primaryUomFactor: primaryUom.factorToBase,
                qtyOrdered: purchaseOrderLines.qtyOrdered,
                qtyReceived: purchaseOrderLines.qtyReceived,
                unitPrice: purchaseOrderLines.unitPrice,
            })
            .from(purchaseOrderLines)
            .innerJoin(purchaseOrders, eq(purchaseOrderLines.poId, purchaseOrders.poId))
            .innerJoin(items, eq(purchaseOrderLines.itemId, items.itemId))
            .innerJoin(purchaseUom, eq(purchaseOrderLines.uomId, purchaseUom.uomId))
            .innerJoin(primaryUom, eq(items.primaryUomId, primaryUom.uomId))
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
            .where(inArray(locations.locationType, ['Warehouse', 'Quarantine']))
            .orderBy(asc(locations.name)),
    ]);
    return {
        orders: orders
            .map((order) => ({
                ...order,
                status: order.status as 'Sent' | 'Partially Received',
                lines: lines
                    .filter((line) => line.poId === order.poId)
                    .map(({ poId: _poId, ...line }) => ({
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
        const prepared = input.lines.map((entry) => {
            const line = poLines.find((row) => row.poLineId === entry.poLineId)!;
            const item = materials.find((row) => row.itemId === line.itemId);
            if (!item || !item.isActive || item.itemType === 'Finished Good')
                throw new AppError(
                    400,
                    'Receive only active raw materials, packaging materials, or labels.',
                );
            const purchaseUnit = units.find((unit) => unit.uomId === line.uomId);
            const primaryUnit = units.find((unit) => unit.uomId === item.primaryUomId);
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
                    purchaseUnit.factorToBase,
                    primaryUnit.factorToBase,
                ),
                unitCost: receiptUnitCost(
                    line.unitPrice,
                    purchaseUnit.factorToBase,
                    primaryUnit.factorToBase,
                ),
            };
        });
        const createdLots = [];
        for (const preparedLine of prepared) {
            const { entry, item, unitCost, qtyPrimary } = preparedLine;
            const [lot] = await tx
                .insert(lots)
                .values({
                    lotNumber: entry.lotNumber,
                    supplierLotNumber: entry.supplierLotNumber,
                    itemId: item.itemId,
                    poLineId: entry.poLineId,
                    packingOrderId: null,
                    manufactureDate: entry.manufactureDate,
                    expirationDate: entry.expirationDate,
                    qcStatus: item.requiresQc ? 'Quarantine' : 'Approved',
                    unitCost,
                    createdBy: actorId,
                    updatedBy: actorId,
                })
                .returning({ lotId: lots.lotId });
            if (!lot) throw new Error('The received lot could not be created.');
            createdLots.push({ ...preparedLine, lotId: lot.lotId, qtyPrimary });
        }
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
        const transactionIds = [];
        for (const received of createdLots) {
            await tx.insert(inventoryStock).values({
                itemId: received.item.itemId,
                lotId: received.lotId,
                locationId: received.entry.locationId,
                qtyOnHand: received.qtyPrimary,
            });
            const [ledger] = await tx
                .insert(inventoryTransactions)
                .values({
                    itemId: received.item.itemId,
                    lotId: received.lotId,
                    locationId: received.entry.locationId,
                    qtyChange: received.qtyPrimary,
                    transactionType: 'Receive',
                    poLineId: received.entry.poLineId,
                    referenceId: order.poNumber,
                    authorizedByUserId: actorId,
                })
                .returning({ transactionId: inventoryTransactions.transactionId });
            if (!ledger) throw new Error('The receiving transaction could not be recorded.');
            transactionIds.push(ledger.transactionId);
        }
        for (const [poLineId, qtyReceived] of plan.next)
            await tx
                .update(purchaseOrderLines)
                .set({ qtyReceived, updatedBy: actorId, updatedAt: new Date() })
                .where(eq(purchaseOrderLines.poLineId, poLineId));
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
