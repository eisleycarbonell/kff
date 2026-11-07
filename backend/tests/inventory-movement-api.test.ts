import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { InventoryMovementService } from '../src/modules/inventory-movements/inventory-movement.controller.ts';
import type { InventoryMovementQuery } from '../src/modules/inventory-movements/inventory-movement.schema.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-movement-signing-key';
const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');

const session: SessionUser = {
    userId: 7,
    firstName: 'Inventory',
    lastName: 'Viewer',
    email: 'viewer@example.com',
    roleId: 2,
    permissions: {},
};
const movement: Awaited<ReturnType<InventoryMovementService['listInventoryMovements']>>[number] = {
    transactionId: 41,
    transactionType: 'Adjustment',
    qtyChange: '-0.0001',
    createdAt: new Date('2026-11-03T04:00:00Z'),
    itemId: 3,
    itemSku: 'RM-GARLIC',
    itemName: 'Garlic powder',
    primaryUomName: 'kg',
    lotId: 11,
    lotNumber: 'LOT-11',
    locationId: 4,
    locationCode: 'WH-RM',
    locationName: 'Raw warehouse',
    reasonCode: 'Physical count',
    referenceId: 'COUNT-1',
    poLineId: null,
    poNumber: null,
    packingOrderId: null,
    packingOrderNumber: null,
    transferLineId: null,
    transferNumber: null,
    authorizedByUserId: 7,
    actorFirstName: 'Inventory',
    actorLastName: 'Viewer',
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

async function withApi(
    service: InventoryMovementService,
    run: (origin: string, cookie: string) => Promise<void>,
) {
    const server = createApp({
        userService: users,
        inventoryMovementService: service,
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

test('movement history requires authentication and is available to inventory viewers', async () => {
    let calls = 0;
    await withApi(
        {
            listInventoryMovements: async () => {
                calls++;
                return [movement];
            },
        },
        async (origin, cookie) => {
            const denied = await fetch(`${origin}/api/inventory/movements`);
            assert.equal(denied.status, 401);
            await denied.json();
            assert.equal(calls, 0);
            const allowed = await fetch(`${origin}/api/inventory/movements`, {
                headers: { Cookie: cookie },
            });
            assert.equal(allowed.status, 200);
            const payload = await allowed.json();
            assert.equal(payload.data[0].qtyChange, '-0.0001');
            assert.equal(payload.data[0].createdAt, '2026-11-03T04:00:00.000Z');
            assert.equal(payload.data[0].reasonCode, 'Physical count');
            assert.equal(calls, 1);
        },
    );
});

test('movement filters are validated and passed as typed query values', async () => {
    let received: InventoryMovementQuery | undefined;
    await withApi(
        {
            listInventoryMovements: async (query) => {
                received = query;
                return [movement];
            },
        },
        async (origin, cookie) => {
            const headers = { Cookie: cookie };
            const allowed = await fetch(
                `${origin}/api/inventory/movements?transactionType=Adjustment&itemId=3&lotId=11&locationId=4`,
                { headers },
            );
            assert.equal(allowed.status, 200);
            await allowed.json();
            assert.deepEqual(received, {
                transactionType: 'Adjustment',
                itemId: 3,
                lotId: 11,
                locationId: 4,
            });
            for (const suffix of [
                '?transactionType=Adjust',
                '?itemId=0',
                '?lotId=2147483648',
                '?unknown=1',
            ]) {
                const invalid = await fetch(`${origin}/api/inventory/movements${suffix}`, {
                    headers,
                });
                assert.equal(invalid.status, 400);
                await invalid.json();
            }
            const write = await fetch(`${origin}/api/inventory/movements`, {
                method: 'POST',
                headers,
            });
            assert.equal(write.status, 404);
            await write.json();
        },
    );
});
