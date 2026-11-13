import { asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { reorderPolicies, items, uoms } from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
const fields = {
    itemId: items.itemId,
    itemName: items.name,
    sku: items.sku,
    primaryUomName: uoms.name,
    reorderLevel: reorderPolicies.reorderLevel,
    createdBy: reorderPolicies.createdBy,
    createdAt: reorderPolicies.createdAt,
    updatedBy: reorderPolicies.updatedBy,
    updatedAt: reorderPolicies.updatedAt,
};
export async function listReorderPolicies(database: Pick<typeof db, 'select'> = db) {
    return database
        .select(fields)
        .from(reorderPolicies)
        .innerJoin(items, eq(items.itemId, reorderPolicies.itemId))
        .innerJoin(uoms, eq(uoms.uomId, items.primaryUomId))
        .orderBy(asc(items.name));
}
export async function createReorderPolicy(
    input: { itemId: number; reorderLevel: string },
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const [item] = await tx
            .select()
            .from(items)
            .where(eq(items.itemId, input.itemId))
            .for('update');
        if (!item?.isActive) throw new AppError(400, 'Select an active item.');
        await tx
            .insert(reorderPolicies)
            .values({ ...input, createdBy: actorId, updatedBy: actorId });
        return (await listReorderPolicies(tx)).find((row) => row.itemId === input.itemId)!;
    });
}
export async function updateReorderPolicy(
    id: number,
    input: { reorderLevel: string },
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        await tx.select().from(items).where(eq(items.itemId, id)).for('update');
        const [saved] = await tx
            .update(reorderPolicies)
            .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(reorderPolicies.itemId, id))
            .returning();
        return saved ? (await listReorderPolicies(tx)).find((row) => row.itemId === id)! : null;
    });
}
export async function removeReorderPolicy(id: number, database: typeof db = db) {
    return database.transaction(async (tx) => {
        await tx.select().from(items).where(eq(items.itemId, id)).for('update');
        return (
            (await tx.delete(reorderPolicies).where(eq(reorderPolicies.itemId, id)).returning())
                .length > 0
        );
    });
}
