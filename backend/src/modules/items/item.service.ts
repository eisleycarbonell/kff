import { asc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import {
    items,
    uoms,
    uomClasses,
    supplierItems,
    suppliers,
    billOfMaterials,
    itemPackaging,
    purchaseOrderLines,
    packingOrders,
    packingOrderMaterials,
    lots,
    inventoryStock,
    inventoryReservations,
    inventoryTransactions,
    stockTransferLines,
    salesOrderLines,
    reorderPolicies,
    formulaRevisions,
    formulaRevisionMaterials,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type { CreateItemInput, UpdateItemInput } from './item.schema.ts';
const label = alias(items, 'item_label');

// Indexed existence checks protect stored quantities and material relationships.
const isInUse = sql<boolean>`(
    exists (select 1 from items label_owner where label_owner.label_item_id = ${items.itemId}) or
    exists (select 1 from ${reorderPolicies} where ${reorderPolicies.itemId} = ${items.itemId}) or
    exists (select 1 from ${formulaRevisions} where ${formulaRevisions.itemId} = ${items.itemId}) or
    exists (select 1 from ${formulaRevisionMaterials} where ${formulaRevisionMaterials.componentItemId} = ${items.itemId}) or
    exists (select 1 from ${supplierItems} where ${supplierItems.itemId} = ${items.itemId}) or
    exists (select 1 from ${billOfMaterials} where ${billOfMaterials.parentItemId} = ${items.itemId} or ${billOfMaterials.componentItemId} = ${items.itemId}) or
    exists (select 1 from ${itemPackaging} where ${itemPackaging.itemId} = ${items.itemId}) or
    exists (select 1 from ${purchaseOrderLines} where ${purchaseOrderLines.itemId} = ${items.itemId}) or
    exists (select 1 from ${packingOrders} where ${packingOrders.itemId} = ${items.itemId}) or
    exists (select 1 from ${packingOrderMaterials} where ${packingOrderMaterials.itemId} = ${items.itemId}) or
    exists (select 1 from ${lots} where ${lots.itemId} = ${items.itemId}) or
    exists (select 1 from ${inventoryStock} where ${inventoryStock.itemId} = ${items.itemId}) or
    exists (select 1 from ${inventoryReservations} where ${inventoryReservations.itemId} = ${items.itemId}) or
    exists (select 1 from ${inventoryTransactions} where ${inventoryTransactions.itemId} = ${items.itemId}) or
    exists (select 1 from ${stockTransferLines} where ${stockTransferLines.itemId} = ${items.itemId}) or
    exists (select 1 from ${salesOrderLines} where ${salesOrderLines.itemId} = ${items.itemId})
)`;

type SupplierLink = {
    supplierItemId: number;
    supplierId: number;
    name: string;
    isActive: boolean;
    supplierIsActive: boolean;
};

const baseItemFields = {
    itemId: items.itemId,
    sku: items.sku,
    name: items.name,
    labelItemId: items.labelItemId,
    labelItemSku: label.sku,
    labelItemName: label.name,
    itemType: items.itemType,
    primaryUomId: items.primaryUomId,
    primaryUomName: uoms.name,
    uomClassName: uomClasses.name,
    netWeightG: items.netWeightG,
    shelfLifeDays: items.shelfLifeDays,
    requiresQc: items.requiresQc,
    unitCost: items.unitCost,
    isVatable: items.isVatable,
    isActive: items.isActive,
    createdBy: items.createdBy,
    createdAt: items.createdAt,
    updatedBy: items.updatedBy,
    updatedAt: items.updatedAt,
};

const itemFields = {
    ...baseItemFields,
    isInUse,
    supplierLinks: sql<
        SupplierLink[]
    >`coalesce((select jsonb_agg(jsonb_build_object('supplierItemId', ${supplierItems.supplierItemId}, 'supplierId', ${suppliers.supplierId}, 'name', ${suppliers.name}, 'isActive', ${supplierItems.isActive}, 'supplierIsActive', ${suppliers.isActive}) order by ${suppliers.name}) from ${supplierItems} join ${suppliers} on ${suppliers.supplierId} = ${supplierItems.supplierId} where ${supplierItems.itemId} = ${items.itemId}), '[]'::jsonb)`,
};
type Reader = Pick<typeof db, 'select'>;
const itemQuery = (database: Reader = db) =>
    database
        .select(itemFields)
        .from(items)
        .leftJoin(label, eq(items.labelItemId, label.itemId))
        .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
        .innerJoin(uomClasses, eq(uoms.uomClassId, uomClasses.uomClassId));

export async function listItems() {
    const [baseRows, linkRows, usedRows] = await Promise.all([
        db
            .select(baseItemFields)
            .from(items)
            .leftJoin(label, eq(items.labelItemId, label.itemId))
            .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
            .innerJoin(uomClasses, eq(uoms.uomClassId, uomClasses.uomClassId))
            .orderBy(asc(items.name), asc(items.itemId)),
        db
            .select({
                itemId: supplierItems.itemId,
                supplierItemId: supplierItems.supplierItemId,
                supplierId: suppliers.supplierId,
                name: suppliers.name,
                isActive: supplierItems.isActive,
                supplierIsActive: suppliers.isActive,
            })
            .from(supplierItems)
            .innerJoin(suppliers, eq(suppliers.supplierId, supplierItems.supplierId))
            .orderBy(asc(suppliers.name)),
        db.execute<{ item_id: number }>(sql`
            select label_item_id as item_id from items where label_item_id is not null
            union select item_id from reorder_policies
            union select item_id from formula_revisions
            union select component_item_id as item_id from formula_revision_materials
            union select item_id from supplier_items
            union select parent_item_id as item_id from bill_of_materials
            union select component_item_id as item_id from bill_of_materials
            union select item_id from item_packaging
            union select item_id from purchase_order_lines
            union select item_id from packing_orders
            union select item_id from packing_order_materials
            union select item_id from lots
            union select item_id from inventory_stock
            union select item_id from inventory_reservations
            union select item_id from inventory_transactions
            union select item_id from stock_transfer_lines
            union select item_id from sales_order_lines
        `),
    ]);

    const usedItemIds = new Set(usedRows.map((row) => Number(row.item_id)));
    const linksByItemId = new Map<number, SupplierLink[]>();
    for (const row of linkRows) {
        const list = linksByItemId.get(row.itemId) ?? [];
        list.push({
            supplierItemId: row.supplierItemId,
            supplierId: row.supplierId,
            name: row.name,
            isActive: row.isActive,
            supplierIsActive: row.supplierIsActive,
        });
        linksByItemId.set(row.itemId, list);
    }

    return baseRows.map((row) => ({
        ...row,
        isInUse: usedItemIds.has(row.itemId),
        supplierLinks: linksByItemId.get(row.itemId) ?? [],
    }));
}
export async function getItem(
    id: number,
    database: Reader = db,
): Promise<Awaited<ReturnType<typeof listItems>>[number] | null> {
    const [item] = await itemQuery(database).where(eq(items.itemId, id)).limit(1);
    return item ?? null;
}
export async function listItemUoms() {
    return db
        .select({
            uomId: uoms.uomId,
            name: uoms.name,
            uomClassId: uoms.uomClassId,
            uomClassName: uomClasses.name,
        })
        .from(uoms)
        .innerJoin(uomClasses, eq(uoms.uomClassId, uomClasses.uomClassId))
        .orderBy(asc(uomClasses.name), asc(uoms.name));
}
async function requireUom(database: Reader, uomId: number) {
    const [unit] = await database
        .select({ id: uoms.uomId })
        .from(uoms)
        .where(eq(uoms.uomId, uomId))
        .limit(1);
    if (!unit) throw new AppError(400, 'Select an existing primary unit of measure.');
}
export async function createItem(
    input: CreateItemInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        await requireUom(tx, input.primaryUomId);
        await requireLabel(tx, input.labelItemId, input.itemType);
        const [created] = await tx
            .insert(items)
            .values({ ...input, createdBy: actorId, updatedBy: actorId })
            .returning({ id: items.itemId });
        if (!created) throw new Error('The item could not be created.');
        const saved = await getItem(created.id, tx);
        if (!saved) throw new Error('The saved item could not be loaded.');
        return saved;
    });
}
export async function updateItem(
    id: number,
    input: UpdateItemInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        // FOR UPDATE also serializes concurrent FK references while changing the primary UOM/type.
        const [current] = await tx.select().from(items).where(eq(items.itemId, id)).for('update');
        if (!current) return null;
        const labelId = input.labelItemId === undefined ? current.labelItemId : input.labelItemId;
        const type = input.itemType ?? current.itemType;
        if (labelId !== null && type !== 'Finished Good')
            throw new AppError(409, 'Only finished goods can select a product label.');
        if (input.labelItemId !== undefined && input.labelItemId !== current.labelItemId) {
            if (input.labelItemId === id) throw new AppError(400, 'An item cannot label itself.');
            await requireLabel(tx, input.labelItemId, type);
        }
        const changesIdentity =
            (input.primaryUomId !== undefined && input.primaryUomId !== current.primaryUomId) ||
            (input.itemType !== undefined && input.itemType !== current.itemType);
        if (changesIdentity) {
            const existing = await getItem(id, tx);
            if (existing?.isInUse)
                throw new AppError(
                    409,
                    'Item type and primary UOM cannot change once the item is referenced by other records.',
                );
        }
        if (input.primaryUomId !== undefined) await requireUom(tx, input.primaryUomId);
        await tx
            .update(items)
            .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(items.itemId, id));
        return getItem(id, tx);
    });
}

async function requireLabel(
    database: Reader,
    labelItemId: number | null | undefined,
    itemType: string,
) {
    if (labelItemId == null) return;
    if (itemType !== 'Finished Good')
        throw new AppError(400, 'Only finished goods can select a product label.');
    const [label] = await database
        .select({ isActive: items.isActive, itemType: items.itemType })
        .from(items)
        .where(eq(items.itemId, labelItemId))
        .for('share');
    if (!label?.isActive || label.itemType !== 'Packaging - Label')
        throw new AppError(409, 'Select an active Packaging - Label item.');
}
