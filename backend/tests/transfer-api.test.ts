import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { TransferService } from '../src/modules/transfers/transfer.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { AppError } from '../src/errors/app-error.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-transfer-signing-key-not-for-deployment';
const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');
const manager: SessionUser = {
    userId: 7,
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'manager@example.com',
    roleId: 2,
    permissions: { canManageTransfers: true },
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
const transfer: NonNullable<Awaited<ReturnType<TransferService['getTransfer']>>> = {
    transferId: 1,
    transferNumber: 'TR-1',
    sourceLocationId: 1,
    sourceLocationCode: 'WH-FG',
    sourceLocationName: 'Finished warehouse',
    destinationLocationId: 2,
    destinationLocationCode: 'BR-MNL',
    destinationLocationName: 'Manila branch',
    status: 'Draft',
    requestedAt: new Date('2026-10-30T00:00:00Z'),
    dispatchedAt: null,
    receivedAt: null,
    notes: null,
    createdBy: 7,
    createdAt: new Date('2026-10-30T00:00:00Z'),
    updatedBy: 7,
    updatedAt: new Date('2026-10-30T00:00:00Z'),
    lineCount: 1,
    transitLocationId: null,
    lines: [
        {
            transferLineId: 4,
            itemId: 3,
            itemSku: 'FG-GARLIC',
            itemName: 'Packed garlic',
            lotId: 5,
            lotNumber: 'FG-LOT-1',
            packingOrderId: 6,
            primaryUomId: 1,
            primaryUomName: 'pc',
            qtyRequested: '200.0000',
            qtyShipped: '0.0000',
            qtyReceived: '0.0000',
            qtyOutstanding: '0.0000',
            expirationDate: null,
            qcStatus: 'Approved',
        },
    ],
};
const input = {
    transferNumber: ' tr-1 ',
    sourceLocationId: 1,
    destinationLocationId: 2,
    lines: [{ itemId: 3, lotId: 5, qtyRequested: '200.0000' }],
};
const dispatch = { transitLocationId: 3, lines: [{ transferLineId: 4, qtyShipped: '200' }] };
const receipt = { lines: [{ transferLineId: 4, qtyReceived: '100' }] };
function fakeTransfers(overrides: Partial<TransferService> = {}): TransferService {
    return {
        listTransfers: async () => [transfer],
        getTransfer: async () => transfer,
        getTransferOptions: async () => ({ locations: [], stock: [] }),
        createTransfer: async () => transfer,
        updateTransfer: async () => transfer,
        dispatchTransfer: async () => ({ ...transfer, status: 'In Transit', transitLocationId: 3 }),
        receiveTransfer: async () => ({ ...transfer, status: 'In Transit', transitLocationId: 3 }),
        cancelTransfer: async () => ({ ...transfer, status: 'Cancelled' }),
        ...overrides,
    };
}
async function withApi(
    run: (origin: string, token: string) => Promise<void>,
    service = fakeTransfers(),
    canManage = true,
) {
    const user = {
        ...manager,
        permissions: {
            canManageTransfers: canManage,
            canManageInventory: !canManage,
            canManagePacking: !canManage,
        },
    };
    const server = createApp({
        userService: users,
        transferService: service,
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
            `http://127.0.0.1:${address.port}/api/transfers`,
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

test('transfer reads require a session, preserve exact envelopes, and are available to non-managers', async () =>
    withApi(
        async (origin, token) => {
            for (const path of ['', '/1', '/options']) {
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
                data: JSON.parse(JSON.stringify(transfer)),
            });
        },
        fakeTransfers(),
        false,
    ));

test('transfer permission is enforced for every write despite other management permissions', async () =>
    withApi(
        async (origin, token) => {
            for (const [path, body, method] of [
                ['', input, 'POST'],
                ['/1', { notes: null }, 'PATCH'],
                ['/1/dispatch', dispatch, 'POST'],
                ['/1/receive', receipt, 'POST'],
                ['/1/cancel', {}, 'POST'],
            ] as const) {
                const response = await fetch(origin + path, json(body, token, method));
                assert.equal(response.status, 403);
                await response.json();
            }
        },
        fakeTransfers({
            createTransfer: async () => {
                throw new Error('Must not write');
            },
            updateTransfer: async () => {
                throw new Error('Must not write');
            },
            dispatchTransfer: async () => {
                throw new Error('Must not write');
            },
            receiveTransfer: async () => {
                throw new Error('Must not write');
            },
            cancelTransfer: async () => {
                throw new Error('Must not write');
            },
        }),
        false,
    ));

test('transfer writes forward parsed identifiers, exact quantities, and only the authenticated actor', async () => {
    const called: string[] = [];
    await withApi(
        async (origin, token) => {
            for (const [path, body, method, status] of [
                ['', { ...input, notes: '  Manila  ' }, 'POST', 201],
                ['/1', { notes: null }, 'PATCH', 200],
                ['/1/dispatch', dispatch, 'POST', 200],
                ['/1/receive', receipt, 'POST', 200],
                ['/1/cancel', {}, 'POST', 200],
            ] as const) {
                const response = await fetch(origin + path, json(body, token, method));
                assert.equal(response.status, status);
                assert.equal((await response.json()).success, true);
            }
        },
        fakeTransfers({
            createTransfer: async (body, actor) => {
                assert.deepEqual(body, { ...input, transferNumber: 'TR-1', notes: 'Manila' });
                assert.equal(actor, 7);
                called.push('create');
                return transfer;
            },
            updateTransfer: async (id, body, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                assert.deepEqual(body, { notes: null });
                called.push('update');
                return transfer;
            },
            dispatchTransfer: async (id, body, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                assert.deepEqual(body, dispatch);
                called.push('dispatch');
                return transfer;
            },
            receiveTransfer: async (id, body, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                assert.deepEqual(body, receipt);
                called.push('receive');
                return transfer;
            },
            cancelTransfer: async (id, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                called.push('cancel');
                return transfer;
            },
        }),
    );
    assert.deepEqual(called, ['create', 'update', 'dispatch', 'receive', 'cancel']);
});

test('transfer requests reject unknown fields, lossy stock writes, malformed IDs and invalid action bodies', async () =>
    withApi(async (origin, token) => {
        for (const [path, body, method] of [
            ['', { ...input, createdBy: 99 }, 'POST'],
            ['', { ...input, status: 'Completed' }, 'POST'],
            ['', { ...input, lines: [{ itemId: 3, lotId: 5, qtyRequested: 200 }] }, 'POST'],
            ['', { ...input, lines: [] }, 'POST'],
            ['/1', {}, 'PATCH'],
            ['/1', { updatedBy: 99 }, 'PATCH'],
            ['/1/dispatch', { ...dispatch, authorizedByUserId: 99 }, 'POST'],
            [
                '/1/dispatch',
                { transitLocationId: 3, lines: [{ transferLineId: 4, qtyShipped: '1e3' }] },
                'POST',
            ],
            ['/1/receive', { ...receipt, transitLocationId: 4 }, 'POST'],
            ['/1/receive', { lines: [{ transferLineId: 4, qtyReceived: '0' }] }, 'POST'],
            ['/1/cancel', { status: 'Cancelled' }, 'POST'],
            ['/0/dispatch', dispatch, 'POST'],
            ['/2147483648/receive', receipt, 'POST'],
        ] as const) {
            const response = await fetch(origin + path, json(body, token, method));
            assert.equal(response.status, 400);
            const result = await response.json();
            assert.equal(result.success, false);
            assert.ok(
                result.error.details.every(
                    (issue: { path: string; message: string; code: string }) =>
                        typeof issue.path === 'string' &&
                        typeof issue.message === 'string' &&
                        typeof issue.code === 'string',
                ),
            );
            assert.doesNotMatch(JSON.stringify(result), /authorizedByUserId.*99|createdBy.*99/);
        }
        const badId = await fetch(origin + '/1e2', {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(badId.status, 400);
        await badId.json();
    }));

test('missing transfers return 404 from details and every action', async () =>
    withApi(
        async (origin, token) => {
            const read = await fetch(origin + '/1', {
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(read.status, 404);
            await read.json();
            for (const [path, body, method] of [
                ['/1', { notes: null }, 'PATCH'],
                ['/1/dispatch', dispatch, 'POST'],
                ['/1/receive', receipt, 'POST'],
                ['/1/cancel', {}, 'POST'],
            ] as const) {
                const response = await fetch(origin + path, json(body, token, method));
                assert.equal(response.status, 404);
                await response.json();
            }
        },
        fakeTransfers({
            getTransfer: async () => null,
            updateTransfer: async () => null,
            dispatchTransfer: async () => null,
            receiveTransfer: async () => null,
            cancelTransfer: async () => null,
        }),
    ));

test('workflow and nested database errors keep safe shared HTTP status and private details out of responses', async () => {
    for (const [error, status] of [
        [new AppError(409, 'There is not enough available stock.'), 409],
        [new Error('private SQL password', { cause: { code: '23505' } }), 409],
        [new Error('private SQL password', { cause: { code: 'CONNECT_TIMEOUT' } }), 503],
        [new Error('private SQL password'), 500],
    ] as const)
        await withApi(
            async (origin, token) => {
                const response = await fetch(origin + '/1/dispatch', json(dispatch, token));
                assert.equal(response.status, status);
                const body = await response.json();
                assert.equal(body.success, false);
                assert.doesNotMatch(JSON.stringify(body), /private|SQL|password/);
            },
            fakeTransfers({
                dispatchTransfer: async () => {
                    throw error;
                },
            }),
        );
});
