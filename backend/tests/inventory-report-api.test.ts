import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { InventoryReportService } from '../src/modules/inventory-reports/inventory-report.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { buildInventoryReport } from '../src/modules/inventory-reports/inventory-report.rules.ts';
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-report-key';
const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');
const session: SessionUser = {
    userId: 7,
    firstName: 'Report',
    lastName: 'Viewer',
    email: 'viewer@example.com',
    roleId: 2,
    permissions: {},
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
    service: InventoryReportService,
    run: (base: string, cookie: string) => Promise<void>,
) {
    const server = createApp({
        userService: users,
        inventoryReportService: service,
        authService: {
            login: async () => session,
            getSessionUser: async (id) => (id === 7 ? session : null),
        },
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    try {
        await run(
            `http://127.0.0.1:${address.port}/api/reports/inventory`,
            `jwt=${await generateToken({ id: '7' }, '5m')}`,
        );
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
    }
}
test('report and options reads require authentication and allow viewers without write permissions', async () => {
    let calls = 0;
    await withApi(
        {
            getInventoryReport: async (query) => {
                calls++;
                return buildInventoryReport(query, [], [], [], new Date('2026-11-07T00:00:00Z'));
            },
            getInventoryReportOptions: async () => ({ items: [], locations: [], labels: [] }),
        },
        async (base, cookie) => {
            assert.equal((await fetch(base)).status, 401);
            assert.equal((await fetch(base + '/options')).status, 401);
            assert.equal(calls, 0);
            for (const report of [
                'stock-by-location',
                'stock-by-lot',
                'low-stock',
                'near-expiry',
                'movement',
            ]) {
                const response = await fetch(base + '?report=' + report, { headers: { cookie } });
                assert.equal(response.status, 200);
                const body = await response.json();
                assert.equal(body.success, true);
                assert.equal(body.data.report, report);
                assert.deepEqual(body.data.rows, []);
            }
            const options = await fetch(base + '/options', { headers: { cookie } });
            assert.equal(options.status, 200);
            assert.deepEqual((await options.json()).data, { items: [], locations: [], labels: [] });
            assert.equal(calls, 5);
        },
    );
});
test('report query parsing normalizes exact filters and blocks invalid or unknown fields before service calls', async () => {
    let calls = 0;
    await withApi(
        {
            getInventoryReport: async (query) => {
                calls++;
                assert.equal(query.report, 'movement');
                assert.equal(query.itemId, 3);
                assert.equal(query.locationId, 4);
                assert.equal(query.q, 'Garlic');
                return buildInventoryReport(query, [], [], []);
            },
            getInventoryReportOptions: async () => ({ items: [], locations: [], labels: [] }),
        },
        async (base, cookie) => {
            const good = await fetch(
                base +
                    '?report=movement&itemId=3&locationId=4&q=%20Garlic%20&fromDate=2026-11-07&toDate=2026-11-07&transactionType=Sale',
                { headers: { cookie } },
            );
            assert.equal(good.status, 200);
            for (const query of [
                'report=unknown',
                'itemId=-1',
                'locationId=2&locationId=3',
                'expiryDays=3651',
                'threshold=0.00001',
                'includeExpired=1',
                'report=movement&fromDate=2026-02-30',
                'report=movement&toDate=2026-11-06&fromDate=2026-11-07',
                'authorizedBy=7',
                'report=movement&qcStatus=Approved',
            ]) {
                const response = await fetch(base + '?' + query, { headers: { cookie } });
                assert.equal(response.status, 400, query);
                const body = await response.json();
                assert.equal(body.success, false);
                assert.ok(body.error.details.length);
            }
            assert.equal(calls, 1);
            for (const method of ['POST', 'PATCH', 'DELETE'])
                assert.equal((await fetch(base, { method, headers: { cookie } })).status, 404);
        },
    );
});
test('database failures in reports remain safe and readable', async () => {
    await withApi(
        {
            getInventoryReport: async () => {
                throw Object.assign(new Error('private SQL secret'), { code: '08006' });
            },
            getInventoryReportOptions: async () => {
                throw new Error('private SQL secret');
            },
        },
        async (base, cookie) => {
            const report = await fetch(base, { headers: { cookie } });
            assert.equal(report.status, 503);
            assert.doesNotMatch(JSON.stringify(await report.json()), /private|secret|SQL/);
            const options = await fetch(base + '/options', { headers: { cookie } });
            assert.equal(options.status, 500);
            assert.doesNotMatch(JSON.stringify(await options.json()), /private|secret|SQL/);
        },
    );
});
