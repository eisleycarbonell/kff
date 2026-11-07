import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { AppError } from '../src/errors/app-error.ts';
import {
    createRoleSchema,
    updateRoleSchema,
    emptyRoleSettings,
} from '../src/modules/roles/role.schema.ts';
import type { RoleService } from '../src/modules/roles/role.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-role-management-session-key';
const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');
const role = {
    roleId: 17,
    name: 'Warehouse',
    description: null,
    settings: { ...emptyRoleSettings, canManageInventory: true },
    activeUserCount: 2,
    userCount: 3,
    createdBy: 7,
    updatedBy: 7,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
};
const users: UserService = {
    listUsers: async () => [],
    getUserByID: async () => null,
    createUser: async () => {
        throw new Error('unused');
    },
    updateUser: async () => null,
    deleteUser: async () => null,
};
function service(overrides: Partial<RoleService> = {}): RoleService {
    return {
        listRoles: async () => [role],
        getRole: async () => role,
        createRole: async () => role,
        updateRole: async () => role,
        deleteRole: async () => ({ roleId: 17 }),
        ...overrides,
    };
}
async function withApi(
    roles: RoleService,
    run: (origin: string, token: string, permissions: { canManageUsers: boolean }) => Promise<void>,
) {
    const permissions = { canManageUsers: true };
    const session = {
        userId: 7,
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.test',
        roleId: 9,
        permissions,
    };
    const server = createApp({
        userService: users,
        roleService: roles,
        authService: { login: async () => session, getSessionUser: async () => session },
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    try {
        await run(
            `http://127.0.0.1:${address.port}/api/roles`,
            await generateToken({ id: '7' }, '5m'),
            permissions,
        );
    } finally {
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
            server.closeAllConnections();
        });
    }
}
const request = (token: string, method = 'GET', body?: unknown): RequestInit => ({
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test('role schemas normalize text, default to no permissions, preserve PATCH false/null and reject forged fields', () => {
    assert.deepEqual(createRoleSchema.parse({ name: '  Viewer  ' }), {
        name: 'Viewer',
        description: null,
        settings: emptyRoleSettings,
    });
    assert.deepEqual(
        updateRoleSchema.parse({ description: '', settings: { canManageInventory: false } }),
        { description: null, settings: { canManageInventory: false } },
    );
    for (const input of [
        {},
        { name: '' },
        { settings: {} },
        { settings: { canManageUsers: 'true' } },
        { settings: { canDeleteLedger: true } },
        { updatedBy: 99 },
        { userCount: 0 },
    ])
        assert.equal(updateRoleSchema.safeParse(input).success, false);
    assert.equal(createRoleSchema.safeParse({ name: 'x'.repeat(81) }).success, false);
});
test('every role endpoint requires authentication and current user-management permission', async () => {
    let calls = 0;
    await withApi(
        service({
            listRoles: async () => {
                calls++;
                return [role];
            },
        }),
        async (origin, token, permissions) => {
            assert.equal((await fetch(origin)).status, 401);
            const response = await fetch(origin, request(token));
            assert.equal(response.status, 200);
            assert.equal((await response.json()).data[0].roleId, 17);
            permissions.canManageUsers = false;
            for (const [path, method, body] of [
                ['', 'GET', undefined],
                ['/17', 'GET', undefined],
                ['', 'POST', { name: 'New' }],
                ['/17', 'PATCH', { name: 'Updated' }],
                ['/17', 'DELETE', undefined],
            ] as const) {
                assert.equal(
                    (await fetch(origin + path, request(token, method, body))).status,
                    403,
                );
            }
            assert.equal(calls, 1);
        },
    );
});
test('role writes carry validated partial permissions and server actor, while invalid inputs stop before writes', async () => {
    const received: unknown[] = [];
    await withApi(
        service({
            createRole: async (input, actor) => {
                received.push({ input, actor });
                return role;
            },
            updateRole: async (id, input, actor) => {
                received.push({ id, input, actor });
                return role;
            },
        }),
        async (origin, token) => {
            assert.equal(
                (
                    await fetch(
                        origin,
                        request(token, 'POST', {
                            name: ' Warehouse ',
                            settings: { canManageInventory: true },
                        }),
                    )
                ).status,
                201,
            );
            assert.equal(
                (
                    await fetch(
                        origin + '/17',
                        request(token, 'PATCH', {
                            description: null,
                            settings: { canManagePacking: false },
                        }),
                    )
                ).status,
                200,
            );
            assert.deepEqual(received[1], {
                id: 17,
                input: { description: null, settings: { canManagePacking: false } },
                actor: 7,
            });
            assert.deepEqual(received[0], {
                input: {
                    name: 'Warehouse',
                    description: null,
                    settings: { ...emptyRoleSettings, canManageInventory: true },
                },
                actor: 7,
            });
            for (const body of [
                { name: 'x', createdBy: 9 },
                { settings: { admin: true } },
                { settings: { canManageUsers: 1 } },
            ])
                assert.equal(
                    (await fetch(origin + '/17', request(token, 'PATCH', body))).status,
                    400,
                );
            for (const id of ['0', '-1', '1e2', '2147483648'])
                assert.equal((await fetch(origin + '/' + id, request(token))).status, 400);
            assert.equal(received.length, 2);
            assert.equal((await fetch(origin + '/17', request(token, 'DELETE'))).status, 204);
        },
    );
});
test('role not-found and protected deletion/last-manager conflicts preserve safe errors', async () => {
    await withApi(
        service({
            getRole: async () => null,
            updateRole: async () => null,
            deleteRole: async () => {
                throw new AppError(409, 'This role is assigned to users.');
            },
        }),
        async (origin, token) => {
            assert.equal((await fetch(origin + '/18', request(token))).status, 404);
            assert.equal(
                (await fetch(origin + '/18', request(token, 'PATCH', { name: 'Missing' }))).status,
                404,
            );
            const response = await fetch(origin + '/17', request(token, 'DELETE'));
            assert.equal(response.status, 409);
            assert.match((await response.json()).error.message, /assigned/);
        },
    );
});
