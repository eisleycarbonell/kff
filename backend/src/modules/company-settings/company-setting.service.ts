import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { companySettings } from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type { SettingsInput } from './company-setting.schema.ts';
export const DEFAULT_SETTINGS = {
    settingsId: 1,
    companyName: 'Kusina Filipino Food',
    address: null,
    email: null,
    phone: null,
    currencyCode: 'PHP',
    defaultReorderLevel: '10.0000',
    expiryWarningDays: 30,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: null,
    updatedAt: null,
};
export async function getSettings(database: Pick<typeof db, 'select'> = db) {
    return (
        (
            await database.select().from(companySettings).where(eq(companySettings.settingsId, 1))
        )[0] ?? DEFAULT_SETTINGS
    );
}
export async function updateSettings(
    input: SettingsInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        await tx
            .insert(companySettings)
            .values({ settingsId: 1, createdBy: actorId, updatedBy: actorId })
            .onConflictDoNothing();
        const [current] = await tx
            .select()
            .from(companySettings)
            .where(eq(companySettings.settingsId, 1))
            .for('update');
        if (current!.version !== input.expectedVersion)
            throw new AppError(409, 'Company settings changed. Refresh before saving.');
        if (input.currencyCode !== current!.currencyCode) {
            await tx.execute(
                sql`lock table purchase_order_lines,sales_order_lines,lots in share mode`,
            );
            const [history] = await tx.execute<{ used: boolean }>(
                sql`select exists(select 1 from purchase_order_lines union all select 1 from sales_order_lines union all select 1 from lots where unit_cost is not null) as used`,
            );
            if (history?.used)
                throw new AppError(
                    409,
                    'Currency cannot change after priced operational records exist.',
                );
        }
        const { expectedVersion, ...values } = input;
        return (
            await tx
                .update(companySettings)
                .set({
                    ...values,
                    version: expectedVersion + 1,
                    updatedBy: actorId,
                    updatedAt: new Date(),
                })
                .where(eq(companySettings.settingsId, 1))
                .returning()
        )[0]!;
    });
}
