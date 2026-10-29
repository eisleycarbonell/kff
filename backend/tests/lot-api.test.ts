import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { LotService } from '../src/modules/lots/lot.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { AppError } from '../src/errors/app-error.ts';
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-lot-signing-key-not-for-deployment';
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
const audit = {
    createdBy: 7,
    updatedBy: 7,
    createdAt: new Date('2026-10-28T00:00:00Z'),
    updatedAt: new Date('2026-10-28T00:00:00Z'),
};
const lot: Awaited<ReturnType<LotService['listLots']>>[number] = {
    lotId: 31,
    lotNumber: 'LOT-1',
    supplierLotNumber: null,
    itemId: 3,
    itemSku: 'RM-GARLIC',
    itemName: 'Garlic',
    itemType: 'Raw Material - Bulk',
    primaryUomId: 1,
    primaryUomName: 'kg',
    manufactureDate: null,
    expirationDate: null,
    qcStatus: 'Quarantine',
    unitCost: '110.0000',
    poLineId: 11,
    poId: 1,
    poNumber: 'PO-1',
    supplierId: 2,
    supplierName: 'Supplier',
    packingOrderId: null,
    packingOrderNumber: null,
    sourceType: 'Purchased',
    qtyOnHand: '19999999999.9998',
    qtyReserved: '20000000000.9998',
    qtyAvailable: '-1.0000',
    locationCount: 2,
    ...audit,
};
const detail: NonNullable<Awaited<ReturnType<LotService['getLot']>>> = {
    ...lot,
    stocks: [
        {
            stockId: 51,
            locationId: 1,
            locationCode: 'WH-RM',
            locationName: 'Raw warehouse',
            locationType: 'Warehouse',
            locationIsActive: true,
            qtyOnHand: '5.0000',
            qtyReserved: '6.0000',
            qtyAvailable: '-1.0000',
            lastUpdated: audit.updatedAt,
        },
    ],
    transactions: [
        {
            transactionId: 41,
            locationId: 1,
            locationCode: 'WH-RM',
            locationName: 'Raw warehouse',
            qtyChange: '5.0000',
            transactionType: 'Receive',
            poLineId: 11,
            packingOrderId: null,
            transferLineId: null,
            referenceId: 'PO-1',
            authorizedByUserId: 7,
            createdAt: audit.createdAt,
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
function fakeLots(overrides: Partial<LotService> = {}): LotService {
    return {
        listLots: async () => [lot],
        getLot: async () => detail,
        updateLot: async (_id, input, actor) => ({ ...detail, ...input, updatedBy: actor }),
        ...overrides,
    };
}
async function withApi(
    run: (origin: string, token: string) => Promise<void>,
    service = fakeLots(),
    viewer = false,
) {
    const user = viewer
        ? { ...manager, permissions: { canManageInventory: false, canManagePurchasing: true } }
        : manager;
    const server = createApp({
        userService: users,
        lotService: service,
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
            `http://127.0.0.1:${address.port}/api/lots`,
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
test('lot reads authenticate and expose traceability, ledger history and exact signed aggregate quantities', async () =>
    withApi(async (origin, token) => {
        for (const [path, data] of [
            ['', [lot]],
            ['/31', detail],
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
test('purchasing-only roles may view lots but cannot change QC or metadata', async () =>
    withApi(
        async (origin, token) => {
            const read = await fetch(origin + '/31', {
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(read.status, 200);
            await read.json();
            const write = await fetch(
                origin + '/31',
                request('PATCH', { qcStatus: 'Approved' }, token),
            );
            assert.equal(write.status, 403);
            await write.json();
        },
        fakeLots({
            updateLot: async () => {
                throw new Error('Must not be called');
            },
        }),
        true,
    ));
test('lot patches normalize supplied metadata, preserve partial fields and derive the actor from the session', async () =>
    withApi(
        async (origin, token) => {
            const response = await fetch(
                origin + '/31',
                request('PATCH', { supplierLotNumber: ' REF-1 ', manufactureDate: null }, token),
            );
            assert.equal(response.status, 200);
            const body = await response.json();
            assert.equal(body.data.supplierLotNumber, 'REF-1');
            assert.equal(body.data.updatedBy, 7);
            assert.equal(body.data.qtyOnHand, lot.qtyOnHand);
        },
        fakeLots({
            updateLot: async (id, input, actor) => {
                assert.equal(id, 31);
                assert.deepEqual(input, { supplierLotNumber: 'REF-1', manufactureDate: null });
                assert.equal(actor, 7);
                return { ...detail, ...input, updatedBy: actor };
            },
        }),
    ));
test('lot writable fields never include identity, costs, provenance, quantities or ledger data', async () => {
    let writes = 0;
    await withApi(
        async (origin, token) => {
            for (const body of [
                {},
                { lotNumber: 'CHANGED' },
                { itemId: 4 },
                { unitCost: '1' },
                { poLineId: 12 },
                { packingOrderId: 12 },
                { qtyOnHand: '1' },
                { transactions: [] },
                { updatedBy: 99 },
                { qcStatus: 'Unknown' },
                { manufactureDate: '2026-10-28', expirationDate: '2026-10-28' },
            ]) {
                const response = await fetch(origin + '/31', request('PATCH', body, token));
                assert.equal(response.status, 400);
                const data = await response.json();
                assert.ok(data.error.details);
            }
            assert.equal(writes, 0);
        },
        fakeLots({
            updateLot: async () => {
                writes++;
                return detail;
            },
        }),
    );
});
test('missing lots and invalid IDs are safe and manual creation/deletion endpoints are absent', async () =>
    withApi(
        async (origin, token) => {
            const invalid = await fetch(origin + '/0', {
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(invalid.status, 400);
            await invalid.json();
            for (const [path, method, body] of [
                ['/99', 'GET', undefined],
                ['/99', 'PATCH', { qcStatus: 'Approved' }],
                ['', 'POST', { lotNumber: 'MANUAL' }],
                ['/31', 'DELETE', undefined],
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
        fakeLots({ getLot: async () => null, updateLot: async () => null }),
    ));
test('reservation conflicts remain readable and database details never enter lot error responses', async () => {
    for (const [error, status] of [
        [
            new AppError(
                409,
                'Release outstanding reservations before changing lot dates or QC status.',
            ),
            409,
        ],
        [new Error('private SQL password', { cause: { code: 'CONNECT_TIMEOUT' } }), 503],
    ] as const)
        await withApi(
            async (origin, token) => {
                const response = await fetch(
                    origin + '/31',
                    request('PATCH', { qcStatus: 'Rejected' }, token),
                );
                assert.equal(response.status, status);
                const body = await response.json();
                assert.doesNotMatch(JSON.stringify(body), /private|SQL|password/);
                if (error instanceof AppError) assert.equal(body.error.message, error.message);
            },
            fakeLots({
                updateLot: async () => {
                    throw error;
                },
            }),
        );
});
