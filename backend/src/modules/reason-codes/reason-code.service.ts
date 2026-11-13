import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
    scrapReasonCodes,
    inventoryTransactions,
    countSessions,
    inventoryDisposals,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type { ReasonInput, ReasonUpdate } from './reason-code.schema.ts';
export async function listReasonCodes(database: Pick<typeof db, 'select'> = db) {
    return database.select().from(scrapReasonCodes).orderBy(asc(scrapReasonCodes.codeName));
}
export async function createReasonCode(
    input: ReasonInput,
    actorId: number,
    database: typeof db = db,
) {
    return (
        await database
            .insert(scrapReasonCodes)
            .values({ ...input, createdBy: actorId, updatedBy: actorId })
            .returning()
    )[0]!;
}
export async function updateReasonCode(
    id: number,
    input: ReasonUpdate,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const [current] = await tx
            .select()
            .from(scrapReasonCodes)
            .where(eq(scrapReasonCodes.reasonId, id))
            .for('update');
        if (!current) return null;
        if (input.category !== undefined && input.category !== current.category) {
            const [used] = await tx
                .select({
                    used: sql<boolean>`exists(select 1 from ${inventoryTransactions} where reason_id=${id}) or exists(select 1 from ${countSessions} where reason_id=${id}) or exists(select 1 from ${inventoryDisposals} where reason_id=${id})`,
                })
                .from(scrapReasonCodes)
                .where(eq(scrapReasonCodes.reasonId, id));
            if (used!.used)
                throw new AppError(409, 'The category of a referenced reason cannot be changed.');
        }
        return (
            await tx
                .update(scrapReasonCodes)
                .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
                .where(eq(scrapReasonCodes.reasonId, id))
                .returning()
        )[0]!;
    });
}
