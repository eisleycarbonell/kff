import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { roles, users } from '../src/db/schema.ts';
import { exportApplicationSchema, rebuildApplicationSchema } from '../src/db/test-database.ts';
import { emptyRoleSettings } from '../src/modules/roles/role.schema.ts';

const url = process.env.TEST_DATABASE_URL;
test(
    'role and user writes enforce audit, dynamic assignments, concurrent last-manager protection and reference locks',
    { skip: !url },
    async () => {
        const schemaName = `kff_access_${randomBytes(8).toString('hex')}`;
        const client = postgres(url!, {
            max: 5,
            connection: { search_path: schemaName },
            onnotice: () => {},
        });
        const database = drizzle({ client });
        const roleService = await import('../src/modules/roles/role.service.ts');
        const userService = await import('../src/modules/users/user.service.ts');
        try {
            await client.unsafe(`create schema "${schemaName}"`);
            await rebuildApplicationSchema(database, await exportApplicationSchema(), schemaName, {
                KFF_ALLOW_TEST_DATA: 'true',
            });
            const [initial] = await database
                .insert(roles)
                .values({ name: 'Initial manager', settings: { canManageUsers: true } })
                .returning();
            const [actor] = await database
                .insert(users)
                .values({
                    firstName: 'Initial',
                    lastName: 'Manager',
                    email: 'initial@example.test',
                    passwordHash: 'test-initial-hash',
                    roleId: initial!.roleId,
                })
                .returning();
            const actorId = actor!.userId;
            const viewer = await roleService.createRole(
                { name: 'Viewer', description: null, settings: emptyRoleSettings },
                actorId,
                database,
            );
            assert.equal(viewer.userCount, 0);
            assert.equal(viewer.activeUserCount, 0);
            const createdUser = await userService.createUser(
                {
                    firstName: 'Team',
                    lastName: 'Member',
                    email: 'member@example.test',
                    password: 'RoleTest123!',
                    roleId: viewer.roleId,
                },
                actorId,
                database,
            );
            assert.equal(createdUser.createdBy, actorId);
            assert.equal(createdUser.updatedBy, actorId);
            assert.equal('passwordHash' in createdUser, false);
            assert.equal((await roleService.getRole(viewer.roleId, database))!.activeUserCount, 1);
            const listed = await roleService.listRoles(database);
            assert.equal(listed.find((role) => role.roleId === viewer.roleId)!.userCount, 1);
            assert.equal(listed.find((role) => role.roleId === initial!.roleId)!.userCount, 1);
            await assert.rejects(
                userService.createUser(
                    {
                        firstName: 'Bad',
                        lastName: 'Role',
                        email: 'invalid@example.test',
                        password: 'RoleTest123!',
                        roleId: 2147483647,
                    },
                    actorId,
                    database,
                ),
                (error: unknown) =>
                    (error as { statusCode?: number }).statusCode === 400 ||
                    /existing role/.test(String(error)),
            );
            await assert.rejects(
                roleService.deleteRole(viewer.roleId, actorId, database),
                /assigned/,
            );
            await userService.deleteUser(createdUser.userId, actorId, database);
            assert.equal((await roleService.getRole(viewer.roleId, database))!.activeUserCount, 0);
            assert.equal((await roleService.getRole(viewer.roleId, database))!.userCount, 1);
            await assert.rejects(
                roleService.deleteRole(viewer.roleId, actorId, database),
                /assigned/,
            );

            const changed = await roleService.updateRole(
                viewer.roleId,
                { settings: { canManageInventory: true, canManagePacking: true } },
                actorId,
                database,
            );
            const partial = await roleService.updateRole(
                viewer.roleId,
                { description: null, settings: { canManagePacking: false } },
                actorId,
                database,
            );
            assert.equal(changed!.updatedBy, actorId);
            assert.equal(partial!.settings.canManageInventory, true);
            assert.equal(partial!.settings.canManagePacking, false);
            await assert.rejects(
                roleService.updateRole(
                    initial!.roleId,
                    { settings: { canManageUsers: false } },
                    actorId,
                    database,
                ),
                /at least one active user/,
            );
            assert.equal(
                (await roleService.getRole(initial!.roleId, database))!.settings.canManageUsers,
                true,
            );
            await assert.rejects(
                userService.updateUser(actorId, { roleId: viewer.roleId }, actorId, database),
                /at least one active user/,
            );
            await assert.rejects(
                userService.deleteUser(actorId, actorId, database),
                /at least one active user/,
            );
            assert.equal(
                (await userService.getUserByID(actorId, database))!.roleId,
                initial!.roleId,
            );

            const duplicates = await Promise.allSettled([
                roleService.createRole(
                    { name: 'Dispatcher', description: null, settings: emptyRoleSettings },
                    actorId,
                    database,
                ),
                roleService.createRole(
                    { name: 'dispatcher', description: null, settings: emptyRoleSettings },
                    actorId,
                    database,
                ),
            ]);
            assert.equal(duplicates.filter((result) => result.status === 'fulfilled').length, 1);
            const second = await roleService.createRole(
                {
                    name: 'Second manager',
                    description: null,
                    settings: { ...emptyRoleSettings, canManageUsers: true },
                },
                actorId,
                database,
            );
            const secondUser = await userService.createUser(
                {
                    firstName: 'Second',
                    lastName: 'Manager',
                    email: 'second@example.test',
                    roleId: second.roleId,
                    password: 'RoleTest123!',
                },
                actorId,
                database,
            );
            const demotions = await Promise.allSettled([
                roleService.updateRole(
                    initial!.roleId,
                    { settings: { canManageUsers: false } },
                    actorId,
                    database,
                ),
                userService.updateUser(
                    secondUser.userId,
                    { roleId: viewer.roleId },
                    secondUser.userId,
                    database,
                ),
            ]);
            assert.equal(demotions.filter((result) => result.status === 'fulfilled').length, 1);
            const remaining = await database
                .select({ userId: users.userId })
                .from(users)
                .innerJoin(roles, eq(users.roleId, roles.roleId))
                .where(
                    sql`${users.deletedAt} is null and ${roles.settings}->'canManageUsers' = 'true'::jsonb`,
                );
            assert.equal(remaining.length, 1);
            const revokedId = remaining[0]!.userId === actorId ? secondUser.userId : actorId;
            await assert.rejects(
                roleService.createRole(
                    { name: 'Unauthorized', description: null, settings: emptyRoleSettings },
                    revokedId,
                    database,
                ),
                /does not allow/,
            );
            const disposable = await roleService.createRole(
                { name: 'Unused', description: null, settings: emptyRoleSettings },
                remaining[0]!.userId,
                database,
            );
            assert.ok(
                await roleService.deleteRole(disposable.roleId, remaining[0]!.userId, database),
            );
            assert.equal(await roleService.getRole(disposable.roleId, database), null);
        } finally {
            await client.unsafe(`drop schema if exists "${schemaName}" cascade`);
            await client.end({ timeout: 5 });
        }
    },
);
