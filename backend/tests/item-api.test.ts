import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { ItemService } from '../src/modules/items/item.controller.ts';
import type { AuthService } from '../src/modules/auth/auth.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import type { CreateItemInput, UpdateItemInput } from '../src/modules/items/item.schema.ts';
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-item-session-signing-key-not-for-deployment';
const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');
const manager: SessionUser = {
    userId: 7,
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'manager@example.com',
    roleId: 2,
    permissions: { canManageInventory: true },
};
const item: Awaited<ReturnType<ItemService['createItem']>> = {
    itemId: 10,
    sku: 'RM-GARLIC',
    name: 'Garlic powder',
    itemType: 'Raw Material - Bulk',
    primaryUomId: 1,
    primaryUomName: 'kg',
    uomClassName: 'Mass',
    unitCost: '110.0000',
    netWeightG: null,
    shelfLifeDays: null,
    requiresQc: false,
    isActive: true,
    isInUse: false,
    createdBy: 7,
    updatedBy: 7,
    createdAt: new Date('2026-10-27T00:00:00Z'),
    updatedAt: new Date('2026-10-27T00:00:00Z'),
};
const users: UserService = {
    listUsers: async () => [],
    getUserByID: async () => null,
    createUser: async () => {
        throw new Error('Not used');
    },
    updateUser: async () => null,
    deleteUser: async () => null,
};
function fakeItems(overrides: Partial<ItemService> = {}): ItemService {
    return {
        listItems: async () => [item],
        getItem: async () => item,
        listItemUoms: async () => [{ uomId: 1, name: 'kg', uomClassId: 1, uomClassName: 'Mass' }],
        createItem: async (input, actor) => ({
            ...item,
            ...input,
            createdBy: actor,
            updatedBy: actor,
        }),
        updateItem: async (_id, input, actor) => ({ ...item, ...input, updatedBy: actor }),
        ...overrides,
    };
}
function fakeAuth(user: SessionUser = manager): AuthService {
    return {
        login: async (input) => (input.password === 'valid-password' ? user : null),
        getSessionUser: async (id) => (id === user.userId ? user : null),
    };
}
const json = (method: string, body: unknown, cookie?: string): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
});
async function withApi(
    service: ItemService,
    run: (origin: string) => Promise<void>,
    auth = fakeAuth(),
) {
    const server = createApp({
        userService: users,
        itemService: service,
        authService: auth,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    try {
        await run(`http://127.0.0.1:${address.port}`);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
    }
}
async function signIn(origin: string) {
    const response = await fetch(
        `${origin}/api/auth/login`,
        json('POST', { username: manager.email, password: 'valid-password' }),
    );
    assert.equal(response.status, 200);
    await response.json();
    const cookie = response.headers.get('set-cookie');
    assert.ok(cookie);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    return cookie.split(';')[0];
}
const validInput = {
    sku: ' rm-garlic ',
    name: ' Garlic powder ',
    itemType: 'Raw Material - Bulk',
    primaryUomId: 1,
    unitCost: '110.1234',
    netWeightG: null,
    shelfLifeDays: null,
    requiresQc: false,
    isActive: true,
};

test('item endpoints reject anonymous and invalid sessions before service calls', async () => {
    let calls = 0;
    await withApi(
        fakeItems({
            listItems: async () => {
                calls++;
                return [item];
            },
        }),
        async (origin) => {
            for (const headers of [
                {},
                { Authorization: 'Bearer invalid' },
                { Cookie: 'jwt=%ZZ' },
            ] as HeadersInit[]) {
                const response = await fetch(`${origin}/api/items`, { headers });
                assert.equal(response.status, 401);
                await response.json();
            }
            const expired = await generateToken({ id: '7' }, 0);
            const response = await fetch(`${origin}/api/items`, {
                headers: { Authorization: `Bearer ${expired}` },
            });
            assert.equal(response.status, 401);
            await response.json();
            assert.equal(calls, 0);
        },
    );
});
test('login validates input, checks credentials, creates a cookie, and exposes a public session', async () => {
    await withApi(fakeItems(), async (origin) => {
        const invalid = await fetch(
            `${origin}/api/auth/login`,
            json('POST', { username: 'not-email', password: '' }),
        );
        assert.equal(invalid.status, 400);
        await invalid.json();
        const denied = await fetch(
            `${origin}/api/auth/login`,
            json('POST', { username: manager.email, password: 'wrong' }),
        );
        assert.equal(denied.status, 401);
        await denied.json();
        const cookie = await signIn(origin);
        const session = await fetch(`${origin}/api/auth/session`, { headers: { Cookie: cookie } });
        assert.deepEqual(await session.json(), { success: true, data: manager });
        const logout = await fetch(`${origin}/api/auth/logout`, {
            method: 'POST',
            headers: { Cookie: cookie },
        });
        assert.equal(logout.status, 200);
        await logout.json();
        assert.match(logout.headers.get('set-cookie') ?? '', /Expires=/);
    });
});
test('login reports database connection failures safely and can recover without issuing a failed session', async () => {
    const failures = [
        new Error('private query and password parameters', {
            cause: Object.assign(new Error('private database endpoint'), {
                code: 'CONNECT_TIMEOUT',
            }),
        }),
        new Error('private query and password parameters', {
            cause: new AggregateError([
                Object.assign(new Error('private IPv4 endpoint'), { code: 'ETIMEDOUT' }),
                Object.assign(new Error('private IPv6 endpoint'), { code: 'ENETUNREACH' }),
            ]),
        }),
    ];

    for (const failure of failures) {
        let unavailable = true;
        const healthyAuth = fakeAuth();
        await withApi(
            fakeItems(),
            async (origin) => {
                const response = await fetch(
                    `${origin}/api/auth/login`,
                    json('POST', { username: manager.email, password: 'valid-password' }),
                );
                assert.equal(response.status, 503);
                assert.equal(response.headers.get('set-cookie'), null);
                assert.deepEqual(await response.json(), {
                    success: false,
                    error: {
                        message: 'The database is temporarily unavailable. Please try again later.',
                    },
                });

                unavailable = false;
                const cookie = await signIn(origin);
                const session = await fetch(`${origin}/api/auth/session`, {
                    headers: { Cookie: cookie },
                });
                assert.equal(session.status, 200);
                assert.deepEqual(await session.json(), { success: true, data: manager });
            },
            {
                ...healthyAuth,
                login: async (input) => {
                    if (unavailable) throw failure;
                    return healthyAuth.login(input);
                },
            },
        );
    }
});

test('authenticated readers can list the catalog and real unit options', async () => {
    await withApi(fakeItems(), async (origin) => {
        const cookie = await signIn(origin);
        const response = await fetch(`${origin}/api/items`, { headers: { Cookie: cookie } });
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).data, JSON.parse(JSON.stringify([item])));
        const units = await fetch(`${origin}/api/items/uoms`, { headers: { Cookie: cookie } });
        assert.deepEqual((await units.json()).data, [
            { uomId: 1, name: 'kg', uomClassId: 1, uomClassName: 'Mass' },
        ]);
    });
});
test('read-only roles cannot create or update items even with a valid token', async () => {
    let writes = 0;
    const viewer = { ...manager, permissions: { canManageInventory: false } };
    await withApi(
        fakeItems({
            createItem: async () => {
                writes++;
                return item;
            },
            updateItem: async () => {
                writes++;
                return item;
            },
        }),
        async (origin) => {
            const cookie = await signIn(origin);
            for (const [path, method, body] of [
                ['/api/items', 'POST', validInput],
                ['/api/items/10', 'PATCH', { isActive: false }],
            ] as const) {
                const response = await fetch(`${origin}${path}`, json(method, body, cookie));
                assert.equal(response.status, 403);
                await response.json();
            }
            assert.equal(writes, 0);
        },
        fakeAuth(viewer),
    );
});
test('POST uses validated decimal strings and authenticated audit identity', async () => {
    let received: { input: CreateItemInput; actor: number } | undefined;
    await withApi(
        fakeItems({
            createItem: async (input, actor) => {
                received = { input, actor };
                return { ...item, ...input, createdBy: actor, updatedBy: actor };
            },
        }),
        async (origin) => {
            const cookie = await signIn(origin);
            const response = await fetch(`${origin}/api/items`, json('POST', validInput, cookie));
            assert.equal(response.status, 201);
            const payload = await response.json();
            assert.equal(payload.data.unitCost, '110.1234');
            assert.equal(payload.data.createdBy, 7);
            assert.equal(received?.actor, 7);
            assert.equal(received?.input.sku, 'RM-GARLIC');
            const spoofed = await fetch(
                `${origin}/api/items`,
                json('POST', { ...validInput, createdBy: 999 }, cookie),
            );
            assert.equal(spoofed.status, 400);
            await spoofed.json();
        },
    );
});
test('PATCH supports clearing optional values and deactivation/reactivation without deleting history', async () => {
    const changes: { id: number; input: UpdateItemInput; actor: number }[] = [];
    await withApi(
        fakeItems({
            updateItem: async (id, input, actor) => {
                changes.push({ id, input, actor });
                return { ...item, ...input };
            },
        }),
        async (origin) => {
            const cookie = await signIn(origin);
            for (const body of [
                { netWeightG: null, shelfLifeDays: null, requiresQc: false },
                { isActive: false },
                { isActive: true },
            ]) {
                const response = await fetch(`${origin}/api/items/10`, json('PATCH', body, cookie));
                assert.equal(response.status, 200);
                await response.json();
            }
            assert.deepEqual(changes[0], {
                id: 10,
                input: { netWeightG: null, shelfLifeDays: null, requiresQc: false },
                actor: 7,
            });
            assert.deepEqual(changes[1].input, { isActive: false });
            assert.deepEqual(changes[2].input, { isActive: true });
            const empty = await fetch(`${origin}/api/items/10`, json('PATCH', {}, cookie));
            assert.equal(empty.status, 400);
            await empty.json();
        },
    );
});
test('item routes validate IDs and return 404 for missing records', async () => {
    await withApi(
        fakeItems({ getItem: async () => null, updateItem: async () => null }),
        async (origin) => {
            const cookie = await signIn(origin);
            for (const id of ['0', '1e2', '2147483648']) {
                const response = await fetch(`${origin}/api/items/${id}`, {
                    headers: { Cookie: cookie },
                });
                assert.equal(response.status, 400);
                await response.json();
            }
            const missing = await fetch(`${origin}/api/items/999`, { headers: { Cookie: cookie } });
            assert.equal(missing.status, 404);
            await missing.json();
            const patch = await fetch(
                `${origin}/api/items/999`,
                json('PATCH', { name: 'Changed' }, cookie),
            );
            assert.equal(patch.status, 404);
            await patch.json();
        },
    );
});
test('item writes reuse shared database error handling without leaking SQL', async () => {
    await withApi(
        fakeItems({
            createItem: async () => {
                throw new Error('private SQL', { cause: { code: '23505', detail: 'private SKU' } });
            },
        }),
        async (origin) => {
            const cookie = await signIn(origin);
            const response = await fetch(`${origin}/api/items`, json('POST', validInput, cookie));
            assert.equal(response.status, 409);
            assert.doesNotMatch(JSON.stringify(await response.json()), /private|SQL/);
        },
    );
});

test('user management cannot be used to bypass catalog permissions', async () => {
    await withApi(fakeItems(), async (origin) => {
        const anonymous = await fetch(`${origin}/api/user`, json('POST', {}));
        assert.equal(anonymous.status, 401);
        await anonymous.json();
        const cookie = await signIn(origin);
        const blocked = await fetch(
            `${origin}/api/user`,
            json(
                'POST',
                {
                    firstName: 'Bypass',
                    lastName: 'Account',
                    email: 'bypass@example.com',
                    password: 'password123',
                    roleId: 1,
                },
                cookie,
            ),
        );
        assert.equal(blocked.status, 403);
        await blocked.json();
    });
});
