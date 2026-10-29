import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { ReceivingService } from '../src/modules/receiving/receiving.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { AppError } from '../src/errors/app-error.ts';
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-receiving-signing-key-not-for-deployment';
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
const receipt: Awaited<ReturnType<ReceivingService['listReceipts']>>[number] = {
    transactionId: 41,
    lotId: 31,
    lotNumber: 'LOT-1',
    supplierLotNumber: null,
    poId: 1,
    poNumber: 'PO-1',
    poLineId: 11,
    supplierId: 2,
    supplierName: 'Supplier',
    itemId: 3,
    itemSku: 'RM-GARLIC',
    itemName: 'Garlic',
    itemType: 'Raw Material - Bulk',
    locationId: 1,
    locationCode: 'WH-RM',
    locationName: 'Raw warehouse',
    purchaseUomId: 1,
    purchaseUomName: 'kg',
    primaryUomId: 1,
    primaryUomName: 'kg',
    qtyReceived: '5.0000',
    qtyPrimary: '5.0000',
    unitPrice: '110.0000',
    unitCost: '110.0000',
    qcStatus: 'Quarantine',
    manufactureDate: null,
    expirationDate: null,
    authorizedByUserId: 7,
    createdAt: new Date('2026-10-28T00:00:00Z'),
};
const options: Awaited<ReturnType<ReceivingService['getReceivingOptions']>> = {
    orders: [
        {
            poId: 1,
            poNumber: 'PO-1',
            supplierId: 2,
            supplierName: 'Supplier',
            status: 'Sent',
            lines: [
                {
                    poLineId: 11,
                    itemId: 3,
                    itemSku: 'RM-GARLIC',
                    itemName: 'Garlic',
                    itemType: 'Raw Material - Bulk',
                    itemIsActive: true,
                    requiresQc: true,
                    uomId: 1,
                    uomName: 'kg',
                    purchaseUomFactor: '1.00000000',
                    primaryUomId: 1,
                    primaryUomName: 'kg',
                    primaryUomFactor: '1.00000000',
                    qtyOrdered: '10.0000',
                    qtyReceived: '0.0000',
                    qtyRemaining: '10.0000',
                    unitPrice: '110.0000',
                },
            ],
        },
    ],
    locations: [
        {
            locationId: 1,
            code: 'WH-RM',
            name: 'Raw warehouse',
            locationType: 'Warehouse',
            isActive: true,
        },
    ],
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
function fakeReceiving(overrides: Partial<ReceivingService> = {}): ReceivingService {
    return {
        listReceipts: async () => [receipt],
        getReceivingOptions: async () => options,
        receivePurchaseOrder: async () => ({
            receipts: [receipt],
            poId: 1,
            poStatus: 'Partially Received',
        }),
        ...overrides,
    };
}
async function withApi(
    run: (origin: string, token: string) => Promise<void>,
    service = fakeReceiving(),
    viewer = false,
) {
    const user = viewer
        ? { ...manager, permissions: { canManageInventory: false, canManagePurchasing: true } }
        : manager;
    const server = createApp({
        userService: users,
        receivingService: service,
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
            `http://127.0.0.1:${address.port}/api/receiving`,
            await generateToken({ id: '7' }, '5m'),
        );
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
    }
}
const entry = {
    poLineId: 11,
    qtyReceived: '5.0000',
    expectedQtyReceived: '0',
    lotNumber: ' lot-1 ',
    locationId: 1,
};
const input = { poId: 1, lines: [entry] };
const json = (body: unknown, token: string): RequestInit => ({
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});
test('receiving history and options require authentication and preserve exact quantities and traceability', async () =>
    withApi(async (origin, token) => {
        for (const [path, data] of [
            ['', [receipt]],
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
test('purchasing-only readers cannot receive stock and anonymous writes stop before the service', async () =>
    withApi(
        async (origin, token) => {
            const anonymous = await fetch(origin, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            });
            assert.equal(anonymous.status, 401);
            await anonymous.json();
            const read = await fetch(origin, { headers: { Authorization: `Bearer ${token}` } });
            assert.equal(read.status, 200);
            await read.json();
            const blocked = await fetch(origin, json(input, token));
            assert.equal(blocked.status, 403);
            await blocked.json();
        },
        fakeReceiving({
            receivePurchaseOrder: async () => {
                throw new Error('Must not be called');
            },
        }),
        true,
    ));
test('receiving passes normalized purchase-unit entries and server actor and returns committed PO status with receipts', async () =>
    withApi(
        async (origin, token) => {
            const response = await fetch(origin, json(input, token));
            assert.equal(response.status, 201);
            assert.deepEqual(await response.json(), {
                success: true,
                data: {
                    receipts: JSON.parse(JSON.stringify([receipt])),
                    poId: 1,
                    poStatus: 'Partially Received',
                },
            });
        },
        fakeReceiving({
            receivePurchaseOrder: async (parsed, actor) => {
                assert.deepEqual(parsed, { poId: 1, lines: [{ ...entry, lotNumber: 'LOT-1' }] });
                assert.equal(actor, 7);
                return { receipts: [receipt], poId: 1, poStatus: 'Partially Received' };
            },
        }),
    ));
test('receiving rejects spoofed actors, derived quantities, prices, status, duplicate lots and invalid dates before writes', async () => {
    let writes = 0;
    await withApi(
        async (origin, token) => {
            for (const body of [
                { ...input, authorizedByUserId: 99 },
                { ...input, status: 'Completed' },
                { poId: 1, lines: [] },
                { poId: 1, lines: [{ ...entry, itemId: 3 }] },
                { poId: 1, lines: [{ ...entry, unitPrice: '1' }] },
                { poId: 1, lines: [{ ...entry, qtyPrimary: '1' }] },
                { poId: 1, lines: [{ ...entry, qtyReceived: 5 }] },
                {
                    poId: 1,
                    lines: [
                        { ...entry, manufactureDate: '2026-10-28', expirationDate: '2026-10-28' },
                    ],
                },
                { poId: 1, lines: [entry, entry] },
            ]) {
                const response = await fetch(origin, json(body, token));
                assert.equal(response.status, 400);
                const data = await response.json();
                assert.equal(data.success, false);
                assert.ok(data.error.details);
            }
            assert.equal(writes, 0);
        },
        fakeReceiving({
            receivePurchaseOrder: async () => {
                writes++;
                return { receipts: [receipt], poId: 1, poStatus: 'Completed' };
            },
        }),
    );
});
test('receiving preserves conflict/not-found messages and sanitizes wrapped database failures', async () => {
    for (const [error, status] of [
        [
            new AppError(
                409,
                'Received quantities changed. Refresh the purchase order before receiving again.',
            ),
            409,
        ],
        [new AppError(404, 'Purchase order not found.'), 404],
        [new Error('private SQL password', { cause: { code: '23505' } }), 409],
        [new Error('private SQL password', { cause: { code: 'CONNECT_TIMEOUT' } }), 503],
    ] as const)
        await withApi(
            async (origin, token) => {
                const response = await fetch(origin, json(input, token));
                assert.equal(response.status, status);
                const body = await response.json();
                assert.equal(body.success, false);
                assert.doesNotMatch(JSON.stringify(body), /private|SQL|password/);
                if (error instanceof AppError) assert.equal(body.error.message, error.message);
            },
            fakeReceiving({
                receivePurchaseOrder: async () => {
                    throw error;
                },
            }),
        );
});
