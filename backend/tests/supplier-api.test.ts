import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { SupplierService } from '../src/modules/suppliers/supplier.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { AppError } from '../src/errors/app-error.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-supplier-signing-key-not-for-deployment';
const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');
const manager: SessionUser = {
    userId: 7,
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'manager@example.com',
    roleId: 2,
    permissions: { canManagePurchasing: true },
};
const audit = {
    createdBy: 7,
    updatedBy: 7,
    createdAt: new Date('2026-10-28T00:00:00Z'),
    updatedAt: new Date('2026-10-28T00:00:00Z'),
};
const supplier = {
    supplierId: 1,
    name: 'Spice supplier',
    email: null,
    isActive: true,
    itemCount: 1,
    activeItemCount: 1,
    preferredItemCount: 0,
    hasOpenPurchaseOrders: false,
    ...audit,
};
const offer = {
    supplierItemId: 2,
    supplierId: 1,
    itemId: 3,
    supplierItemCode: null,
    defaultUomId: null,
    defaultPrice: '108.5000',
    leadTimeDays: null,
    isPreferred: false,
    isActive: true,
    itemSku: 'RM-GARLIC',
    itemName: 'Garlic powder',
    itemType: 'Raw Material - Bulk' as const,
    itemIsActive: true,
    primaryUomId: 1,
    primaryUomName: 'kg',
    defaultUomName: null,
    uomClassId: 1,
    ...audit,
};
const options = {
    items: [
        {
            itemId: 3,
            sku: 'RM-GARLIC',
            name: 'Garlic powder',
            itemType: 'Raw Material - Bulk' as const,
            isActive: true,
            primaryUomId: 1,
            primaryUomName: 'kg',
            uomClassId: 1,
        },
    ],
    uoms: [{ uomId: 1, name: 'kg', uomClassId: 1 }],
};
const users: UserService = {
    listUsers: async () => [],
    getUserByID: async () => null,
    createUser: async () => {
        throw new Error('Unused');
    },
    updateUser: async () => null,
    deleteUser: async () => null,
};
function fakeSuppliers(overrides: Partial<SupplierService> = {}): SupplierService {
    return {
        listSuppliers: async () => [supplier],
        getSupplier: async () => supplier,
        getSupplierOptions: async () => options,
        listSupplierItems: async () => [offer],
        createSupplier: async (input, actor) => ({
            ...supplier,
            ...input,
            email: input.email ?? null,
            createdBy: actor,
            updatedBy: actor,
        }),
        updateSupplier: async (_id, input, actor) => ({ ...supplier, ...input, updatedBy: actor }),
        createSupplierItem: async (_id, input, actor) => ({
            ...offer,
            ...input,
            supplierItemCode: input.supplierItemCode ?? null,
            defaultUomId: input.defaultUomId ?? null,
            defaultPrice: input.defaultPrice ?? null,
            leadTimeDays: input.leadTimeDays ?? null,
            createdBy: actor,
            updatedBy: actor,
        }),
        updateSupplierItem: async (_id, _offerId, input, actor) => ({
            ...offer,
            ...input,
            updatedBy: actor,
        }),
        ...overrides,
    };
}
async function withApi(
    run: (origin: string, token: string) => Promise<void>,
    service: SupplierService = fakeSuppliers(),
    viewer = false,
) {
    const user = viewer
        ? { ...manager, permissions: { canManagePurchasing: false, canManageInventory: true } }
        : manager;
    const server = createApp({
        userService: users,
        supplierService: service,
        authService: {
            login: async () => user,
            getSessionUser: async (id) => (id === 7 ? user : null),
        },
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    try {
        await run(
            `http://127.0.0.1:${address.port}/api/suppliers`,
            await generateToken({ id: '7' }, '5m'),
        );
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
    }
}
const request = (method: string, body: unknown, token: string): RequestInit => ({
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

test('supplier reads require authentication and return real DTO shapes including nullable quotes and options', async () =>
    withApi(async (origin, token) => {
        for (const [path, data] of [
            ['', [supplier]],
            ['/1', supplier],
            ['/1/items', [offer]],
            ['/options', options],
        ] as const) {
            const anonymous = await fetch(origin + path);
            assert.equal(anonymous.status, 401);
            await anonymous.json();
            const response = await fetch(origin + path, {
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), {
                success: true,
                data: JSON.parse(JSON.stringify(data)),
            });
        }
    }));

test('inventory-only accounts can read suppliers but cannot manage suppliers or offers', async () =>
    withApi(
        async (origin, token) => {
            const read = await fetch(origin, { headers: { Authorization: `Bearer ${token}` } });
            assert.equal(read.status, 200);
            await read.json();
            for (const [path, method, body] of [
                ['', 'POST', { name: 'Supplier' }],
                ['/1', 'PATCH', { isActive: false }],
                ['/1/items', 'POST', { itemId: 3 }],
                ['/1/items/2', 'PATCH', { isActive: false }],
            ] as const) {
                const response = await fetch(origin + path, request(method, body, token));
                assert.equal(response.status, 403);
                await response.json();
            }
        },
        fakeSuppliers(),
        true,
    ));

test('supplier writes normalize data, preserve partial updates, and derive audit identity from the session', async () => {
    let calls = 0;
    await withApi(
        async (origin, token) => {
            const created = await fetch(
                origin,
                request('POST', { name: ' New supplier ', email: ' SALES@EXAMPLE.COM ' }, token),
            );
            assert.equal(created.status, 201);
            assert.equal((await created.json()).data.createdBy, 7);
            const updated = await fetch(
                origin + '/1',
                request('PATCH', { email: null, isActive: false }, token),
            );
            assert.equal(updated.status, 200);
            assert.equal((await updated.json()).data.isActive, false);
            assert.equal(calls, 2);
        },
        fakeSuppliers({
            createSupplier: async (input, actor) => {
                calls++;
                assert.deepEqual(input, {
                    name: 'New supplier',
                    email: 'sales@example.com',
                    isActive: true,
                });
                assert.equal(actor, 7);
                return supplier;
            },
            updateSupplier: async (id, input, actor) => {
                calls++;
                assert.equal(id, 1);
                assert.deepEqual(input, { email: null, isActive: false });
                assert.equal(actor, 7);
                return { ...supplier, ...input };
            },
        }),
    );
});

test('supplier item writes preserve exact decimal amounts and immutable parent/item routing', async () => {
    await withApi(
        async (origin, token) => {
            const created = await fetch(
                origin + '/1/items',
                request(
                    'POST',
                    { itemId: 3, defaultPrice: '9999999999.9999', leadTimeDays: 0 },
                    token,
                ),
            );
            assert.equal(created.status, 201);
            assert.equal((await created.json()).data.defaultPrice, '9999999999.9999');
            const updated = await fetch(
                origin + '/1/items/2',
                request(
                    'PATCH',
                    { defaultPrice: null, defaultUomId: null, isPreferred: false },
                    token,
                ),
            );
            assert.equal(updated.status, 200);
            assert.equal((await updated.json()).data.defaultPrice, null);
        },
        fakeSuppliers({
            createSupplierItem: async (id, input, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                assert.deepEqual(input, {
                    itemId: 3,
                    defaultPrice: '9999999999.9999',
                    leadTimeDays: 0,
                    isPreferred: false,
                    isActive: true,
                });
                return { ...offer, ...input };
            },
            updateSupplierItem: async (id, offerId, input, actor) => {
                assert.equal(id, 1);
                assert.equal(offerId, 2);
                assert.equal(actor, 7);
                assert.deepEqual(input, {
                    defaultPrice: null,
                    defaultUomId: null,
                    isPreferred: false,
                });
                return { ...offer, ...input };
            },
        }),
    );
});

test('invalid IDs, empty changes, audit spoofing, unsupported fields, and numeric prices stop before service calls', async () => {
    let writes = 0;
    await withApi(
        async (origin, token) => {
            for (const [path, method, body] of [
                ['', 'POST', { name: 'Supplier', createdBy: 999 }],
                ['/1', 'PATCH', {}],
                ['/1', 'PATCH', { supplierId: 2 }],
                ['/1/items', 'POST', { itemId: 3, defaultPrice: 1.2 }],
                ['/1/items', 'POST', { itemId: 3, updatedBy: 999 }],
                ['/1/items/2', 'PATCH', { itemId: 4 }],
                ['/1/items/0', 'PATCH', { isActive: false }],
                ['/0', 'PATCH', { name: 'Supplier' }],
            ] as const) {
                const response = await fetch(origin + path, request(method, body, token));
                assert.equal(response.status, 400);
                const json = await response.json();
                assert.equal(json.success, false);
                assert.ok(json.error.details);
            }
            assert.equal(writes, 0);
        },
        fakeSuppliers({
            createSupplier: async () => {
                writes++;
                return supplier;
            },
            updateSupplier: async () => {
                writes++;
                return supplier;
            },
            createSupplierItem: async () => {
                writes++;
                return offer;
            },
            updateSupplierItem: async () => {
                writes++;
                return offer;
            },
        }),
    );
});

test('missing suppliers and nested offers return 404; history has no delete endpoint', async () =>
    withApi(
        async (origin, token) => {
            for (const [path, method, body] of [
                ['/99', 'GET', undefined],
                ['/99/items', 'GET', undefined],
                ['/99', 'PATCH', { isActive: false }],
                ['/99/items', 'POST', { itemId: 3 }],
                ['/1/items/99', 'PATCH', { isActive: false }],
                ['/1', 'DELETE', undefined],
            ] as const) {
                const response = await fetch(
                    origin + path,
                    body === undefined
                        ? { method, headers: { Authorization: `Bearer ${token}` } }
                        : request(method, body, token),
                );
                assert.equal(response.status, 404);
                await response.json();
            }
        },
        fakeSuppliers({
            getSupplier: async () => null,
            listSupplierItems: async () => null,
            updateSupplier: async () => null,
            createSupplierItem: async () => null,
            updateSupplierItem: async () => null,
        }),
    ));

test('preferred-supplier and open-order conflicts preserve business messages while driver failures stay private', async () => {
    for (const error of [
        new AppError(
            409,
            'Another supplier is already preferred for this item. Clear its preference first.',
        ),
        new AppError(
            409,
            'Complete or cancel open purchase orders before deactivating this supplier.',
        ),
        new Error('private SQL and password', { cause: { code: '23505', detail: 'private data' } }),
        new Error('private connection and password', { cause: { code: 'CONNECT_TIMEOUT' } }),
    ]) {
        await withApi(
            async (origin, token) => {
                const response = await fetch(
                    origin + '/1',
                    request('PATCH', { isActive: false }, token),
                );
                assert.equal(
                    response.status,
                    error instanceof AppError
                        ? 409
                        : error.cause &&
                            (error.cause as { code: string }).code === 'CONNECT_TIMEOUT'
                          ? 503
                          : 409,
                );
                const data = await response.json();
                assert.equal(data.success, false);
                assert.doesNotMatch(JSON.stringify(data), /private|password|SQL/);
                if (error instanceof AppError) assert.equal(data.error.message, error.message);
            },
            fakeSuppliers({
                updateSupplier: async () => {
                    throw error;
                },
            }),
        );
    }
});
