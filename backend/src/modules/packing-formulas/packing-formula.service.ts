import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import { billOfMaterials, items, uoms } from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type { CreateFormulaInput, UpdateFormulaInput } from './packing-formula.schema.ts';

type Reader = Pick<typeof db, 'select'>;
type FormulaTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const component = alias(items, 'formula_component');
const label = alias(items, 'formula_label');
const outputUnit = alias(uoms, 'formula_output_unit');

export async function listFormulas(database: Reader = db, itemId?: number) {
    // One query keeps each displayed formula on one database snapshot.
    const rows = await database
        .select({
            itemId: items.itemId,
            itemSku: items.sku,
            itemName: items.name,
            isActive: items.isActive,
            labelItemName: label.name,
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
        .leftJoin(label, eq(label.itemId, items.labelItemId))
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
        | 'labelItemName'
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
                labelItemName: row.labelItemName,
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
export async function getFormula(
    id: number,
    database: Reader = db,
): Promise<Awaited<ReturnType<typeof listFormulas>>[number] | null> {
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
                labelItemId: items.labelItemId,
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
                itemType: items.itemType,
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
async function replaceFormulaRows(
    tx: FormulaTransaction,
    itemId: number,
    components: CreateFormulaInput['components'],
    actorId: number,
    mode: 'create' | 'update',
): Promise<boolean> {
    const [product] = await tx.select().from(items).where(eq(items.itemId, itemId)).for('update');
    if (mode === 'update' && !product) return false;
    const existing = await tx
        .select({
            bomId: billOfMaterials.bomId,
            createdBy: billOfMaterials.createdBy,
            createdAt: billOfMaterials.createdAt,
        })
        .from(billOfMaterials)
        .where(eq(billOfMaterials.parentItemId, itemId))
        .orderBy(asc(billOfMaterials.bomId));
    if (mode === 'create' && existing.length > 0)
        throw new AppError(409, 'A packing formula already exists for this product. Edit it instead.');
    if (mode === 'update' && existing.length === 0) return false;
    if (!product?.isActive || product.itemType !== 'Finished Good')
        throw new AppError(400, 'Choose an active finished product.');

    const componentIds = [...new Set(components.map((row) => row.componentItemId))].sort(
        (a, b) => a - b,
    );
    const materials = componentIds.length
        ? await tx
            .select()
            .from(items)
            .where(inArray(items.itemId, componentIds))
            .orderBy(asc(items.itemId))
            .for('key share')
        : [];
    const unitIds = [
        ...new Set([
            ...components.map((row) => row.uomId),
            ...materials.map((row) => row.primaryUomId),
        ]),
    ].sort((a, b) => a - b);
    const units = unitIds.length
        ? await tx
            .select()
            .from(uoms)
            .where(inArray(uoms.uomId, unitIds))
            .orderBy(asc(uoms.uomId))
            .for('share')
        : [];
    for (const row of components) {
        const material = materials.find((entry) => entry.itemId === row.componentItemId);
        const unit = units.find((entry) => entry.uomId === row.uomId);
        const primary = units.find((entry) => entry.uomId === material?.primaryUomId);
        if (
            !material?.isActive ||
            material.itemType === 'Finished Good' ||
            material.itemId === itemId ||
            !unit ||
            !primary ||
            unit.uomClassId !== primary.uomClassId
        )
            throw new AppError(
                400,
                'Every formula component must be active, distinct from its product, and use a compatible unit.',
            );
    }

    if (mode === 'update')
        await tx.delete(billOfMaterials).where(eq(billOfMaterials.parentItemId, itemId));

    const now = new Date();
    const createdBy = existing[0]?.createdBy ?? actorId;
    const createdAt = existing[0]?.createdAt ?? now;
    await tx.insert(billOfMaterials).values(
        components.map((row) => ({
            parentItemId: itemId,
            componentItemId: row.componentItemId,
            quantity: row.quantity,
            uomId: row.uomId,
            revisionId: null,
            createdBy,
            createdAt,
            updatedBy: actorId,
            updatedAt: now,
        })),
    );
    return true;
}
export async function createFormula(
    input: CreateFormulaInput,
    actorId: number,
    database: typeof db = db,
): Promise<NonNullable<Awaited<ReturnType<typeof getFormula>>>> {
    return database.transaction(async (tx) => {
        await replaceFormulaRows(tx, input.itemId, input.components, actorId, 'create');
        return (await getFormula(input.itemId, tx))!;
    });
}
export async function updateFormula(
    id: number,
    input: UpdateFormulaInput,
    actorId: number,
    database: typeof db = db,
): Promise<Awaited<ReturnType<typeof getFormula>>> {
    return database.transaction(async (tx) => {
        const updated = await replaceFormulaRows(tx, id, input.components, actorId, 'update');
        return updated ? await getFormula(id, tx) : null;
    });
}
export async function removeFormula(id: number, database: typeof db = db): Promise<boolean> {
    return database.transaction(async (tx) => {
        await tx.select().from(items).where(eq(items.itemId, id)).for('update');
        const deleted = await tx
            .delete(billOfMaterials)
            .where(eq(billOfMaterials.parentItemId, id))
            .returning({ bomId: billOfMaterials.bomId });
        return deleted.length > 0;
    });
}
