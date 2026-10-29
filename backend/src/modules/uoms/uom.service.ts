import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
    uoms,
    uomClasses,
    items,
    supplierItems,
    billOfMaterials,
    itemPackaging,
    purchaseOrderLines,
    packingOrderMaterials,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type { CreateUomInput, UpdateUomInput, UomClassInput } from './uom.schema.ts';
import {
    assertUomChange,
    assertUomDefinition,
    assertUomCanBeDeleted,
    assertClassCanBeDeleted,
} from './uom.rules.ts';
type Reader = Pick<typeof db, 'select'>;
const isInUse = sql<boolean>`(
 exists(select 1 from ${items} where ${items.primaryUomId}=${uoms.uomId}) or
 exists(select 1 from ${supplierItems} where ${supplierItems.defaultUomId}=${uoms.uomId}) or
 exists(select 1 from ${billOfMaterials} where ${billOfMaterials.uomId}=${uoms.uomId}) or
 exists(select 1 from ${itemPackaging} where ${itemPackaging.uomId}=${uoms.uomId}) or
 exists(select 1 from ${purchaseOrderLines} where ${purchaseOrderLines.uomId}=${uoms.uomId}) or
 exists(select 1 from ${packingOrderMaterials} where ${packingOrderMaterials.uomId}=${uoms.uomId})
)`;
const isClassAnchor = sql<boolean>`(${uoms.isBase} and exists(select 1 from ${uoms} as other_uoms where other_uoms.uom_class_id=${uoms.uomClassId} and other_uoms.uom_id<>${uoms.uomId}))`;
const fields = {
    uomId: uoms.uomId,
    name: uoms.name,
    uomClassId: uoms.uomClassId,
    uomClassName: uomClasses.name,
    factorToBase: uoms.factorToBase,
    isBase: uoms.isBase,
    isInUse,
    isClassAnchor,
    createdBy: uoms.createdBy,
    createdAt: uoms.createdAt,
    updatedBy: uoms.updatedBy,
    updatedAt: uoms.updatedAt,
};
const query = (database: Reader = db) =>
    database
        .select(fields)
        .from(uoms)
        .innerJoin(uomClasses, eq(uoms.uomClassId, uomClasses.uomClassId));
