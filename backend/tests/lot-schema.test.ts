import assert from 'node:assert/strict';
import { test } from 'node:test';
import { updateLotSchema, lotIdRequestSchema } from '../src/modules/lots/lot.schema.ts';
import {
    assertLotMetadataChange,
    assertLotDates,
    lotQuantityString,
    lotQuantityUnits,
} from '../src/modules/lots/lot.rules.ts';

test('lot updates normalize optional metadata while rejecting immutable provenance, cost, quantities and audit fields', () => {
    assert.deepEqual(
        updateLotSchema.parse({
            supplierLotNumber: ' REF ',
            manufactureDate: '',
            expirationDate: null,
            qcStatus: 'Approved',
        }),
        {
            supplierLotNumber: 'REF',
            manufactureDate: null,
            expirationDate: null,
            qcStatus: 'Approved',
        },
    );
    for (const input of [
        {},
        { lotNumber: 'RENAME' },
        { itemId: 3 },
        { poLineId: 11 },
        { packingOrderId: 4 },
        { unitCost: '10' },
        { qtyOnHand: '10' },
        { createdBy: 7 },
        { qcStatus: 'Unknown' },
        { supplierLotNumber: 'x'.repeat(101) },
        { manufactureDate: '2026-02-30' },
        { manufactureDate: '2026-10-28', expirationDate: '2026-10-28' },
    ])
        assert.equal(updateLotSchema.safeParse(input).success, false);
    for (const id of ['0', '-1', '1e3', '1.2', '2147483648'])
        assert.equal(lotIdRequestSchema.safeParse({ params: { id } }).success, false);
});
test('lot dates remain optional and expiry must be strictly later when both dates are supplied', () => {
    assert.doesNotThrow(() => assertLotDates(null, null));
    assert.doesNotThrow(() => assertLotDates('2026-10-28', null));
    assert.doesNotThrow(() => assertLotDates(null, '2026-10-28'));
    assert.doesNotThrow(() => assertLotDates('2026-10-28', '2026-10-29'));
    assert.throws(() => assertLotDates('2026-10-28', '2026-10-28'), { status: 400 });
});
test('active reservations block actual QC/date changes while idempotent metadata and supplier references remain editable', () => {
    const current = { manufactureDate: null, expirationDate: null, qcStatus: 'Approved' };
    assert.doesNotThrow(() => assertLotMetadataChange(current, { ...current }, 10_000n));
    assert.throws(
        () => assertLotMetadataChange(current, { ...current, qcStatus: 'Rejected' }, 1n),
        { status: 409 },
    );
    assert.throws(
        () => assertLotMetadataChange(current, { ...current, expirationDate: '2027-01-01' }, 1n),
        { status: 409 },
    );
    assert.doesNotThrow(() =>
        assertLotMetadataChange(current, { ...current, qcStatus: 'Expired' }, 0n),
    );
});
test('lot aggregates preserve signed availability and totals larger than per-row numeric14,4 quantities', () => {
    const first = lotQuantityUnits('9999999999.9999');
    assert.equal(lotQuantityString(first + first), '19999999999.9998');
    assert.equal(lotQuantityString(lotQuantityUnits('5') - lotQuantityUnits('6.0001')), '-1.0001');
    assert.equal(lotQuantityString(lotQuantityUnits('-1000000000000.1234')), '-1000000000000.1234');
    assert.equal(lotQuantityString(0n), '0.0000');
});
