import { and, eq, isNull, sql } from 'drizzle-orm';
import type { db } from '../../db/index.ts';
import { roles, users } from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Role and account writes share a lock so concurrent changes cannot remove every manager. */
export async function lockAccessManagement(transaction: Transaction, actorId: number) {
    await transaction.execute(sql`select pg_advisory_xact_lock(1262896723, 1701)`);
    const [actor] = await transaction
        .select({ settings: roles.settings })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.roleId))
        .where(and(eq(users.userId, actorId), isNull(users.deletedAt)))
        .limit(1);
    if (actor?.settings.canManageUsers !== true) {
        throw new AppError(403, 'Your role does not allow managing users and roles.');
    }
}

export async function requireAssignedRole(transaction: Transaction, roleId: number) {
    const [role] = await transaction
        .select({ roleId: roles.roleId })
        .from(roles)
        .where(eq(roles.roleId, roleId))
        .for('key share');
    if (!role) throw new AppError(400, 'Select an existing role.');
}

export async function requireRemainingUserManager(transaction: Transaction) {
    const [manager] = await transaction
        .select({ userId: users.userId })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.roleId))
        .where(
            and(isNull(users.deletedAt), sql`${roles.settings}->'canManageUsers' = 'true'::jsonb`),
        )
        .limit(1);
    if (!manager)
        throw new AppError(
            409,
            'Keep at least one active user with permission to manage users and roles. Assign another manager before making this change.',
        );
}