const classFields = {
    uomClassId: uomClasses.uomClassId,
    name: uomClasses.name,
    unitCount: sql<number>`(select count(*) from ${uoms} where ${uoms.uomClassId}=${uomClasses.uomClassId})::integer`,
    baseUomName: sql<
        string | null
    >`(select ${uoms.name} from ${uoms} where ${uoms.uomClassId}=${uomClasses.uomClassId} and ${uoms.isBase} limit 1)`,
    createdBy: uomClasses.createdBy,
    createdAt: uomClasses.createdAt,
    updatedBy: uomClasses.updatedBy,
    updatedAt: uomClasses.updatedAt,
};
export async function listUoms() {
    return query().orderBy(asc(uomClasses.name), asc(uoms.name));
}
export async function getUom(
    id: number,
    database: Reader = db,
): Promise<Awaited<ReturnType<typeof listUoms>>[number] | null> {
    const [unit] = await query(database).where(eq(uoms.uomId, id)).limit(1);
    return unit ?? null;
}
export async function listUomClasses() {
    return db.select(classFields).from(uomClasses).orderBy(asc(uomClasses.name));
}
async function getClass(
    id: number,
    database: Reader,
): Promise<Awaited<ReturnType<typeof listUomClasses>>[number] | null> {
    const [record] = await database
        .select(classFields)
        .from(uomClasses)
        .where(eq(uomClasses.uomClassId, id))
        .limit(1);
    return record ?? null;
}
async function lockClasses(database: Reader, ids: number[]) {
    const unique = [...new Set(ids)].sort((a, b) => a - b);
    const records = await database
        .select({ id: uomClasses.uomClassId })
        .from(uomClasses)
        .where(inArray(uomClasses.uomClassId, unique))
        .orderBy(asc(uomClasses.uomClassId))
        .for('update');
    if (records.length !== unique.length) throw new AppError(400, 'Select an existing unit class.');
}
async function hasOtherBase(database: Reader, classId: number, excludeId?: number) {
    const [base] = await database
        .select({ id: uoms.uomId })
        .from(uoms)
        .where(
            and(
                eq(uoms.uomClassId, classId),
                eq(uoms.isBase, true),
                excludeId === undefined ? undefined : ne(uoms.uomId, excludeId),
            ),
        )
        .limit(1);
    return Boolean(base);
}
export async function createUom(input: CreateUomInput, actorId: number) {
    return db.transaction(async (tx) => {
        await lockClasses(tx, [input.uomClassId]);
        assertUomDefinition(input, await hasOtherBase(tx, input.uomClassId));
        const [created] = await tx
            .insert(uoms)
            .values({ ...input, createdBy: actorId, updatedBy: actorId })
            .returning({ id: uoms.uomId });
        if (!created) throw new Error('The unit could not be created.');
        const saved = await getUom(created.id, tx);
        if (!saved) throw new Error('The saved unit could not be loaded.');
        return saved;
    });
}
export async function updateUom(id: number, input: UpdateUomInput, actorId: number) {
    return db.transaction(async (tx) => {
        const observed = await getUom(id, tx);
        if (!observed) return null;
        // Ordered parent locks serialize base-unit changes and class deletion.
        await lockClasses(tx, [observed.uomClassId, input.uomClassId ?? observed.uomClassId]);
        const [locked] = await tx.select().from(uoms).where(eq(uoms.uomId, id)).for('update');
        if (!locked) return null;
        if (locked.uomClassId !== observed.uomClassId)
            throw new AppError(409, 'This unit changed. Refresh before editing it.');
        const current = await getUom(id, tx);
        if (!current) return null;
        const next = {
            name: input.name ?? current.name,
            uomClassId: input.uomClassId ?? current.uomClassId,
            factorToBase: input.factorToBase ?? current.factorToBase,
            isBase: input.isBase ?? current.isBase,
        };
        assertUomChange(current, next);
        assertUomDefinition(next, await hasOtherBase(tx, next.uomClassId, id));
        await tx
            .update(uoms)
            .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(uoms.uomId, id));
        return getUom(id, tx);
    });
}
export async function deleteUom(id: number) {
    return db.transaction(async (tx) => {
        const observed = await getUom(id, tx);
        if (!observed) return null;
        await lockClasses(tx, [observed.uomClassId]);
        const [locked] = await tx.select().from(uoms).where(eq(uoms.uomId, id)).for('update');
        if (!locked) return null;
        if (locked.uomClassId !== observed.uomClassId)
            throw new AppError(409, 'This unit changed. Refresh before deleting it.');
        const current = await getUom(id, tx);
        if (!current) return null;
        assertUomCanBeDeleted(current);
        const [removed] = await tx
            .delete(uoms)
            .where(eq(uoms.uomId, id))
            .returning({ uomId: uoms.uomId });
        return removed ?? null;
    });
}
export async function createUomClass(input: UomClassInput, actorId: number) {
    return db.transaction(async (tx) => {
        const [created] = await tx
            .insert(uomClasses)
            .values({ ...input, createdBy: actorId, updatedBy: actorId })
            .returning({ id: uomClasses.uomClassId });
        if (!created) throw new Error('The unit class could not be created.');
        const saved = await getClass(created.id, tx);
        if (!saved) throw new Error('The saved class could not be loaded.');
        return saved;
    });
}
export async function updateUomClass(id: number, input: UomClassInput, actorId: number) {
    return db.transaction(async (tx) => {
        const [current] = await tx
            .select({ id: uomClasses.uomClassId })
            .from(uomClasses)
            .where(eq(uomClasses.uomClassId, id))
            .for('update');
        if (!current) return null;
        await tx
            .update(uomClasses)
            .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(uomClasses.uomClassId, id));
        return getClass(id, tx);
    });
}
export async function deleteUomClass(id: number) {
    return db.transaction(async (tx) => {
        const [locked] = await tx
            .select({ id: uomClasses.uomClassId })
            .from(uomClasses)
            .where(eq(uomClasses.uomClassId, id))
            .for('update');
        if (!locked) return null;
        const current = await getClass(id, tx);
        if (!current) return null;
        assertClassCanBeDeleted(current.unitCount);
        const [removed] = await tx
            .delete(uomClasses)
            .where(eq(uomClasses.uomClassId, id))
            .returning({ uomClassId: uomClasses.uomClassId });
        return removed ?? null;
    });
}
