import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { brands, items } from '../../db/schema.ts';
import type { CreateBrandInput, UpdateBrandInput } from './brand.schema.ts';

type Reader = Pick<typeof db, 'select'>;
const fields = {
    brandId: brands.brandId,
    code: brands.code,
    name: brands.name,
    description: brands.description,
    isActive: brands.isActive,
    itemCount: sql<number>`(select count(*)::integer from ${items} where ${items.brandId}="brands"."brand_id")`,
    createdBy: brands.createdBy,
    createdAt: brands.createdAt,
    updatedBy: brands.updatedBy,
    updatedAt: brands.updatedAt,
};
export async function listBrands(database: Reader = db) {
    return database.select(fields).from(brands).orderBy(asc(brands.name), asc(brands.brandId));
}
export async function getBrand(id: number, database: Reader = db) {
    const [brand] = await database.select(fields).from(brands).where(eq(brands.brandId, id));
    return brand ?? null;
}
export async function createBrand(
    input: CreateBrandInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const [brand] = await tx
            .insert(brands)
            .values({
                ...input,
                description: input.description ?? null,
                createdBy: actorId,
                updatedBy: actorId,
            })
            .returning();
        if (!brand) throw new Error('The brand could not be created.');
        return getBrand(brand.brandId, tx);
    });
}
export async function updateBrand(
    id: number,
    input: UpdateBrandInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const [brand] = await tx.select().from(brands).where(eq(brands.brandId, id)).for('update');
        if (!brand) return null;
        await tx
            .update(brands)
            .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(brands.brandId, id));
        return getBrand(id, tx);
    });
}
