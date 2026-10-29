import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    adjustmentSchema,
    stockQuerySchema,
    stockIdRequestSchema,
} from '../src/modules/inventory-stocks/inventory-stock.schema.ts';
import {
    outstandingReservations,
    planStockAdjustment,
    quantityUnits,
    quantityString,
} from '../src/modules/inventory-stocks/inventory-stock.rules.ts';
const input = { lotId: 2, locationId: 3, reasonId: 4, expectedQtyOnHand: '10', qtyOnHand: '12' };
test('stock queries parse positive PostgreSQL IDs and reject unsupported filters', () => {
    assert.deepEqual(
        stockQuerySchema.parse({
            itemId: '1',
            lotId: '2',
            locationId: '3',
            qcStatus: 'Approved',
            availability: 'available',
        }),
        { itemId: 1, lotId: 2, locationId: 3, qcStatus: 'Approved', availability: 'available' },
    );
    for (const query of [
        { itemId: '0' },
        { lotId: '1e2' },
        { locationId: '2147483648' },
        { qcStatus: 'Pending' },
        { availability: 'all' },
        { unknown: 'value' },
        { itemId: ['1', '2'] },
    ])
        assert.equal(stockQuerySchema.safeParse(query).success, false);
    for (const id of ['0', '-1', '1.5', '2147483648'])
        assert.equal(stockIdRequestSchema.safeParse({ params: { id } }).success, false);
});
test('adjustment validation preserves exact decimal strings and rejects spoofed quantities and identities', () => {
    assert.deepEqual(
        adjustmentSchema.parse({
            ...input,
            qtyOnHand: ' 9999999999.9999 ',
            referenceId: ' COUNT-1 ',
        }),
        { ...input, qtyOnHand: '9999999999.9999', referenceId: 'COUNT-1' },
    );
    assert.equal(adjustmentSchema.parse(input).referenceId, null);
    for (const patch of [
        { lotId: 0 },
        { reasonId: undefined },
        { locationId: '3' },
        { qtyOnHand: 12 },
        { qtyOnHand: '-1' },
        { qtyOnHand: '1e2' },
        { qtyOnHand: '0.00001' },
        { qtyOnHand: '10000000000' },
        { expectedQtyOnHand: undefined },
        { referenceId: 'x'.repeat(61) },
        { authorizedByUserId: 99 },
        { stockId: 1 },
        { qtyChange: '10' },
        { qtyReserved: '0' },
    ])
        assert.equal(
            adjustmentSchema.safeParse({ ...input, ...patch }).success,
            false,
            JSON.stringify(patch),
        );
});
test('reserved quantity excludes consumed amounts and released reservations', () => {
    assert.equal(
        outstandingReservations([
            { qtyReserved: '10.5000', qtyConsumed: '2.0001', releasedAt: null },
            { qtyReserved: '3.0000', qtyConsumed: '1.0000', releasedAt: null },
            { qtyReserved: '999.0000', qtyConsumed: '0', releasedAt: new Date() },
            { qtyReserved: '4', qtyConsumed: '4', releasedAt: null },
        ]),
        '10.4999',
    );
    assert.equal(outstandingReservations([]), '0.0000');
});
test('count corrections compute exact positive and negative ledger deltas', () => {
    assert.equal(planStockAdjustment('10.0000', '2.5', '10', '12.0001'), '2.0001');
    assert.equal(planStockAdjustment('10', '2.5', '10.0000', '2.5'), '-7.5000');
    assert.equal(planStockAdjustment('10', '0', '10', '0'), '-10.0000');
    assert.equal(planStockAdjustment('0', '0', '0', '9999999999.9999'), '9999999999.9999');
    assert.equal(quantityString(quantityUnits('-0.0001')), '-0.0001');
});
test('an adjustment cannot consume stock committed to active reservations', () => {
    assert.throws(
        () => planStockAdjustment('10', '2.5001', '10', '2.5'),
        /lower than active reservations/,
    );
    assert.equal(planStockAdjustment('10', '2.5001', '10', '2.5001'), '-7.4999');
});
test('stale counts, replayed changes, and unchanged balances produce no new adjustment plan', () => {
    assert.throws(() => planStockAdjustment('12', '0', '10', '15'), /Stock has changed/);
    assert.throws(() => planStockAdjustment('12', '0', '10', '12'), /Stock has changed/);
    assert.throws(() => planStockAdjustment('10', '0', '10.0000', '10'), /No adjustment is needed/);
});
