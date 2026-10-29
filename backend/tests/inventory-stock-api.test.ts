import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { StockService } from '../src/modules/inventory-stocks/inventory-stock.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import type {
    StockQuery,
    StockAdjustmentInput,
} from '../src/modules/inventory-stocks/inventory-stock.schema.ts';
import { AppError } from '../src/errors/app-error.ts';
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-stock-session-signing-key';
const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');
const manager: SessionUser = {
    userId: 7,
    firstName: 'Inventory',
    lastName: 'Manager',
    email: 'inventory@example.com',
    roleId: 2,
    permissions: { canManageInventory: true },
};
const stock: NonNullable<Awaited<ReturnType<StockService['getStock']>>> = {
    stockId: 1,
    itemId: 10,
    sku: 'RM-GARLIC',
    itemName: 'Garlic powder',
    itemType: 'Raw Material - Bulk',
    primaryUomId: 1,
    primaryUomName: 'kg',
    lotId: 2,
    lotNumber: 'GARLIC-001',
    supplierLotNumber: null,
    manufactureDate: null,
    expirationDate: null,
    qcStatus: 'Approved',
    lotUnitCost: '110.0000',
    locationId: 3,
    locationCode: 'WH-RM',
    locationName: 'Raw materials',
    locationType: 'Warehouse',
    qtyOnHand: '10.0000',
    qtyReserved: '2.5000',
    qtyAvailable: '7.5000',
    lastUpdated: new Date('2026-10-27T00:00:00Z'),
};
const options: Awaited<ReturnType<StockService['listStockOptions']>> = {
    lots: [
        {
            lotId: 2,
            lotNumber: 'GARLIC-001',
            itemId: 10,
            itemName: 'Garlic powder',
            sku: 'RM-GARLIC',
            primaryUomName: 'kg',
        },
    ],
    locations: [
        {
            locationId: 3,
            name: 'Raw materials',
            code: 'WH-RM',
            locationType: 'Warehouse',
            isActive: true,
        },
    ],
    reasons: [{ reasonId: 4, codeName: 'Physical count', description: null }],
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
function service(overrides: Partial<StockService> = {}): StockService {
    return {
        listStocks: async () => [stock],
        getStock: async () => stock,
        listStockOptions: async () => options,
        recordStockAdjustment: async (input) => ({
            stock: { ...stock, qtyOnHand: input.qtyOnHand },
            transactionId: 55,
            qtyChange: '2.0000',
        }),
        ...overrides,
    };
}
async function withApi(
    stockService: StockService,
    run: (origin: string, cookie: string) => Promise<void>,
    session = manager,
) {
    const server = createApp({
        userService: users,
        stockService,
        authService: {
            login: async () => session,
            getSessionUser: async (id) => (id === session.userId ? session : null),
        },
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const cookie = `jwt=${await generateToken({ id: String(session.userId) }, '5m')}`;
    try {
        await run(`http://127.0.0.1:${address.port}`, cookie);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
    }
}
const body = {
    lotId: 2,
    locationId: 3,
    reasonId: 4,
    expectedQtyOnHand: '10',
    qtyOnHand: '12',
    referenceId: null,
};
const json = (input: unknown, cookie?: string): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(input),
});
test('stock reads and adjustment endpoints require an authenticated account', async () => {
    let calls = 0;
    await withApi(
        service({
            listStocks: async () => {
                calls++;
                return [stock];
            },
            recordStockAdjustment: async () => {
                calls++;
                throw new Error('Must not run');
            },
        }),
        async (origin) => {
            for (const [path, request] of [
                ['', {}],
                ['/options', {}],
                ['/adjustments', json(body)],
            ] as [string, RequestInit][]) {
                const response = await fetch(`${origin}/api/inventory/stocks${path}`, request);
                assert.equal(response.status, 401);
                await response.json();
            }
            assert.equal(calls, 0);
        },
    );
});
test('stock list preserves lot/location balances, decimal strings, and parsed filters', async () => {
    let query: StockQuery | undefined;
    await withApi(
        service({
            listStocks: async (input) => {
                query = input;
                return [
                    stock,
                    {
                        ...stock,
                        stockId: 2,
                        locationId: 9,
                        locationType: 'In Transit',
                        qtyOnHand: '0',
                        qtyReserved: '0',
                        qtyAvailable: '0',
                    },
                ];
            },
        }),
        async (origin, cookie) => {
            const response = await fetch(
                `${origin}/api/inventory/stocks?itemId=10&locationId=3&qcStatus=Approved&availability=available`,
                { headers: { Cookie: cookie } },
            );
            assert.equal(response.status, 200);
            const payload = await response.json();
            assert.equal(payload.data[0].qtyReserved, '2.5000');
            assert.equal(payload.data[0].qtyAvailable, '7.5000');
            assert.equal(payload.data[0].lastUpdated, '2026-10-27T00:00:00.000Z');
            assert.equal(payload.data[1].qtyOnHand, '0');
            assert.deepEqual(query, {
                itemId: 10,
                locationId: 3,
                qcStatus: 'Approved',
                availability: 'available',
            });
        },
    );
});
test('inventory managers receive database-backed adjustment options', async () => {
    await withApi(service(), async (origin, cookie) => {
        const response = await fetch(`${origin}/api/inventory/stocks/options`, {
            headers: { Cookie: cookie },
        });
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).data, options);
    });
});
test('read-only roles can inspect stock but cannot obtain adjustment actions or submit writes', async () => {
    let calls = 0;
    await withApi(
        service({
            recordStockAdjustment: async () => {
                calls++;
                throw new Error('Must not run');
            },
        }),
        async (origin, cookie) => {
            const headers = { Cookie: cookie };
            const read = await fetch(`${origin}/api/inventory/stocks/1`, { headers });
            assert.equal(read.status, 200);
            await read.json();
            const options = await fetch(`${origin}/api/inventory/stocks/options`, { headers });
            assert.equal(options.status, 403);
            await options.json();
            const write = await fetch(
                `${origin}/api/inventory/stocks/adjustments`,
                json(body, cookie),
            );
            assert.equal(write.status, 403);
            await write.json();
            assert.equal(calls, 0);
        },
        { ...manager, permissions: {} },
    );
});
test('stock adjustment creation uses normalized counted quantities and server audit identity', async () => {
    let received: StockAdjustmentInput | undefined;
    let actor: number | undefined;
    await withApi(
        service({
            recordStockAdjustment: async (input, userId) => {
                received = input;
                actor = userId;
                return { stock, transactionId: 55, qtyChange: '-0.0001' };
            },
        }),
        async (origin, cookie) => {
            const response = await fetch(
                `${origin}/api/inventory/stocks/adjustments`,
                json({ ...body, qtyOnHand: ' 9.9999 ', referenceId: ' COUNT-1 ' }, cookie),
            );
            assert.equal(response.status, 201);
            const payload = await response.json();
            assert.equal(payload.data.transactionId, 55);
            assert.equal(payload.data.qtyChange, '-0.0001');
            assert.equal(actor, 7);
            assert.deepEqual(received, { ...body, qtyOnHand: '9.9999', referenceId: 'COUNT-1' });
        },
    );
});
test('invalid stock IDs, filters, quantities, reasons, and forged audit fields stop before service calls', async () => {
    let calls = 0;
    await withApi(
        service({
            recordStockAdjustment: async () => {
                calls++;
                throw new Error('Must not run');
            },
        }),
        async (origin, cookie) => {
            for (const suffix of [
                '/0',
                '/1e2',
                '?itemId=0',
                '?lotId=2147483648',
                '?qcStatus=Pending',
                '?unknown=value',
            ]) {
                const response = await fetch(`${origin}/api/inventory/stocks${suffix}`, {
                    headers: { Cookie: cookie },
                });
                assert.equal(response.status, 400);
                await response.json();
            }
            for (const patch of [
                { qtyOnHand: 12 },
                { reasonId: 0 },
                { expectedQtyOnHand: undefined },
                { authorizedByUserId: 999 },
                { qtyChange: '99' },
            ]) {
                const response = await fetch(
                    `${origin}/api/inventory/stocks/adjustments`,
                    json({ ...body, ...patch }, cookie),
                );
                assert.equal(response.status, 400);
                await response.json();
            }
            assert.equal(calls, 0);
        },
    );
});
test('missing balances and stale or reserved-stock conflicts keep safe HTTP errors', async () => {
    await withApi(
        service({
            getStock: async () => null,
            recordStockAdjustment: async () => {
                throw new AppError(409, 'Stock has changed. Refresh and reopen the adjustment.');
            },
        }),
        async (origin, cookie) => {
            const missing = await fetch(`${origin}/api/inventory/stocks/999`, {
                headers: { Cookie: cookie },
            });
            assert.equal(missing.status, 404);
            await missing.json();
            const conflict = await fetch(
                `${origin}/api/inventory/stocks/adjustments`,
                json(body, cookie),
            );
            assert.equal(conflict.status, 409);
            assert.match((await conflict.json()).error.message, /Stock has changed/);
        },
    );
});
test('stock services reuse shared database errors without exposing SQL or internal details', async () => {
    await withApi(
        service({
            recordStockAdjustment: async () => {
                throw new Error('private SQL', {
                    cause: { code: '23503', detail: 'private ledger' },
                });
            },
        }),
        async (origin, cookie) => {
            const response = await fetch(
                `${origin}/api/inventory/stocks/adjustments`,
                json(body, cookie),
            );
            assert.equal(response.status, 400);
            assert.doesNotMatch(JSON.stringify(await response.json()), /private|SQL|ledger/);
            const deletion = await fetch(`${origin}/api/inventory/stocks/1`, {
                method: 'DELETE',
                headers: { Cookie: cookie },
            });
            assert.equal(deletion.status, 404);
            await deletion.json();
        },
    );
});
