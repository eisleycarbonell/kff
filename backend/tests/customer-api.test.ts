import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';

import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import type { CustomerService } from '../src/modules/customers/customer.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-customer-session-signing-key';
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
const customer: Awaited<ReturnType<CustomerService['createCustomer']>> = {
    customerId: 1,
    name: 'Spice store',
    contactName: 'Maria Santos',
    email: 'store@example.com',
    phone: null,
    address: null,
    notes: null,
    isActive: true,
    createdBy: 7,
    updatedBy: 7,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
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

function fakeCustomers(overrides: Partial<CustomerService> = {}): CustomerService {
    return {
        listCustomers: async () => [customer],
        getCustomer: async () => customer,
        createCustomer: async (input, actor) => ({
            ...customer,
            ...input,
            contactName: input.contactName ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            address: input.address ?? null,
            notes: input.notes ?? null,
            createdBy: actor,
            updatedBy: actor,
        }),
        updateCustomer: async (_id, input, actor) => ({ ...customer, ...input, updatedBy: actor }),
        ...overrides,
    };
}

async function withApi(
    run: (origin: string, token: string) => Promise<void>,
    service: CustomerService = fakeCustomers(),
    viewer = false,
) {
    const user = viewer
        ? { ...manager, permissions: { canManageInventory: false, canManagePurchasing: true } }
        : manager;
    const server = createApp({
        userService: users,
        customerService: service,
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
            `http://127.0.0.1:${address.port}/api/customers`,
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
    body: body === undefined ? undefined : JSON.stringify(body),
});

test('customer routes require authentication and list both active and inactive customers', async () => {
    const rows = [customer, { ...customer, customerId: 2, isActive: false }];
    await withApi(
        async (origin, token) => {
            for (const [path, data] of [
                ['', rows],
                ['/1', customer],
            ] as const) {
                const anonymous = await fetch(origin + path);
                assert.equal(anonymous.status, 401);
                await anonymous.json();
                const response = await fetch(origin + path, request('GET', undefined, token));
                assert.equal(response.status, 200);
                assert.deepEqual(await response.json(), {
                    success: true,
                    data: JSON.parse(JSON.stringify(data)),
                });
            }
            for (const [path, method] of [
                ['', 'POST'],
                ['/1', 'PATCH'],
            ] as const) {
                const response = await fetch(origin + path, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Store' }),
                });
                assert.equal(response.status, 401);
                await response.json();
            }
        },
        fakeCustomers({ listCustomers: async () => rows }),
    );
});

test('authenticated viewers may read customers but writes require inventory permission', async () => {
    let writes = 0;
    await withApi(
        async (origin, token) => {
            for (const path of ['', '/1']) {
                const read = await fetch(origin + path, request('GET', undefined, token));
                assert.equal(read.status, 200);
                await read.json();
            }
            for (const [path, method] of [
                ['', 'POST'],
                ['/1', 'PATCH'],
            ] as const) {
                const response = await fetch(
                    origin + path,
                    request(method, { name: 'Store' }, token),
                );
                assert.equal(response.status, 403);
                await response.json();
            }
            assert.equal(writes, 0);
        },
        fakeCustomers({
            createCustomer: async () => {
                writes++;
                return customer;
            },
            updateCustomer: async () => {
                writes++;
                return customer;
            },
        }),
        true,
    );
});

test('customer writes normalize input, preserve PATCH omissions and false, and derive audit identity', async () => {
    let calls = 0;
    await withApi(
        async (origin, token) => {
            const created = await fetch(
                origin,
                request(
                    'POST',
                    {
                        name: ' New store ',
                        contactName: ' Maria Santos ',
                        email: ' SALES@EXAMPLE.COM ',
                        phone: ' ',
                    },
                    token,
                ),
            );
            assert.equal(created.status, 201);
            assert.equal((await created.json()).data.createdBy, 7);
            const updated = await fetch(
                origin + '/1',
                request('PATCH', { email: null, notes: ' ', isActive: false }, token),
            );
            assert.equal(updated.status, 200);
            const data = (await updated.json()).data;
            assert.equal(data.isActive, false);
            assert.equal(data.email, null);
            assert.equal(data.name, customer.name);
            assert.equal(data.updatedBy, 7);
            const reactivated = await fetch(
                origin + '/1',
                request('PATCH', { isActive: true }, token),
            );
            assert.equal(reactivated.status, 200);
            assert.equal((await reactivated.json()).data.isActive, true);
            assert.equal(calls, 3);
        },
        fakeCustomers({
            createCustomer: async (input, actor) => {
                calls++;
                assert.deepEqual(input, {
                    name: 'New store',
                    contactName: 'Maria Santos',
                    email: 'sales@example.com',
                    phone: null,
                    isActive: true,
                });
                assert.equal(actor, 7);
                return customer;
            },
            updateCustomer: async (id, input, actor) => {
                calls++;
                assert.equal(id, 1);
                assert.equal(actor, 7);
                assert.deepEqual(
                    input,
                    calls === 2
                        ? { email: null, notes: null, isActive: false }
                        : { isActive: true },
                );
                return { ...customer, ...input, updatedBy: actor };
            },
        }),
    );
});

test('invalid IDs and writable bodies return readable validation errors before service calls', async () => {
    let calls = 0;
    await withApi(
        async (origin, token) => {
            for (const [path, method, body] of [
                ['/0', 'GET', undefined],
                ['/2147483648', 'GET', undefined],
                ['', 'POST', { name: ' ' }],
                ['', 'POST', { name: 'Store', createdBy: 999 }],
                ['', 'POST', { name: 'Store', email: 'invalid' }],
                ['/1', 'PATCH', {}],
                ['/1', 'PATCH', { customerId: 2 }],
                ['/1', 'PATCH', { updatedAt: '2026-11-01' }],
                ['/1', 'PATCH', { extra: 'private-value' }],
                ['/0', 'PATCH', { isActive: false }],
            ] as const) {
                const response = await fetch(origin + path, request(method, body, token));
                assert.equal(response.status, 400);
                const json = await response.json();
                assert.equal(json.success, false);
                assert.equal(typeof json.error.message, 'string');
                assert.ok(
                    json.error.details.every(
                        (detail: Record<string, unknown>) =>
                            typeof detail.path === 'string' &&
                            typeof detail.message === 'string' &&
                            typeof detail.code === 'string',
                    ),
                );
                assert.doesNotMatch(JSON.stringify(json), /private-value/);
            }
            assert.equal(calls, 0);
        },
        fakeCustomers({
            getCustomer: async () => {
                calls++;
                return customer;
            },
            createCustomer: async () => {
                calls++;
                return customer;
            },
            updateCustomer: async () => {
                calls++;
                return customer;
            },
        }),
    );
});

test('missing customers and hard deletion return 404', async () =>
    withApi(
        async (origin, token) => {
            for (const [method, body] of [
                ['GET', undefined],
                ['PATCH', { isActive: false }],
                ['DELETE', undefined],
            ] as const) {
                const response = await fetch(origin + '/99', request(method, body, token));
                assert.equal(response.status, 404);
                assert.equal((await response.json()).success, false);
            }
        },
        fakeCustomers({ getCustomer: async () => null, updateCustomer: async () => null }),
    ));

test('nested database failures map to safe statuses without leaking SQL or contact details', async () => {
    for (const [code, status] of [
        ['22001', 400],
        ['CONNECT_TIMEOUT', 503],
        ['unknown', 500],
    ] as const) {
        await withApi(
            async (origin, token) => {
                const response = await fetch(origin, request('POST', { name: 'Store' }, token));
                assert.equal(response.status, status);
                const json = await response.json();
                assert.equal(json.success, false);
                assert.doesNotMatch(JSON.stringify(json), /private|SQL|store@example.com/);
            },
            fakeCustomers({
                createCustomer: async () => {
                    throw new Error('private SQL store@example.com', {
                        cause: { code, detail: 'private customer details' },
                    });
                },
            }),
        );
    }
});
