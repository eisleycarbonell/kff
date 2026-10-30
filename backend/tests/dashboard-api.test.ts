import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { DashboardService } from '../src/modules/dashboard/dashboard.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { AppError } from '../src/errors/app-error.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-dashboard-session-key';

const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');

const user: SessionUser = {
    userId: 1,
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@spice.local',
    roleId: 1,
    permissions: {
        canManageInventory: true,
        canManagePurchasing: true,
        canManagePacking: true,
        canManageTransfers: true,
        canManageUsers: true,
    },
};

const mockDashboardData: Awaited<ReturnType<DashboardService['getDashboardData']>> = {
    summary: {
        totalInventoryValue: '125000.0000',
        rawMaterialValue: '50000.0000',
        packagingValue: '15000.0000',
        finishedGoodsValue: '60000.0000',
        totalItemsCount: 42,
        rawMaterialsOnHand: '500.0000',
        rawMaterialsReserved: '100.0000',
        rawMaterialsAvailable: '400.0000',
        finishedGoodsOnHand: '250.0000',
        finishedGoodsReserved: '50.0000',
        finishedGoodsAvailable: '200.0000',
        activePackingOrdersCount: 2,
        pendingPurchaseOrdersCount: 1,
        activeTransfersCount: 1,
        lowStockItemsCount: 1,
        expiringLotsCount: 1,
    },
    stockByType: [
        {
            itemType: 'Raw Material - Bulk',
            totalOnHand: '500.0000',
            totalReserved: '100.0000',
            totalAvailable: '400.0000',
            totalValue: '50000.0000',
            itemCount: 12,
        },
    ],
    stockByLocation: [
        {
            locationId: 1,
            locationCode: 'WH-01',
            locationName: 'Main Warehouse',
            locationType: 'Warehouse',
            totalOnHand: '500.0000',
            totalReserved: '100.0000',
            totalAvailable: '400.0000',
            itemCount: 12,
        },
    ],
    activePackingOrders: [],
    pendingPurchaseOrders: [],
    activeTransfers: [],
    expiringLots: [],
    lowStockItems: [],
    recentActivity: [],
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

async function withApi(
    dashboardService: DashboardService,
    run: (origin: string, cookie: string) => Promise<void>,
    session = user,
) {
    const server = createApp({
        userService: users,
        dashboardService,
        authService: {
            login: async () => session,
            getSessionUser: async (id: number) => (id === session.userId ? session : null),
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

test('dashboard endpoint rejects unauthenticated requests with 401', async () => {
    await withApi({ async getDashboardData() { return mockDashboardData; } }, async (origin) => {
        const response = await fetch(`${origin}/api/dashboard`, {
            headers: { Accept: 'application/json' },
        });
        assert.equal(response.status, 401);
        const body = await response.json();
        assert.equal(body.success, false);
        assert.equal(body.error.message, 'Please sign in.');
    });
});

test('dashboard endpoint returns 200 and valid data for authenticated user', async () => {
    await withApi({ async getDashboardData() { return mockDashboardData; } }, async (origin, cookie) => {
        const response = await fetch(`${origin}/api/dashboard`, {
            headers: {
                Accept: 'application/json',
                Cookie: cookie,
            },
        });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.success, true);
        assert.equal(body.data.summary.totalInventoryValue, '125000.0000');
        assert.equal(body.data.summary.totalItemsCount, 42);
        assert.equal(body.data.stockByType.length, 1);
        assert.equal(body.data.stockByLocation.length, 1);
    });
});

test('dashboard endpoint propagates service errors cleanly', async () => {
    await withApi({
        async getDashboardData() {
            throw new AppError(503, 'Database temporarily unavailable.');
        },
    }, async (origin, cookie) => {
        const response = await fetch(`${origin}/api/dashboard`, {
            headers: {
                Accept: 'application/json',
                Cookie: cookie,
            },
        });
        assert.equal(response.status, 503);
        const body = await response.json();
        assert.equal(body.success, false);
        assert.equal(body.error.message, 'Database temporarily unavailable.');
    });
});
