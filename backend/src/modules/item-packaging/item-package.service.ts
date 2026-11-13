import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import {
    itemPackaging,
    items,
    uoms,
    purchaseOrderLines,
    billOfMaterials,
    formulaRevisionMaterials,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import { quantityUnits } from '../inventory-stocks/inventory-stock.rules.ts';
import type { PackageInput } from './item-package.schema.ts';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const primary = alias(uoms, 'package_primary');
const used = (itemId: number, uomId: number) =>
    sql<boolean>`exists(select 1 from ${purchaseOrderLines} where item_id=${itemId} and uom_id=${uomId}) or exists(select 1 from ${billOfMaterials} where component_item_id=${itemId} and uom_id=${uomId}) or exists(select 1 from ${formulaRevisionMaterials} where component_item_id=${itemId} and uom_id=${uomId})`;
export async function listItemPackaging(database: Pick<typeof db, 'select'> = db) {
    return database
        .select({
            packagingId: itemPackaging.packagingId,
            itemId: items.itemId,
            itemName: items.name,
            sku: items.sku,
            uomId: uoms.uomId,
            uomName: uoms.name,
            primaryUomName: primary.name,
            baseQty: itemPackaging.baseQty,
            barcode: itemPackaging.barcode,
            grossWeightG: itemPackaging.grossWeightG,
            createdBy: itemPackaging.createdBy,
            createdAt: itemPackaging.createdAt,
            updatedBy: itemPackaging.updatedBy,
            updatedAt: itemPackaging.updatedAt,
            isInUse: sql<boolean>`exists(select 1 from ${purchaseOrderLines} p where p.item_id=item_packaging.item_id and p.uom_id=item_packaging.uom_id) or exists(select 1 from ${billOfMaterials} b where b.component_item_id=item_packaging.item_id and b.uom_id=item_packaging.uom_id) or exists(select 1 from ${formulaRevisionMaterials} f where f.component_item_id=item_packaging.item_id and f.uom_id=item_packaging.uom_id)`,
        })
        .from(itemPackaging)
        .innerJoin(items, eq(items.itemId, itemPackaging.itemId))
        .innerJoin(uoms, eq(uoms.uomId, itemPackaging.uomId))
        .innerJoin(primary, eq(primary.uomId, items.primaryUomId))
        .orderBy(asc(items.name), asc(uoms.name));
}
async function validate(tx: Tx, input: PackageInput) {
    const [item] = await tx
        .select()
        .from(items)
        .where(eq(items.itemId, input.itemId))
        .for('update');
    if (!item?.isActive) throw new AppError(400, 'Select an active item.');
    const units = await tx
        .select()
        .from(uoms)
        .where(
            inArray(
                uoms.uomId,
                [...new Set([item.primaryUomId, input.uomId])].sort((a, b) => a - b),
            ),
        )
        .orderBy(asc(uoms.uomId))
        .for('share');
    const base = units.find((row) => row.uomId === item.primaryUomId);
    const pack = units.find((row) => row.uomId === input.uomId);
    if (!base || !pack || base.uomClassId !== pack.uomClassId)
        throw new AppError(400, 'The packaging unit must be compatible with the primary unit.');
    if (item.primaryUomId === input.uomId && quantityUnits(input.baseQty) !== 10000n)
        throw new AppError(400, 'A primary-unit pack must contain exactly one primary unit.');
}
export async function createItemPackage(
    input: PackageInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        await validate(tx, input);
        const [existingUse] = await tx
            .select({ used: used(input.itemId, input.uomId) })
            .from(items)
            .where(eq(items.itemId, input.itemId));
        if (existingUse!.used)
            throw new AppError(
                409,
                'This item/unit already has operational references. Configure a new unit before using it.',
            );
        const [saved] = await tx
            .insert(itemPackaging)
            .values({ ...input, createdBy: actorId, updatedBy: actorId })
            .returning();
        return (await listItemPackaging(tx)).find((row) => row.packagingId === saved!.packagingId)!;
    });
}
export async function updateItemPackage(
    id: number,
    input: PackageInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        await validate(tx, input);
        const [current] = await tx
            .select()
            .from(itemPackaging)
            .where(eq(itemPackaging.packagingId, id))
            .for('update');
        if (!current) return null;
        if (current.itemId !== input.itemId || current.uomId !== input.uomId)
            throw new AppError(409, 'A pack cannot be moved to another item or unit.');
        const [result] = await tx
            .select({ used: used(input.itemId, input.uomId) })
            .from(items)
            .where(eq(items.itemId, input.itemId));
        if (result!.used && quantityUnits(current.baseQty) !== quantityUnits(input.baseQty))
            throw new AppError(409, 'A referenced pack conversion cannot be changed.');
        await tx
            .update(itemPackaging)
            .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(itemPackaging.packagingId, id));
        return (await listItemPackaging(tx)).find((row) => row.packagingId === id)!;
    });
}
export async function removeItemPackage(id: number, database: typeof db = db) {
    return database.transaction(async (tx) => {
        const [observed] = await tx
            .select()
            .from(itemPackaging)
            .where(eq(itemPackaging.packagingId, id));
        if (!observed) return false;
        await tx.select().from(items).where(eq(items.itemId, observed.itemId)).for('update');
        const [current] = await tx
            .select()
            .from(itemPackaging)
            .where(eq(itemPackaging.packagingId, id))
            .for('update');
        if (!current) return false;
        const [result] = await tx
            .select({ used: used(current.itemId, current.uomId) })
            .from(items)
            .where(eq(items.itemId, current.itemId));
        if (result!.used) throw new AppError(409, 'Referenced packaging cannot be deleted.');
        await tx.delete(itemPackaging).where(eq(itemPackaging.packagingId, id));
        return true;
    });
}
/** Item-specific packs override the class ratio; callers still verify compatible classes. */
export async function itemUnitRatio(
    database: Pick<typeof db, 'select'>,
    itemId: number,
    uomId: number,
    sourceFactor: string,
    primaryFactor: string,
) {
    const [pack] = await database
        .select({ baseQty: itemPackaging.baseQty })
        .from(itemPackaging)
        .where(and(eq(itemPackaging.itemId, itemId), eq(itemPackaging.uomId, uomId)));
    return pack
        ? { sourceFactor: pack.baseQty, primaryFactor: '1' }
        : { sourceFactor, primaryFactor };
}
