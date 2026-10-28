import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
    items,
    uoms,
    uomClasses,
    supplierItems,
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
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type { CreateItemInput, UpdateItemInput } from './item.schema.ts';

// Indexed existence checks protect stored quantities and material relationships.
const isInUse = sql<boolean>`(
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
    exists (select 1 from ${stockTransferLines} where ${stockTransferLines.itemId} = ${items.itemId})
)`;

const itemFields = {
    itemId: items.itemId,
    sku: items.sku,
    name: items.name,
    itemType: items.itemType,
    primaryUomId: items.primaryUomId,
    primaryUomName: uoms.name,
    uomClassName: uomClasses.name,
    netWeightG: items.netWeightG,
    shelfLifeDays: items.shelfLifeDays,
    requiresQc: items.requiresQc,
    unitCost: items.unitCost,
    isActive: items.isActive,
    createdBy: items.createdBy,
    createdAt: items.createdAt,
    updatedBy: items.updatedBy,
    updatedAt: items.updatedAt,
    isInUse,
};
type Reader = Pick<typeof db, 'select'>;
const itemQuery = (database: Reader = db) =>
    database
        .select(itemFields)
        .from(items)
        .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
        .innerJoin(uomClasses, eq(uoms.uomClassId, uomClasses.uomClassId));

export async function listItems() {
    return itemQuery().orderBy(asc(items.name), asc(items.itemId));
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
export async function createItem(input: CreateItemInput, actorId: number) {
    return db.transaction(async (tx) => {
        await requireUom(tx, input.primaryUomId);
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
export async function updateItem(id: number, input: UpdateItemInput, actorId: number) {
    return db.transaction(async (tx) => {
        // FOR UPDATE also serializes concurrent FK references while changing the primary UOM/type.
        const [current] = await tx.select().from(items).where(eq(items.itemId, id)).for('update');
        if (!current) return null;
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
