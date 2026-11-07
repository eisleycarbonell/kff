import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import { billOfMaterials, brands, items, uoms } from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type { CreateFormulaInput, UpdateFormulaInput } from './packing-formula.schema.ts';

type Reader = Pick<typeof db, 'select'>;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const component = alias(items, 'formula_component');
const outputUnit = alias(uoms, 'formula_output_unit');

export async function listFormulas(database: Reader = db, itemId?: number) {
    // One query keeps each displayed formula on one database snapshot.
    const rows = await database
        .select({
            itemId: items.itemId,
            itemSku: items.sku,
            itemName: items.name,
            isActive: items.isActive,
            brandName: brands.name,
            primaryUomId: items.primaryUomId,
            primaryUomName: outputUnit.name,
            bomId: billOfMaterials.bomId,
            componentItemId: component.itemId,
            componentSku: component.sku,
            componentName: component.name,
            componentIsActive: component.isActive,
            quantity: billOfMaterials.quantity,
            uomId: uoms.uomId,
            uomName: uoms.name,
            createdBy: billOfMaterials.createdBy,
            createdAt: billOfMaterials.createdAt,
            updatedBy: billOfMaterials.updatedBy,
            updatedAt: billOfMaterials.updatedAt,
        })
        .from(billOfMaterials)
        .innerJoin(items, eq(items.itemId, billOfMaterials.parentItemId))
        .leftJoin(brands, eq(brands.brandId, items.brandId))
        .innerJoin(component, eq(component.itemId, billOfMaterials.componentItemId))
        .innerJoin(uoms, eq(uoms.uomId, billOfMaterials.uomId))
        .innerJoin(outputUnit, eq(outputUnit.uomId, items.primaryUomId))
        .where(itemId === undefined ? undefined : eq(items.itemId, itemId))
        .orderBy(asc(items.name), asc(items.itemId), asc(component.itemId));
    type Row = (typeof rows)[number];
    type Formula = Pick<
        Row,
        | 'itemId'
        | 'itemSku'
        | 'itemName'
        | 'isActive'
        | 'brandName'
        | 'primaryUomId'
        | 'primaryUomName'
        | 'createdBy'
        | 'createdAt'
        | 'updatedBy'
        | 'updatedAt'
    > & {
        componentCount: number;
        components: Pick<
            Row,
            | 'bomId'
            | 'componentItemId'
            | 'componentSku'
            | 'componentName'
            | 'componentIsActive'
            | 'quantity'
            | 'uomId'
            | 'uomName'
        >[];
    };
    const groups = new Map<number, Formula>();
    for (const row of rows) {
        let group = groups.get(row.itemId);
        if (!group) {
            group = {
                itemId: row.itemId,
                itemSku: row.itemSku,
                itemName: row.itemName,
                isActive: row.isActive,
                brandName: row.brandName,
                primaryUomId: row.primaryUomId,
                primaryUomName: row.primaryUomName,
                createdBy: row.createdBy,
                createdAt: row.createdAt,
                updatedBy: row.updatedBy,
                updatedAt: row.updatedAt,
                componentCount: 0,
                components: [],
            };
            groups.set(row.itemId, group);
        }
        group.components.push({
            bomId: row.bomId,
            componentItemId: row.componentItemId,
            componentSku: row.componentSku,
            componentName: row.componentName,
            componentIsActive: row.componentIsActive,
            quantity: row.quantity,
            uomId: row.uomId,
            uomName: row.uomName,
        });
        group.componentCount++;
        if (row.updatedAt > group.updatedAt) {
            group.updatedAt = row.updatedAt;
            group.updatedBy = row.updatedBy;
        }
    }
    return [...groups.values()];
}
export async function getFormula(id: number, database: Reader = db) {
    return (await listFormulas(database, id))[0] ?? null;
}
export async function getFormulaOptions(database: Reader = db) {
    const [products, components, units] = await Promise.all([
        database
            .select({
                itemId: items.itemId,
                sku: items.sku,
                name: items.name,
                primaryUomName: uoms.name,
                hasFormula: sql<boolean>`exists(select 1 from ${billOfMaterials} where ${billOfMaterials.parentItemId}=${items.itemId})`,
            })
            .from(items)
            .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
            .where(and(eq(items.itemType, 'Finished Good'), eq(items.isActive, true)))
            .orderBy(asc(items.name)),
        database
            .select({
                itemId: items.itemId,
                sku: items.sku,
                name: items.name,
                primaryUomId: items.primaryUomId,
                uomClassId: uoms.uomClassId,
            })
            .from(items)
            .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
            .where(
                and(
                    eq(items.isActive, true),
                    inArray(items.itemType, [
                        'Raw Material - Bulk',
                        'Packaging - Hardware',
                        'Packaging - Label',
                    ]),
                ),
            )
            .orderBy(asc(items.name)),
        database
            .select({
                uomId: uoms.uomId,
                name: uoms.name,
                uomClassId: uoms.uomClassId,
                factorToBase: uoms.factorToBase,
            })
            .from(uoms)
            .orderBy(asc(uoms.name)),
    ]);
    return { products, components, uoms: units };
}
async function lockProduct(tx: Transaction, id: number) {
    const [product] = await tx.select().from(items).where(eq(items.itemId, id)).for('update');
    if (!product) throw new AppError(404, 'Finished product not found.');
    if (!product.isActive || product.itemType !== 'Finished Good')
        throw new AppError(409, 'Select an active finished product.');
}
async function validateComponents(
    tx: Transaction,
    id: number,
    components: UpdateFormulaInput['components'],
) {
    if (components.some((row) => row.componentItemId === id))
        throw new AppError(400, 'A product cannot be its own component.');
    const ids = [...new Set(components.map((row) => row.componentItemId))].sort((a, b) => a - b);
    // Key-share locks protect item definitions without conflicting with packing's shared material locks.
    const materials = await tx
        .select()
        .from(items)
        .where(inArray(items.itemId, ids))
        .orderBy(asc(items.itemId))
        .for('key share');
    for (const row of components) {
        const material = materials.find((entry) => entry.itemId === row.componentItemId);
        if (!material?.isActive || material.itemType === 'Finished Good')
            throw new AppError(
                409,
                'Components must be active raw materials, packaging, or labels.',
            );
    }
    await lockProduct(tx, id);
    const unitIds = [
        ...new Set([
            ...components.map((row) => row.uomId),
            ...materials.map((row) => row.primaryUomId),
        ]),
    ].sort((a, b) => a - b);
    const units = await tx
        .select()
        .from(uoms)
        .where(inArray(uoms.uomId, unitIds))
        .orderBy(asc(uoms.uomId))
        .for('share');
    for (const row of components) {
        const material = materials.find((entry) => entry.itemId === row.componentItemId)!;
        const selected = units.find((entry) => entry.uomId === row.uomId);
        const primary = units.find((entry) => entry.uomId === material.primaryUomId);
        if (!selected || !primary || selected.uomClassId !== primary.uomClassId)
            throw new AppError(
                400,
                'Every component unit must be compatible with its primary unit.',
            );
    }
}
async function writeRows(
    tx: Transaction,
    id: number,
    components: UpdateFormulaInput['components'],
    actorId: number,
) {
    await tx.insert(billOfMaterials).values(
        components.map((row) => ({
            ...row,
            parentItemId: id,
            createdBy: actorId,
            updatedBy: actorId,
        })),
    );
    const saved = await getFormula(id, tx);
    if (!saved) throw new Error('The formula could not be loaded.');
    return saved;
}
export async function createFormula(
    input: CreateFormulaInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        await validateComponents(tx, input.itemId, input.components);
        if (await getFormula(input.itemId, tx))
            throw new AppError(
                409,
                'This product already has a formula. Edit its existing formula.',
            );
        return writeRows(tx, input.itemId, input.components, actorId);
    });
}
export async function updateFormula(
    id: number,
    input: UpdateFormulaInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        await validateComponents(tx, id, input.components);
        if (!(await getFormula(id, tx))) return null;
        await tx.delete(billOfMaterials).where(eq(billOfMaterials.parentItemId, id));
        return writeRows(tx, id, input.components, actorId);
    });
}
export async function removeFormula(id: number, database: typeof db = db) {
    return database.transaction(async (tx) => {
        // Historical orders retain their independent material snapshot and reservations.
        const [product] = await tx.select().from(items).where(eq(items.itemId, id)).for('update');
        if (!product) return false;
        const removed = await tx
            .delete(billOfMaterials)
            .where(eq(billOfMaterials.parentItemId, id))
            .returning({ id: billOfMaterials.bomId });
        return removed.length > 0;
    });
}
