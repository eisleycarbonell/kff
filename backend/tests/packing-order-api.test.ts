import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { PackingOrderService } from '../src/modules/packing-orders/packing-order.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { AppError } from '../src/errors/app-error.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-packing-signing-key-not-for-deployment';
const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');
const manager: SessionUser = {
    userId: 7,
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'manager@example.com',
    roleId: 2,
    permissions: { canManagePacking: true },
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
const order: NonNullable<Awaited<ReturnType<PackingOrderService['getPackingOrder']>>> = {
    packingOrderId: 1,
    packingOrderNumber: 'PK-1',
    itemId: 2,
    itemSku: 'FG-1',
    itemName: 'Packed garlic',
    primaryUomId: 1,
    primaryUomName: 'pc',
    targetQty: '500.0000',
    actualQty: '0.0000',
    status: 'Draft',
    sourceLocationId: 1,
    sourceLocationCode: 'WH-RM',
    sourceLocationName: 'Raw warehouse',
    destinationLocationId: 2,
    destinationLocationCode: 'WH-FG',
    destinationLocationName: 'Finished warehouse',
    scheduledDate: null,
    startedAt: null,
    completedAt: null,
    notes: null,
    createdBy: 7,
    createdAt: new Date('2026-10-29T00:00:00Z'),
    updatedBy: 7,
    updatedAt: new Date('2026-10-29T00:00:00Z'),
    materialCount: 1,
    materials: [],
    reservations: [],
    finishedLots: [],
};
const input = {
    packingOrderNumber: ' pk-1 ',
    itemId: 2,
    targetQty: '500.0000',
    sourceLocationId: 1,
    destinationLocationId: 2,
};
const preview = {
    itemId: 2,
    itemSku: 'FG-1',
    itemName: 'Packed garlic',
    primaryUomId: 1,
    primaryUomName: 'pc',
    targetQty: '500.0000',
    sourceLocationId: 1,
    maxProducible: '500.0000',
    canPlan: true,
    materials: [],
};
function fakePacking(overrides: Partial<PackingOrderService> = {}): PackingOrderService {
    return {
        listPackingOrders: async () => [order],
        getPackingOrder: async () => order,
        getPackingOrderOptions: async () => ({ items: [], locations: [] }),
        previewPackingOrder: async () => preview,
        listPackingReservations: async () => [],
        createPackingOrder: async () => order,
        updatePackingOrder: async () => order,
        planPackingOrder: async () => ({ ...order, status: 'Planned' }),
        startPackingOrder: async () => ({ ...order, status: 'In Progress' }),
        cancelPackingOrder: async () => ({ ...order, status: 'Cancelled' }),
        completePackingOrder: async () => ({
            ...order,
            status: 'Completed',
            actualQty: '450.0000',
        }),
        ...overrides,
    };
}
async function withApi(
    run: (origin: string, token: string) => Promise<void>,
    service = fakePacking(),
    canManage = true,
) {
    const user = {
        ...manager,
        permissions: { canManagePacking: canManage, canManageInventory: !canManage },
    };
    const server = createApp({
        userService: users,
        packingOrderService: service,
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
            `http://127.0.0.1:${address.port}/api/packing-orders`,
            await generateToken({ id: '7' }, '5m'),
        );
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
    }
}
const json = (body: unknown, token: string, method = 'POST'): RequestInit => ({
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});
test('packing list, detail, options and reservation routes authenticate and preserve exact response envelopes', async () =>
    withApi(async (origin, token) => {
        for (const path of ['', '/1', '/options', '/reservations']) {
            const anonymous = await fetch(origin + path);
            assert.equal(anonymous.status, 401);
            await anonymous.json();
            const response = await fetch(origin + path, {
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(response.status, 200);
            assert.equal((await response.json()).success, true);
        }
        const response = await fetch(origin + '/1', {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.deepEqual(await response.json(), {
            success: true,
            data: JSON.parse(JSON.stringify(order)),
        });
    }));
test('only packing managers can mutate orders, including every lifecycle action', async () =>
    withApi(
        async (origin, token) => {
            for (const [path, body, method] of [
                ['', input, 'POST'],
                ['/1', { notes: 'Changed' }, 'PATCH'],
                ['/1/plan', {}, 'POST'],
                ['/1/start', {}, 'POST'],
                ['/1/cancel', {}, 'POST'],
                ['/1/complete', { actualQty: '450', lotNumber: 'FG-1' }, 'POST'],
            ] as const) {
                const response = await fetch(origin + path, json(body, token, method));
                assert.equal(response.status, 403);
                await response.json();
            }
            const advisory = await fetch(
                origin + '/preview',
                json({ itemId: 2, sourceLocationId: 1, targetQty: '500' }, token),
            );
            assert.equal(advisory.status, 200);
            await advisory.json();
        },
        fakePacking({
            createPackingOrder: async () => {
                throw new Error('Must not write');
            },
        }),
        false,
    ));
test('creation and completion use normalized inputs and authenticated server actor', async () => {
    let created = false;
    let completed = false;
    await withApi(
        async (origin, token) => {
            const response = await fetch(origin, json(input, token));
            assert.equal(response.status, 201);
            await response.json();
            const done = await fetch(
                origin + '/1/complete',
                json(
                    {
                        actualQty: '450.0000',
                        lotNumber: ' fg-1 ',
                        manufactureDate: '',
                        expirationDate: null,
                    },
                    token,
                ),
            );
            assert.equal(done.status, 200);
            await done.json();
            assert.equal(created, true);
            assert.equal(completed, true);
        },
        fakePacking({
            createPackingOrder: async (body, actor) => {
                assert.deepEqual(body, { ...input, packingOrderNumber: 'PK-1' });
                assert.equal(actor, 7);
                created = true;
                return order;
            },
            completePackingOrder: async (id, body, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                assert.deepEqual(body, {
                    actualQty: '450.0000',
                    lotNumber: 'FG-1',
                    manufactureDate: null,
                    expirationDate: null,
                });
                completed = true;
                return { ...order, status: 'Completed' };
            },
        }),
    );
});
test('strict requests reject spoofed identity, derived state, lossy quantities, immutable snapshot edits and malformed IDs', async () =>
    withApi(async (origin, token) => {
        for (const body of [
            { ...input, createdBy: 99 },
            { ...input, status: 'Completed' },
            { ...input, targetQty: 500 },
            { ...input, targetQty: '1e3' },
            { ...input, targetQty: '0' },
            { ...input, materials: [] },
            { ...input, packingOrderNumber: 'x'.repeat(31) },
        ]) {
            const response = await fetch(origin, json(body, token));
            assert.equal(response.status, 400);
            assert.ok((await response.json()).error.details);
        }
        for (const [path, body, method] of [
            ['/1', { targetQty: '600' }, 'PATCH'],
            ['/1', {}, 'PATCH'],
            ['/1/plan', { reservations: [] }, 'POST'],
            [
                '/1/complete',
                {
                    actualQty: '5',
                    lotNumber: 'FG',
                    manufactureDate: '2026-10-29',
                    expirationDate: '2026-10-29',
                },
                'POST',
            ],
            ['/0/plan', {}, 'POST'],
            ['/2147483648/start', {}, 'POST'],
        ] as const) {
            const response = await fetch(origin + path, json(body, token, method));
            assert.equal(response.status, 400);
            await response.json();
        }
    }));
test('lifecycle routes delegate order ID and server actor; missing orders and conflicts remain safe', async () => {
    for (const action of ['plan', 'start', 'cancel'] as const) {
        let called = false;
        const key =
            action === 'plan'
                ? 'planPackingOrder'
                : action === 'start'
                  ? 'startPackingOrder'
                  : 'cancelPackingOrder';
        await withApi(
            async (origin, token) => {
                const response = await fetch(origin + '/1/' + action, json({}, token));
                assert.equal(response.status, 200);
                await response.json();
                assert.equal(called, true);
            },
            fakePacking({
                [key]: async (id: number, actor: number) => {
                    assert.equal(id, 1);
                    assert.equal(actor, 7);
                    called = true;
                    return order;
                },
            }),
        );
    }
    for (const [error, status] of [
        [new AppError(409, 'There is not enough available stock.'), 409],
        [new Error('private SQL password', { cause: { code: '23505' } }), 409],
        [new Error('private SQL password', { cause: { code: 'CONNECT_TIMEOUT' } }), 503],
    ] as const)
        await withApi(
            async (origin, token) => {
                const response = await fetch(origin + '/1/plan', json({}, token));
                assert.equal(response.status, status);
                const body = await response.json();
                assert.equal(body.success, false);
                assert.doesNotMatch(JSON.stringify(body), /private|SQL|password/);
            },
            fakePacking({
                planPackingOrder: async () => {
                    throw error;
                },
            }),
        );
    await withApi(
        async (origin, token) => {
            const response = await fetch(origin + '/1', {
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(response.status, 404);
            await response.json();
        },
        fakePacking({ getPackingOrder: async () => null }),
    );
});
