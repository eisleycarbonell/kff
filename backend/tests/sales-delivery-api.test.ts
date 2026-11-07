import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { SalesOrderService } from '../src/modules/sales-orders/sales-order.controller.ts';
import type { DeliveryOrderService } from '../src/modules/delivery-orders/delivery-order.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { AppError } from '../src/errors/app-error.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'sales-delivery-test-signing-key-not-for-deployment';
const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');
const now = new Date('2026-11-05T00:00:00Z');
const audit = { createdBy: 7, updatedBy: 7, createdAt: now, updatedAt: now };
const salesOrder = {
    salesOrderId: 1,
    salesOrderNumber: 'SO-1',
    customerId: 2,
    customerName: 'Customer',
    customerIsActive: true,
    orderDate: '2026-11-05',
    requestedDeliveryDate: null,
    notes: null,
    status: 'Draft' as const,
    totalAmount: '25.0000',
    lineCount: 1,
    ...audit,
    lines: [
        {
            salesOrderLineId: 3,
            salesOrderId: 1,
            itemId: 4,
            itemSku: 'FG-1',
            itemName: 'Packed garlic',
            uomId: 5,
            uomName: 'pc',
            qtyOrdered: '10.0000',
            qtyDelivered: '0.0000',
            qtyRemaining: '10.0000',
            qtyAllocated: '0.0000',
            unitPrice: '2.5000',
            lineTotal: '25.0000',
        },
    ],
};
const deliveryOrder = {
    deliveryOrderId: 1,
    deliveryOrderNumber: 'DO-1',
    salesOrderId: 1,
    salesOrderNumber: 'SO-1',
    customerId: 2,
    customerName: 'Customer',
    sourceLocationId: 6,
    sourceLocationName: 'Finished warehouse',
    transitLocationId: null,
    transitLocationName: null,
    deliveryDate: '2026-11-06',
    notes: null,
    status: 'Draft' as const,
    dispatchedAt: null,
    completedAt: null,
    ...audit,
    lines: [
        {
            deliveryOrderLineId: 9,
            deliveryOrderId: 1,
            salesOrderLineId: 3,
            itemId: 4,
            itemSku: 'FG-1',
            itemName: 'Packed garlic',
            lotId: 8,
            lotNumber: 'FG-LOT',
            uomId: 5,
            uomName: 'pc',
            qtyDelivered: '5.0000',
        },
    ],
};
const salesInput = {
    salesOrderNumber: ' so-1 ',
    customerId: 2,
    orderDate: '2026-11-05',
    lines: [{ itemId: 4, uomId: 5, qtyOrdered: '10', unitPrice: '2.5' }],
};
const deliveryInput = {
    deliveryOrderNumber: ' do-1 ',
    salesOrderId: 1,
    sourceLocationId: 6,
    deliveryDate: '2026-11-06',
    lines: [{ salesOrderLineId: 3, lotId: 8, qtyDelivered: '5' }],
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
function sales(overrides: Partial<SalesOrderService> = {}): SalesOrderService {
    return {
        listSalesOrders: async () => [salesOrder],
        getSalesOrder: async () => salesOrder,
        getSalesOrderOptions: async () => ({ customers: [], items: [] }),
        createSalesOrder: async () => salesOrder,
        updateSalesOrder: async () => salesOrder,
        confirmSalesOrder: async () => ({ ...salesOrder, status: 'Confirmed' }),
        cancelSalesOrder: async () => ({ ...salesOrder, status: 'Cancelled' }),
        ...overrides,
    };
}
function deliveries(overrides: Partial<DeliveryOrderService> = {}): DeliveryOrderService {
    return {
        listDeliveryOrders: async () => [deliveryOrder],
        getDeliveryOrder: async () => deliveryOrder,
        getDeliveryOrderOptions: async () => ({ salesOrders: [], locations: [], stock: [] }),
        createDeliveryOrder: async () => deliveryOrder,
        updateDeliveryOrder: async () => deliveryOrder,
        dispatchDeliveryOrder: async () => ({ ...deliveryOrder, status: 'In Transit' }),
        completeDeliveryOrder: async () => ({ ...deliveryOrder, status: 'Completed' }),
        cancelDeliveryOrder: async () => ({ ...deliveryOrder, status: 'Cancelled' }),
        ...overrides,
    };
}
async function withApi(
    run: (url: string, token: string) => Promise<void>,
    permissions: SessionUser['permissions'] = {
        canManageInventory: true,
        canManageTransfers: true,
    },
    salesService = sales(),
    deliveryService = deliveries(),
) {
    const user: SessionUser = {
        userId: 7,
        firstName: 'Maria',
        lastName: 'Santos',
        email: 'manager@example.com',
        roleId: 2,
        permissions,
    };
    const server = createApp({
        userService: users,
        salesOrderService: salesService,
        deliveryOrderService: deliveryService,
        authService: {
            login: async () => user,
            getSessionUser: async (id) => (id === 7 ? user : null),
        },
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    try {
        await run(`http://127.0.0.1:${address.port}/api`, await generateToken({ id: '7' }, '5m'));
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
const salesWrites = [
    ['', salesInput, 'POST'],
    ['/1', { notes: null }, 'PATCH'],
    ['/1/confirm', {}, 'POST'],
    ['/1/cancel', {}, 'POST'],
] as const;
const deliveryWrites = [
    ['', deliveryInput, 'POST'],
    ['/1', { notes: null }, 'PATCH'],
    ['/1/dispatch', { transitLocationId: 7 }, 'POST'],
    ['/1/complete', {}, 'POST'],
    ['/1/cancel', {}, 'POST'],
] as const;

test('sales and delivery reads authenticate, expose exact decimal DTOs and allow read-only roles', async () =>
    withApi(async (url, token) => {
        for (const resource of ['sales-orders', 'delivery-orders']) {
            for (const path of ['', '/1', '/options']) {
                const anonymous = await fetch(`${url}/${resource}${path}`);
                assert.equal(anonymous.status, 401);
                await anonymous.json();
                const response = await fetch(`${url}/${resource}${path}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(response.status, 200);
                const envelope = await response.json();
                assert.equal(envelope.success, true);
                if (path === '/1')
                    assert.deepEqual(
                        envelope.data,
                        JSON.parse(
                            JSON.stringify(
                                resource === 'sales-orders' ? salesOrder : deliveryOrder,
                            ),
                        ),
                    );
            }
        }
    }, {}));

test('sales and delivery enforce independent existing management permissions on every write', async () => {
    for (const [resource, requests, permissions] of [
        ['sales-orders', salesWrites, { canManageTransfers: true, canManagePurchasing: true }],
        ['delivery-orders', deliveryWrites, { canManageInventory: true, canManagePacking: true }],
    ] as const)
        await withApi(async (url, token) => {
            for (const [path, body, method] of requests) {
                const response = await fetch(
                    `${url}/${resource}${path}`,
                    json(body, token, method),
                );
                assert.equal(response.status, 403);
                await response.json();
            }
        }, permissions);
});

test('writes normalize inputs and derive audit identity from the authenticated session', async () => {
    const calls: string[] = [];
    await withApi(
        async (url, token) => {
            for (const [resource, requests] of [
                ['sales-orders', salesWrites],
                ['delivery-orders', deliveryWrites],
            ] as const)
                for (const [path, body, method] of requests) {
                    const response = await fetch(
                        `${url}/${resource}${path}`,
                        json(body, token, method),
                    );
                    assert.equal(response.status, path === '' ? 201 : 200);
                    await response.json();
                }
        },
        undefined,
        sales({
            createSalesOrder: async (body, actor) => {
                assert.equal(actor, 7);
                assert.deepEqual(body, { ...salesInput, salesOrderNumber: 'SO-1' });
                calls.push('sales-create');
                return salesOrder;
            },
            updateSalesOrder: async (id, body, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                assert.deepEqual(body, { notes: null });
                calls.push('sales-update');
                return salesOrder;
            },
            confirmSalesOrder: async (id, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                calls.push('confirm');
                return salesOrder;
            },
            cancelSalesOrder: async (id, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                calls.push('sales-cancel');
                return salesOrder;
            },
        }),
        deliveries({
            createDeliveryOrder: async (body, actor) => {
                assert.equal(actor, 7);
                assert.deepEqual(body, { ...deliveryInput, deliveryOrderNumber: 'DO-1' });
                calls.push('delivery-create');
                return deliveryOrder;
            },
            updateDeliveryOrder: async (id, body, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                assert.deepEqual(body, { notes: null });
                calls.push('delivery-update');
                return deliveryOrder;
            },
            dispatchDeliveryOrder: async (id, body, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                assert.deepEqual(body, { transitLocationId: 7 });
                calls.push('dispatch');
                return deliveryOrder;
            },
            completeDeliveryOrder: async (id, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                calls.push('complete');
                return deliveryOrder;
            },
            cancelDeliveryOrder: async (id, actor) => {
                assert.equal(id, 1);
                assert.equal(actor, 7);
                calls.push('delivery-cancel');
                return deliveryOrder;
            },
        }),
    );
    assert.deepEqual(calls, [
        'sales-create',
        'sales-update',
        'confirm',
        'sales-cancel',
        'delivery-create',
        'delivery-update',
        'dispatch',
        'complete',
        'delivery-cancel',
    ]);
});

test('invalid sales and delivery requests reject client audit fields, lossy decimals and action overrides', async () =>
    withApi(async (url, token) => {
        const invalid = [
            ['sales-orders', '', { ...salesInput, createdBy: 99 }],
            ['sales-orders', '', { ...salesInput, status: 'Completed' }],
            [
                'sales-orders',
                '',
                { ...salesInput, lines: [{ ...salesInput.lines[0], qtyOrdered: 10 }] },
            ],
            [
                'sales-orders',
                '',
                { ...salesInput, lines: [{ ...salesInput.lines[0], unitPrice: '-1' }] },
            ],
            ['sales-orders', '', { ...salesInput, orderDate: '2026-02-30' }],
            ['sales-orders', '', { ...salesInput, requestedDeliveryDate: '2026-11-04' }],
            ['sales-orders', '', { ...salesInput, lines: [] }],
            ['sales-orders', '/1/confirm', { status: 'Confirmed' }],
            ['sales-orders', '/1/cancel', { updatedBy: 99 }],
            ['delivery-orders', '', { ...deliveryInput, updatedBy: 99 }],
            ['delivery-orders', '', { ...deliveryInput, lines: [] }],
            [
                'delivery-orders',
                '',
                { ...deliveryInput, lines: [{ ...deliveryInput.lines[0], qtyDelivered: '1e2' }] },
            ],
            [
                'delivery-orders',
                '',
                { ...deliveryInput, lines: [{ ...deliveryInput.lines[0], qtyDelivered: '0' }] },
            ],
            ['delivery-orders', '/1/dispatch', { transitLocationId: 0 }],
            ['delivery-orders', '/1/complete', { qtyDelivered: '2' }],
            ['delivery-orders', '/1/cancel', { authorizedByUserId: 99 }],
        ] as const;
        for (const [resource, path, body] of invalid) {
            const response = await fetch(`${url}/${resource}${path}`, json(body, token));
            assert.equal(response.status, 400, `${resource}${path}: ${JSON.stringify(body)}`);
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
        }
        for (const resource of ['sales-orders', 'delivery-orders']) {
            for (const id of ['0', '2147483648', '1e2']) {
                const response = await fetch(`${url}/${resource}/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(response.status, 400);
                await response.json();
            }
            for (const body of [{}, { updatedBy: 99 }]) {
                const response = await fetch(`${url}/${resource}/1`, json(body, token, 'PATCH'));
                assert.equal(response.status, 400);
                await response.json();
            }
        }
    }));

test('missing records return 404 for details and all mutation actions', async () =>
    withApi(
        async (url, token) => {
            for (const [resource, requests] of [
                ['sales-orders', salesWrites],
                ['delivery-orders', deliveryWrites],
            ] as const) {
                const response = await fetch(`${url}/${resource}/1`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(response.status, 404);
                await response.json();
                for (const [path, body, method] of requests.filter(([path]) => path !== '')) {
                    const response = await fetch(
                        `${url}/${resource}${path}`,
                        json(body, token, method),
                    );
                    assert.equal(response.status, 404);
                    await response.json();
                }
            }
        },
        undefined,
        sales({
            getSalesOrder: async () => null,
            updateSalesOrder: async () => null,
            confirmSalesOrder: async () => null,
            cancelSalesOrder: async () => null,
        }),
        deliveries({
            getDeliveryOrder: async () => null,
            updateDeliveryOrder: async () => null,
            dispatchDeliveryOrder: async () => null,
            completeDeliveryOrder: async () => null,
            cancelDeliveryOrder: async () => null,
        }),
    ));

test('workflow and database failures preserve safe errors and status codes', async () => {
    for (const [error, status] of [
        [new AppError(409, 'Not enough available stock.'), 409],
        [new Error('private SQL password', { cause: { code: '23505' } }), 409],
        [new Error('private SQL password', { cause: { code: 'CONNECT_TIMEOUT' } }), 503],
        [new Error('private SQL password'), 500],
    ] as const)
        await withApi(
            async (url, token) => {
                const response = await fetch(
                    `${url}/delivery-orders/1/dispatch`,
                    json({ transitLocationId: 7 }, token),
                );
                assert.equal(response.status, status);
                const body = await response.json();
                assert.equal(body.success, false);
                assert.doesNotMatch(JSON.stringify(body), /private|SQL|password/);
            },
            undefined,
            sales(),
            deliveries({
                dispatchDeliveryOrder: async () => {
                    throw error;
                },
            }),
        );
});
