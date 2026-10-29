import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import {
    purchaseOrders,
    purchaseOrderLines,
    suppliers,
    supplierItems,
    items,
    uoms,
    lots,
    inventoryTransactions,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type {
    CreatePurchaseOrderInput,
    UpdatePurchaseOrderInput,
} from './purchase-order.schema.ts';
import {
    assertActiveSupplier,
    assertDeliveryDate,
    assertDraftEditable,
    assertPurchaseOrderAction,
    assertPurchaseOrderLineDefinitions,
    purchaseOrderAmounts,
    purchaseOrderLineAmounts,
} from './purchase-order.rules.ts';

type Reader = Pick<typeof db, 'select'>;
const headerFields = {
    poId: purchaseOrders.poId,
    poNumber: purchaseOrders.poNumber,
    supplierId: purchaseOrders.supplierId,
    supplierName: suppliers.name,
    supplierIsActive: suppliers.isActive,
    status: purchaseOrders.status,
    orderDate: purchaseOrders.orderDate,
    expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
    notes: purchaseOrders.notes,
    hasReceipts: sql<boolean>`(exists(select 1 from ${purchaseOrderLines} where ${purchaseOrderLines.poId}=${purchaseOrders.poId} and ${purchaseOrderLines.qtyReceived}>0) or exists(select 1 from ${lots} inner join ${purchaseOrderLines} on ${lots.poLineId}=${purchaseOrderLines.poLineId} where ${purchaseOrderLines.poId}=${purchaseOrders.poId}) or exists(select 1 from ${inventoryTransactions} inner join ${purchaseOrderLines} on ${inventoryTransactions.poLineId}=${purchaseOrderLines.poLineId} where ${purchaseOrderLines.poId}=${purchaseOrders.poId}))`,
    createdBy: purchaseOrders.createdBy,
    createdAt: purchaseOrders.createdAt,
    updatedBy: purchaseOrders.updatedBy,
    updatedAt: purchaseOrders.updatedAt,
};
const primaryUom = alias(uoms, 'purchase_primary_uom');
const lineFields = {
    poLineId: purchaseOrderLines.poLineId,
    poId: purchaseOrderLines.poId,
    itemId: purchaseOrderLines.itemId,
    itemSku: items.sku,
    itemName: items.name,
    itemType: items.itemType,
    itemIsActive: items.isActive,
    uomId: purchaseOrderLines.uomId,
    uomName: uoms.name,
    uomClassId: uoms.uomClassId,
    primaryUomId: items.primaryUomId,
    primaryUomName: primaryUom.name,
    qtyOrdered: purchaseOrderLines.qtyOrdered,
    qtyReceived: purchaseOrderLines.qtyReceived,
    unitPrice: purchaseOrderLines.unitPrice,
    createdBy: purchaseOrderLines.createdBy,
    createdAt: purchaseOrderLines.createdAt,
    updatedBy: purchaseOrderLines.updatedBy,
    updatedAt: purchaseOrderLines.updatedAt,
};
const headers = (database: Reader) =>
    database
        .select(headerFields)
        .from(purchaseOrders)
        .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.supplierId));
