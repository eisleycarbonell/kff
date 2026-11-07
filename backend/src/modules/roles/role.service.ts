import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { roles, users, type RoleSettings } from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import { lockAccessManagement, requireRemainingUserManager } from '../auth/access-policy.ts';
import { emptyRoleSettings, type CreateRoleInput, type UpdateRoleInput } from './role.schema.ts';

const assignments = db
    .select({
        roleId: users.roleId,
        userCount: sql<number>`count(*)::int`.as('user_count'),
        activeUserCount: sql<number>`(count(*) filter (where ${users.deletedAt} is null))::int`.as(
            'active_user_count',
        ),
    })
    .from(users)
    .groupBy(users.roleId)
    .as('role_assignments');

const fields = {
    roleId: roles.roleId,
    name: roles.name,
    description: roles.description,
    settings: roles.settings,
    userCount: sql<number>`coalesce(${assignments.userCount}, 0)`,
    activeUserCount: sql<number>`coalesce(${assignments.activeUserCount}, 0)`,
    createdBy: roles.createdBy,
    createdAt: roles.createdAt,
    updatedBy: roles.updatedBy,
    updatedAt: roles.updatedAt,
};
type Reader = Pick<typeof db, 'select'>;
const publicRole = <T extends { settings: RoleSettings }>(role: T) => ({
    ...role,
    settings: Object.fromEntries(
        Object.keys(emptyRoleSettings).map((key) => [
            key,
            role.settings[key as keyof RoleSettings] === true,
        ]),
    ) as typeof emptyRoleSettings,
});
export async function listRoles(database: Reader = db) {
    const rows = await database
        .select(fields)
        .from(roles)
        .leftJoin(assignments, eq(assignments.roleId, roles.roleId))
        .orderBy(asc(roles.name), asc(roles.roleId));
    return rows.map(publicRole);
}
export async function getRole(id: number, database: Reader = db) {
    const [role] = await database
        .select(fields)
        .from(roles)
        .leftJoin(assignments, eq(assignments.roleId, roles.roleId))
        .where(eq(roles.roleId, id))
        .limit(1);
    return role ? publicRole(role) : null;
}
async function requireUniqueName(database: Reader, name: string, exceptId?: number) {
    const [existing] = await database
        .select({ roleId: roles.roleId })
        .from(roles)
        .where(
            and(
                eq(sql`lower(trim(${roles.name}))`, name.toLowerCase()),
                exceptId === undefined ? undefined : ne(roles.roleId, exceptId),
            ),
        )
        .limit(1);
    if (existing) throw new AppError(409, 'A role with this name already exists.');
}
export async function createRole(input: CreateRoleInput, actorId: number, database = db) {
    return database.transaction(async (tx) => {
        await lockAccessManagement(tx, actorId);
        await requireUniqueName(tx, input.name);
        const [created] = await tx
            .insert(roles)
            .values({ ...input, createdBy: actorId, updatedBy: actorId })
            .returning({ id: roles.roleId });
        const role = await getRole(created!.id, tx);
        if (!role) throw new Error('The created role could not be loaded.');
        return role;
    });
}
export async function updateRole(
    id: number,
    input: UpdateRoleInput,
    actorId: number,
    database = db,
) {
    return database.transaction(async (tx) => {
        await lockAccessManagement(tx, actorId);
        const current = await getRole(id, tx);
        if (!current) return null;
        if (input.name !== undefined) await requireUniqueName(tx, input.name, id);
        await tx
            .update(roles)
            .set({
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.description !== undefined ? { description: input.description } : {}),
                ...(input.settings !== undefined
                    ? { settings: { ...current.settings, ...input.settings } }
                    : {}),
                updatedBy: actorId,
                updatedAt: new Date(),
            })
            .where(eq(roles.roleId, id));
        await requireRemainingUserManager(tx);
        return getRole(id, tx);
    });
}
export async function deleteRole(id: number, actorId: number, database = db) {
    return database.transaction(async (tx) => {
        await lockAccessManagement(tx, actorId);
        const current = await getRole(id, tx);
        if (!current) return null;
        if (current.userCount > 0)
            throw new AppError(
                409,
                'This role is assigned to active or archived users and cannot be deleted.',
            );
        await tx.delete(roles).where(eq(roles.roleId, id));
        return { roleId: id };
    });
}
