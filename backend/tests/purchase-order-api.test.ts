import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { PurchaseOrderService } from '../src/modules/purchase-orders/purchase-order.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { AppError } from '../src/errors/app-error.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-purchase-order-signing-key-not-for-deployment';
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
    createdAt: new Date('2026-10-28T00:00:00Z'),
    updatedBy: 7,
    updatedAt: new Date('2026-10-28T00:00:00Z'),
};
const line = {
    poLineId: 11,
    poId: 1,
    itemId: 3,
    itemSku: 'RM-GARLIC',
    itemName: 'Garlic powder',
    itemType: 'Raw Material - Bulk' as const,
    itemIsActive: true,
    uomId: 1,
    uomName: 'kg',
    uomClassId: 1,
    primaryUomId: 1,
    primaryUomName: 'kg',
    qtyOrdered: '100.0000',
    qtyReceived: '0.0000',
    qtyRemaining: '100.0000',
    unitPrice: '110.0000',
    lineTotal: '11000.00000000',
    ...audit,
};
const summary = {
    poId: 1,
    poNumber: 'PO-2026-0001',
    supplierId: 2,
    supplierName: 'Spice supplier',
    supplierIsActive: true,
    status: 'Draft' as const,
    orderDate: new Date('2026-10-28T00:00:00Z'),
    expectedDeliveryDate: null,
    notes: null,
    lineCount: 1,
    totalAmount: '11000.00000000',
    receivedAmount: '0.00000000',
    outstandingAmount: '11000.00000000',
    hasReceipts: false,
    ...audit,
};
const detail = { ...summary, lines: [line] };
const options = {
    suppliers: [{ supplierId: 2, name: 'Spice supplier', isActive: true }],
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
    supplierItems: [],
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
function fakeOrders(overrides: Partial<PurchaseOrderService> = {}): PurchaseOrderService {
    return {
        listPurchaseOrders: async () => [summary],
        getPurchaseOrder: async () => detail,
        getPurchaseOrderOptions: async () => options,
        createPurchaseOrder: async () => detail,
        updatePurchaseOrder: async () => detail,
        sendPurchaseOrder: async () => ({ ...detail, status: 'Sent' }),
        cancelPurchaseOrder: async () => ({ ...detail, status: 'Cancelled' }),
        ...overrides,
    };
}
async function withApi(
    run: (origin: string, token: string) => Promise<void>,
    service = fakeOrders(),
    viewer = false,
) {
    const user = viewer
        ? { ...manager, permissions: { canManagePurchasing: false, canManageInventory: true } }
        : manager;
    const server = createApp({
        userService: users,
        purchaseOrderService: service,
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
            `http://127.0.0.1:${address.port}/api/purchase-orders`,
            await generateToken({ id: '7' }, '5m'),
        );
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
    }
}
const json = (method: string, body: unknown, token: string): RequestInit => ({
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});
const input = {
    poNumber: ' po-2026-0001 ',
    supplierId: 2,
    orderDate: '2026-10-28T00:00:00Z',
    lines: [{ itemId: 3, uomId: 1, qtyOrdered: '100.0000', unitPrice: '110.0000' }],
};

test('purchase-order reads require a session and preserve summary/detail decimals and independent options', async () =>
    withApi(async (origin, token) => {
        for (const [path, data] of [
            ['', [summary]],
            ['/1', detail],
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

test('view-only and inventory-only roles cannot create, edit, send, or cancel purchase orders', async () =>
    withApi(
        async (origin, token) => {
            const read = await fetch(origin, { headers: { Authorization: `Bearer ${token}` } });
            assert.equal(read.status, 200);
            await read.json();
            for (const [path, method, body] of [
                ['', 'POST', input],
                ['/1', 'PATCH', { notes: null }],
                ['/1/send', 'POST', {}],
                ['/1/cancel', 'POST', {}],
            ] as const) {
                const response = await fetch(origin + path, json(method, body, token));
                assert.equal(response.status, 403);
                await response.json();
            }
        },
        fakeOrders(),
        true,
    ));

test('creating and editing drafts pass normalized fields and authenticated audit identity only', async () => {
    let writes = 0;
    await withApi(
        async (origin, token) => {
            const created = await fetch(origin, json('POST', input, token));
            assert.equal(created.status, 201);
            assert.equal((await created.json()).data.status, 'Draft');
            const updated = await fetch(
                origin + '/1',
                json('PATCH', { notes: '  revised notes  ', expectedDeliveryDate: null }, token),
            );
            assert.equal(updated.status, 200);
            await updated.json();
            assert.equal(writes, 2);
        },
        fakeOrders({
            createPurchaseOrder: async (parsed, actor) => {
                writes++;
                assert.deepEqual(parsed, { ...input, poNumber: 'PO-2026-0001' });
                assert.equal(actor, 7);
                return detail;
            },
            updatePurchaseOrder: async (id, parsed, actor) => {
                writes++;
                assert.equal(id, 1);
                assert.deepEqual(parsed, { notes: 'revised notes', expectedDeliveryDate: null });
                assert.equal(actor, 7);
                return detail;
            },
        }),
    );
});

test('send and cancel consume strict action bodies and return server-confirmed detail state', async () => {
    const actions: string[] = [];
    await withApi(
        async (origin, token) => {
            for (const [action, status] of [
                ['send', 'Sent'],
                ['cancel', 'Cancelled'],
            ] as const) {
                const response = await fetch(`${origin}/1/${action}`, json('POST', {}, token));
                assert.equal(response.status, 200);
                const body = await response.json();
                assert.equal(body.data.status, status);
                assert.deepEqual(body.data.lines, JSON.parse(JSON.stringify(detail.lines)));
            }
            assert.deepEqual(actions, ['send', 'cancel']);
        },
        fakeOrders({
            sendPurchaseOrder: async (id, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                actions.push('send');
                return { ...detail, status: 'Sent' };
            },
            cancelPurchaseOrder: async (id, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                actions.push('cancel');
                return { ...detail, status: 'Cancelled' };
            },
        }),
    );
});

test('invalid dates, quantities, duplicate lines, IDs, audit spoofing, and lifecycle field injection stop before writes', async () => {
    let writes = 0;
    await withApi(
        async (origin, token) => {
            for (const [path, method, body] of [
                ['', 'POST', { ...input, createdBy: 999 }],
                ['', 'POST', { ...input, status: 'Completed' }],
                [
                    '',
                    'POST',
                    { ...input, orderDate: 'invalid', expectedDeliveryDate: '2026-10-28' },
                ],
                ['', 'POST', { ...input, lines: [{ ...input.lines[0], qtyReceived: '1' }] }],
                ['', 'POST', { ...input, lines: [{ ...input.lines[0], qtyOrdered: 100 }] }],
                ['', 'POST', { ...input, lines: [input.lines[0], input.lines[0]] }],
                ['/1', 'PATCH', {}],
                ['/1/send', 'POST', { updatedBy: 999 }],
                ['/1/cancel', 'POST', { status: 'Cancelled' }],
                ['/0', 'PATCH', { notes: null }],
                ['/2147483648/send', 'POST', {}],
            ] as const) {
                const response = await fetch(origin + path, json(method, body, token));
                assert.equal(response.status, 400);
                const data = await response.json();
                assert.equal(data.success, false);
                assert.ok(data.error.details);
            }
            assert.equal(writes, 0);
        },
        fakeOrders({
            createPurchaseOrder: async () => {
                writes++;
                return detail;
            },
            updatePurchaseOrder: async () => {
                writes++;
                return detail;
            },
            sendPurchaseOrder: async () => {
                writes++;
                return detail;
            },
            cancelPurchaseOrder: async () => {
                writes++;
                return detail;
            },
        }),
    );
});

test('missing purchase orders return 404 and history has no deletion endpoint', async () =>
    withApi(
        async (origin, token) => {
            for (const [path, method, body] of [
                ['/99', 'GET', undefined],
                ['/99', 'PATCH', { notes: null }],
                ['/99/send', 'POST', {}],
                ['/99/cancel', 'POST', {}],
                ['/1', 'DELETE', undefined],
            ] as const) {
                const response = await fetch(
                    origin + path,
                    body === undefined
                        ? { method, headers: { Authorization: `Bearer ${token}` } }
                        : json(method, body, token),
                );
                assert.equal(response.status, 404);
                await response.json();
            }
        },
        fakeOrders({
            getPurchaseOrder: async () => null,
            updatePurchaseOrder: async () => null,
            sendPurchaseOrder: async () => null,
            cancelPurchaseOrder: async () => null,
        }),
    ));

test('read-only lifecycle conflicts and database failures remain readable without SQL or credential leakage', async () => {
    for (const error of [
        new AppError(409, 'Only draft purchase orders can be edited.'),
        new AppError(409, 'A purchase order with receiving history cannot be sent or cancelled.'),
        new Error('private SQL and password', { cause: { code: '23505' } }),
        new Error('private host and password', { cause: { code: 'CONNECT_TIMEOUT' } }),
    ]) {
        await withApi(
            async (origin, token) => {
                const response = await fetch(origin + '/1', json('PATCH', { notes: null }, token));
                assert.equal(
                    response.status,
                    error instanceof AppError || (error.cause as { code: string })?.code === '23505'
                        ? 409
                        : 503,
                );
                const body = await response.json();
                assert.equal(body.success, false);
                assert.doesNotMatch(JSON.stringify(body), /private|SQL|password/);
                if (error instanceof AppError) assert.equal(body.error.message, error.message);
            },
            fakeOrders({
                updatePurchaseOrder: async () => {
                    throw error;
                },
            }),
        );
    }
});
