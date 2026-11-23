import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { AccountingService } from '../src/modules/accounting/accounting.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import {
    dividePerUnit4,
    formatScaled4,
    multiplyScaled4,
    percentString,
    resolveEffectiveCost,
    scaled4,
} from '../src/modules/accounting/accounting.rules.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-accounting-session-key';

const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');

const accountantUser: SessionUser = {
    userId: 7,
    firstName: 'Lucia',
    lastName: 'Bautista',
    email: 'accounting@spice.local',
    roleId: 7,
    permissions: { canManageAccounting: true },
};

const mockOverview: Awaited<ReturnType<AccountingService['getAccountingOverview']>> = {
    generatedAt: '2026-11-16T00:00:00.000Z',
    currencyCode: 'PHP',
    summary: {
        currencyCode: 'PHP',
        totalInventoryAssetValue: '25000.0000',
        rawMaterialAssetValue: '10000.0000',
        packagingAssetValue: '5000.0000',
        finishedGoodsAssetValue: '10000.0000',
        purchaseCommittedValue: '12000.0000',
        purchaseReceivedValue: '8000.0000',
        purchaseOutstandingValue: '4000.0000',
        totalProductionCost: '7500.0000',
        totalBookedRevenue: '18000.0000',
        totalDeliveredRevenue: '14000.0000',
        totalDeliveredCogs: '8500.0000',
        grossProfit: '5500.0000',
        grossMarginPercent: '39.29',
        scrapLossValue: '250.0000',
        adjustmentNetValue: '-100.0000',
        costedLotsCount: 6,
        uncostedLotsCount: 1,
    },
    valuationByCategory: [],
    valuationByLocation: [],
    lotCosting: [],
    packingCosting: [],
    salesCosting: [],
    purchasingCosting: [],
    costLedger: [],
};

test('accounting endpoint enforces authentication and accounting-only permission', async () => {
    let activeUser: SessionUser = {
        ...accountantUser,
        permissions: { canManageInventory: true, canManagePurchasing: true },
    };
    let calls = 0;

    const app = createApp({
        userService: {} as UserService,
        authService: {
            getSessionUser: async (id) => (id === activeUser.userId ? activeUser : null),
            login: async () => null,
        },
        accountingService: {
            getAccountingOverview: async () => {
                calls += 1;
                return mockOverview;
            },
        },
    });
    const server = app.listen(0, '127.0.0.1');
    try {
        await once(server, 'listening');
        const address = server.address();
        const origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
        const token = await generateToken({ id: String(activeUser.userId) }, '1h');

        const unauthenticated = await fetch(`${origin}/api/accounting`);
        assert.equal(unauthenticated.status, 401);

        const forbidden = await fetch(`${origin}/api/accounting`, {
            headers: { cookie: `jwt=${encodeURIComponent(token)}` },
        });
        assert.equal(forbidden.status, 403);
        assert.equal(calls, 0);

        activeUser = accountantUser;
        const ok = await fetch(`${origin}/api/accounting?fromDate=2026-11-01&toDate=2026-11-16`, {
            headers: { cookie: `jwt=${encodeURIComponent(token)}` },
        });
        assert.equal(ok.status, 200);
        const body = (await ok.json()) as { success: boolean; data: typeof mockOverview };
        assert.equal(body.success, true);
        assert.equal(body.data.summary.grossProfit, '5500.0000');
        assert.equal(calls, 1);

        const badDates = await fetch(`${origin}/api/accounting?fromDate=2026-11-20&toDate=2026-11-01`, {
            headers: { cookie: `jwt=${encodeURIComponent(token)}` },
        });
        assert.equal(badDates.status, 400);
    } finally {
        server.close();
        await once(server, 'close');
    }
});

test('accounting rules compute exact 4-decimal costing, unit roll-ups, and margins', () => {
    const qty = scaled4('12.5000');
    const unitCost = scaled4('110.2500');
    const total = multiplyScaled4(qty, unitCost);
    assert.equal(formatScaled4(total), '1378.1250');

    assert.equal(dividePerUnit4(total, scaled4('100')), '13.7813');
    assert.equal(dividePerUnit4(total, 0n), null);

    assert.equal(percentString(scaled4('5500'), scaled4('14000')), '39.29');
    assert.equal(percentString(scaled4('-500'), scaled4('2000')), '-25.00');
    assert.equal(percentString(100n, 0n), null);

    assert.deepEqual(resolveEffectiveCost('95.0000', '100.0000', 'Purchase'), {
        effectiveUnitCost: '95.0000',
        costBasis: 'Purchase Actual',
    });
    assert.deepEqual(resolveEffectiveCost('28.5000', '30.0000', 'Packing'), {
        effectiveUnitCost: '28.5000',
        costBasis: 'Packing Roll-Up',
    });
    assert.deepEqual(resolveEffectiveCost(null, '30.0000', 'Opening'), {
        effectiveUnitCost: '30.0000',
        costBasis: 'Catalog Reference',
    });
});