async function orderLines(id: number, database: Reader) {
    const rows = await database
        .select(lineFields)
        .from(purchaseOrderLines)
        .innerJoin(items, eq(purchaseOrderLines.itemId, items.itemId))
        .innerJoin(uoms, eq(purchaseOrderLines.uomId, uoms.uomId))
        .innerJoin(primaryUom, eq(items.primaryUomId, primaryUom.uomId))
        .where(eq(purchaseOrderLines.poId, id))
        .orderBy(asc(purchaseOrderLines.poLineId));
    return rows.map((line) => ({ ...line, ...purchaseOrderLineAmounts(line) }));
}
export async function listPurchaseOrders() {
    const rows = await headers(db).orderBy(
        desc(purchaseOrders.orderDate),
        desc(purchaseOrders.poId),
    );
    if (!rows.length) return [];
    const lines = await db
        .select({
            poId: purchaseOrderLines.poId,
            qtyOrdered: purchaseOrderLines.qtyOrdered,
            qtyReceived: purchaseOrderLines.qtyReceived,
            unitPrice: purchaseOrderLines.unitPrice,
        })
        .from(purchaseOrderLines)
        .where(
            inArray(
                purchaseOrderLines.poId,
                rows.map((row) => row.poId),
            ),
        );
    const groupedLines = new Map<number, typeof lines>();
    for (const line of lines) {
        const group = groupedLines.get(line.poId);
        if (group) group.push(line);
        else groupedLines.set(line.poId, [line]);
    }
    return rows.map((row) => {
        const matching = groupedLines.get(row.poId) ?? [];
        return { ...row, lineCount: matching.length, ...purchaseOrderAmounts(matching) };
    });
}
export async function getPurchaseOrder(id: number, database: Reader = db) {
    const [header] = await headers(database).where(eq(purchaseOrders.poId, id)).limit(1);
    if (!header) return null;
    const lines = await orderLines(id, database);
    return { ...header, lineCount: lines.length, ...purchaseOrderAmounts(lines), lines };
}
export async function getPurchaseOrderOptions() {
    const [supplierRows, itemRows, unitRows, quotes] = await Promise.all([
        db
            .select({
                supplierId: suppliers.supplierId,
                name: suppliers.name,
                isActive: suppliers.isActive,
            })
            .from(suppliers)
            .orderBy(asc(suppliers.name)),
        db
            .select({
                itemId: items.itemId,
                sku: items.sku,
                name: items.name,
                itemType: items.itemType,
                isActive: items.isActive,
                primaryUomId: items.primaryUomId,
                primaryUomName: uoms.name,
                uomClassId: uoms.uomClassId,
            })
            .from(items)
            .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
            .orderBy(asc(items.name), asc(items.sku)),
        db
            .select({ uomId: uoms.uomId, name: uoms.name, uomClassId: uoms.uomClassId })
            .from(uoms)
            .orderBy(asc(uoms.name)),
        db
            .select({
                supplierItemId: supplierItems.supplierItemId,
                supplierId: supplierItems.supplierId,
                itemId: supplierItems.itemId,
                supplierItemCode: supplierItems.supplierItemCode,
                defaultUomId: supplierItems.defaultUomId,
                defaultPrice: supplierItems.defaultPrice,
                leadTimeDays: supplierItems.leadTimeDays,
                isPreferred: supplierItems.isPreferred,
                isActive: supplierItems.isActive,
            })
            .from(supplierItems)
            .orderBy(asc(supplierItems.supplierItemId)),
    ]);
    return { suppliers: supplierRows, items: itemRows, uoms: unitRows, supplierItems: quotes };
}
async function lockSuppliers(database: Reader, ids: number[]) {
    const unique = [...new Set(ids)].sort((a, b) => a - b);
    const locked = await database
        .select({ supplierId: suppliers.supplierId, isActive: suppliers.isActive })
        .from(suppliers)
        .where(inArray(suppliers.supplierId, unique))
        .orderBy(asc(suppliers.supplierId))
        .for('update');
    if (locked.length !== unique.length) throw new AppError(400, 'Select an existing supplier.');
    return locked;
}
async function lockLineDefinitions(
    database: Reader,
    lines: readonly { itemId: number; uomId: number }[],
) {
    const itemIds = [...new Set(lines.map((line) => line.itemId))].sort((a, b) => a - b);
    if (!itemIds.length) throw new AppError(400, 'Add at least one purchase-order line.');
    const materials = await database
        .select({
            itemId: items.itemId,
            isActive: items.isActive,
            itemType: items.itemType,
            primaryUomId: items.primaryUomId,
        })
        .from(items)
        .where(inArray(items.itemId, itemIds))
        .orderBy(asc(items.itemId))
        .for('update');
    const unitIds = [
        ...new Set([
            ...lines.map((line) => line.uomId),
            ...materials.map((item) => item.primaryUomId),
        ]),
    ].sort((a, b) => a - b);
    const units = await database
        .select({ uomId: uoms.uomId, uomClassId: uoms.uomClassId })
        .from(uoms)
        .where(inArray(uoms.uomId, unitIds))
        .orderBy(asc(uoms.uomId))
        .for('share');
    assertPurchaseOrderLineDefinitions(lines, materials, units);
}
async function observeSupplier(id: number) {
    const [observed] = await db
        .select({ supplierId: purchaseOrders.supplierId })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.poId, id))
        .limit(1);
    return observed ?? null;
}
async function lockOrder(database: Reader, id: number, observedSupplierId: number) {
    const [locked] = await database
        .select({ poId: purchaseOrders.poId, supplierId: purchaseOrders.supplierId })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.poId, id))
        .for('update');
    if (!locked) return null;
    if (locked.supplierId !== observedSupplierId)
        throw new AppError(409, 'This purchase order changed. Refresh before trying again.');
    // Receiving must use the same PO -> lines order. Block new lot/ledger foreign keys while checking history.
    await database
        .select({ poLineId: purchaseOrderLines.poLineId })
        .from(purchaseOrderLines)
        .where(eq(purchaseOrderLines.poId, id))
        .orderBy(asc(purchaseOrderLines.poLineId))
        .for('update');
    return getPurchaseOrder(id, database);
}
export async function createPurchaseOrder(input: CreatePurchaseOrderInput, actorId: number) {
    return db.transaction(async (tx) => {
        const supplierRows = await lockSuppliers(tx, [input.supplierId]);
        assertActiveSupplier(supplierRows[0]);
        assertDeliveryDate(input.orderDate, input.expectedDeliveryDate);
        await lockLineDefinitions(tx, input.lines);
        const { lines, orderDate, ...header } = input;
        const [created] = await tx
            .insert(purchaseOrders)
            .values({
                ...header,
                orderDate: new Date(orderDate),
                status: 'Draft',
                createdBy: actorId,
                updatedBy: actorId,
            })
            .returning({ id: purchaseOrders.poId });
        if (!created) throw new Error('The purchase order could not be created.');
        await tx.insert(purchaseOrderLines).values(
            lines.map((line) => ({
                ...line,
                poId: created.id,
                qtyReceived: '0',
                createdBy: actorId,
                updatedBy: actorId,
            })),
        );
        const saved = await getPurchaseOrder(created.id, tx);
        if (!saved) throw new Error('The saved purchase order could not be loaded.');
        return saved;
    });
}
export async function updatePurchaseOrder(
    id: number,
    input: UpdatePurchaseOrderInput,
    actorId: number,
) {
    const observed = await observeSupplier(id);
    if (!observed) return null;
    return db.transaction(async (tx) => {
        const targetSupplierId = input.supplierId ?? observed.supplierId;
        const supplierRows = await lockSuppliers(tx, [observed.supplierId, targetSupplierId]);
        const current = await lockOrder(tx, id, observed.supplierId);
        if (!current) return null;
        assertDraftEditable(current);
        assertActiveSupplier(
            supplierRows.find((supplier) => supplier.supplierId === targetSupplierId),
        );
        const nextDate =
            input.orderDate === undefined ? current.orderDate : new Date(input.orderDate);
        const nextExpected =
            input.expectedDeliveryDate === undefined
                ? current.expectedDeliveryDate
                : input.expectedDeliveryDate;
        assertDeliveryDate(nextDate, nextExpected);
        await lockLineDefinitions(tx, input.lines ?? current.lines);
        const { lines, orderDate, ...header } = input;
        await tx
            .update(purchaseOrders)
            .set({
                ...header,
                ...(orderDate === undefined ? {} : { orderDate: new Date(orderDate) }),
                updatedBy: actorId,
                updatedAt: new Date(),
            })
            .where(eq(purchaseOrders.poId, id));
        if (lines !== undefined) {
            // Editable drafts have no received quantities, lot links, or ledger links; referenced history is never removed.
            await tx.delete(purchaseOrderLines).where(eq(purchaseOrderLines.poId, id));
            await tx.insert(purchaseOrderLines).values(
                lines.map((line) => ({
                    ...line,
                    poId: id,
                    qtyReceived: '0',
                    createdBy: actorId,
                    updatedBy: actorId,
                })),
            );
        }
        return getPurchaseOrder(id, tx);
    });
}
async function transitionPurchaseOrder(id: number, action: 'send' | 'cancel', actorId: number) {
    const observed = await observeSupplier(id);
    if (!observed) return null;
    return db.transaction(async (tx) => {
        const supplierRows = await lockSuppliers(tx, [observed.supplierId]);
        const current = await lockOrder(tx, id, observed.supplierId);
        if (!current) return null;
        assertPurchaseOrderAction(current, action);
        if (action === 'send') {
            assertActiveSupplier(supplierRows[0]);
            assertDeliveryDate(current.orderDate, current.expectedDeliveryDate);
            await lockLineDefinitions(tx, current.lines);
        }
        await tx
            .update(purchaseOrders)
            .set({
                status: action === 'send' ? 'Sent' : 'Cancelled',
                updatedBy: actorId,
                updatedAt: new Date(),
            })
            .where(eq(purchaseOrders.poId, id));
        return getPurchaseOrder(id, tx);
    });
}
export async function sendPurchaseOrder(id: number, actorId: number) {
    return transitionPurchaseOrder(id, 'send', actorId);
}
export async function cancelPurchaseOrder(id: number, actorId: number) {
    return transitionPurchaseOrder(id, 'cancel', actorId);
}
