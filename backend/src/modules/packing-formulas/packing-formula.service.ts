import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import { billOfMaterials, brands, items, uoms } from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type { CreateFormulaInput, UpdateFormulaInput } from './packing-formula.schema.ts';

type Reader = Pick<typeof db, 'select'>;

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
            revisionId: billOfMaterials.revisionId,
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
        | 'revisionId'
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
                revisionId: row.revisionId,
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
export async function createFormula(
    _input: CreateFormulaInput,
    _actorId: number,
    _database: typeof db = db,
): Promise<NonNullable<Awaited<ReturnType<typeof getFormula>>>> {
    throw new AppError(409, 'Create and release a Formula Revision before using a new formula.');
}
export async function updateFormula(
    _id: number,
    _input: UpdateFormulaInput,
    _actorId: number,
    _database: typeof db = db,
): Promise<Awaited<ReturnType<typeof getFormula>>> {
    throw new AppError(409, 'Prepare a Formula Revision to change a released formula.');
}
export async function removeFormula(_id: number, _database: typeof db = db): Promise<boolean> {
    throw new AppError(409, 'Prepare a Retire revision to remove a released formula.');
}
