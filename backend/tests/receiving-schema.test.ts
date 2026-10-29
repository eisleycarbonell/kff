import assert from 'node:assert/strict';
import { test } from 'node:test';
import { receivePurchaseOrderSchema } from '../src/modules/receiving/receiving.schema.ts';
import {
    convertReceiptQuantity,
    inverseReceiptQuantity,
    receiptUnitCost,
    planReceiptQuantities,
    assertReceivableStatus,
    assertReceivingLocation,
} from '../src/modules/receiving/receiving.rules.ts';

const entry = {
    poLineId: 11,
    qtyReceived: '5.0000',
    expectedQtyReceived: '0',
    lotNumber: ' lot-1 ',
    locationId: 1,
};
const input = { poId: 1, lines: [entry] };
test('receiving preserves exact quantities, normalizes lot references, and keeps optional dates optional', () => {
    const parsed = receivePurchaseOrderSchema.parse({
        ...input,
        lines: [
            { ...entry, supplierLotNumber: ' REF-1 ', manufactureDate: '', expirationDate: null },
        ],
    });
    assert.deepEqual(parsed.lines[0], {
        ...entry,
        lotNumber: 'LOT-1',
        supplierLotNumber: 'REF-1',
        manufactureDate: null,
        expirationDate: null,
    });
    assert.equal(
        receivePurchaseOrderSchema.safeParse({
            poId: 1,
            lines: [
                { ...entry, lotNumber: 'LOT-1' },
                { ...entry, lotNumber: ' lot-1 ' },
            ],
        }).success,
        false,
    );
    assert.equal(
        receivePurchaseOrderSchema.safeParse({
            poId: 1,
            lines: [
                { ...entry, lotNumber: 'LOT-A' },
                { ...entry, lotNumber: 'LOT-B' },
            ],
        }).success,
        true,
    );
});
test('receiving rejects invalid quantities, server identities, unsupported fields and invalid lot dates', () => {
    for (const change of [
        { qtyReceived: '0' },
        { qtyReceived: '-1' },
        { qtyReceived: 5 },
        { qtyReceived: '1e3' },
        { qtyReceived: '1.12345' },
        { qtyReceived: '10000000000' },
        { expectedQtyReceived: '-1' },
        { expectedQtyReceived: 0 },
        { poLineId: 0 },
        { locationId: 2_147_483_648 },
        { lotNumber: '' },
        { lotNumber: 'x'.repeat(101) },
        { supplierLotNumber: 'x'.repeat(101) },
        { manufactureDate: '2026-02-30' },
        { manufactureDate: '2026-10-28', expirationDate: '2026-10-28' },
        { manufactureDate: '2026-10-28', expirationDate: '2026-10-27' },
        { itemId: 3 },
        { unitCost: '1' },
        { qcStatus: 'Approved' },
        { createdBy: 7 },
    ])
        assert.equal(
            receivePurchaseOrderSchema.safeParse({ ...input, lines: [{ ...entry, ...change }] })
                .success,
            false,
        );
    for (const extra of [{ authorizedByUserId: 7 }, { status: 'Completed' }, { itemId: 3 }])
        assert.equal(receivePurchaseOrderSchema.safeParse({ ...input, ...extra }).success, false);
    assert.equal(receivePurchaseOrderSchema.safeParse({ poId: 1, lines: [] }).success, false);
    assert.equal(
        receivePurchaseOrderSchema.safeParse({
            poId: 1,
            lines: Array.from({ length: 101 }, (_, index) => ({
                ...entry,
                lotNumber: `LOT-${index}`,
            })),
        }).success,
        false,
    );
});
test('primary quantity conversions are exact, preserve supported maxima, and never round inventory', () => {
    assert.equal(convertReceiptQuantity('1000', '1.00000000', '1000.00000000'), '1.0000');
    assert.equal(convertReceiptQuantity('1.2345', '1000.00000000', '1.00000000'), '1234.5000');
    assert.equal(convertReceiptQuantity('9999999999.9999', '1', '1'), '9999999999.9999');
    for (const args of [
        ['0.0001', '1', '3'],
        ['0.0001', '0.00000001', '1'],
        ['9999999999.9999', '2', '1'],
        ['0', '1', '1'],
        ['1', '0', '1'],
    ] as const)
        assert.throws(() => convertReceiptQuantity(args[0], args[1], args[2]), { status: 400 });
    assert.equal(inverseReceiptQuantity('1.0000', '1', '1000'), '1000.0000');
    assert.equal(inverseReceiptQuantity('0.0001', '3', '1'), null);
    assert.equal(inverseReceiptQuantity('9999999999.9999', '1', '2'), null);
});
test('primary-unit cost conversion rounds half-up to four places and rejects overflow', () => {
    assert.equal(receiptUnitCost('0.1000', '1', '1000'), '100.0000');
    assert.equal(receiptUnitCost('0.0001', '2', '1'), '0.0001');
    assert.equal(receiptUnitCost('0.0001', '3', '1'), '0.0000');
    assert.equal(receiptUnitCost('0', '3', '1000'), '0.0000');
    assert.throws(() => receiptUnitCost('9999999999.9999', '1', '2'), { status: 400 });
});
test('split lot receipts use one starting snapshot per purchase line and enforce the batch outstanding quantity', () => {
    const lines = [
        { poLineId: 11, qtyOrdered: '10.0000', qtyReceived: '2.0000' },
        { poLineId: 12, qtyOrdered: '5.0000', qtyReceived: '0.0000' },
    ];
    const plan = planReceiptQuantities(lines, [
        { poLineId: 11, qtyReceived: '3', expectedQtyReceived: '2' },
        { poLineId: 11, qtyReceived: '5', expectedQtyReceived: '2.0000' },
    ]);
    assert.equal(plan.next.get(11), '10.0000');
    assert.equal(plan.poStatus, 'Partially Received');
    assert.equal(
        planReceiptQuantities(lines, [
            { poLineId: 11, qtyReceived: '8', expectedQtyReceived: '2' },
            { poLineId: 12, qtyReceived: '5', expectedQtyReceived: '0' },
        ]).poStatus,
        'Completed',
    );
    assert.throws(
        () =>
            planReceiptQuantities(lines, [
                { poLineId: 11, qtyReceived: '5', expectedQtyReceived: '2' },
                { poLineId: 11, qtyReceived: '4', expectedQtyReceived: '2' },
            ]),
        { status: 409 },
    );
    assert.throws(
        () =>
            planReceiptQuantities(lines, [
                { poLineId: 11, qtyReceived: '1', expectedQtyReceived: '0' },
            ]),
        { status: 409 },
    );
    assert.throws(
        () =>
            planReceiptQuantities(lines, [
                { poLineId: 11, qtyReceived: '1', expectedQtyReceived: '2' },
                { poLineId: 11, qtyReceived: '1', expectedQtyReceived: '3' },
            ]),
        { status: 400 },
    );
    assert.throws(
        () =>
            planReceiptQuantities(lines, [
                { poLineId: 99, qtyReceived: '1', expectedQtyReceived: '0' },
            ]),
        { status: 400 },
    );
    assert.throws(() => planReceiptQuantities(lines, []), { status: 400 });
});
test('receiving only accepts sent or partially received orders and warehouse/quarantine destinations', () => {
    for (const status of ['Sent', 'Partially Received'])
        assert.doesNotThrow(() => assertReceivableStatus(status));
    for (const status of ['Draft', 'Completed', 'Cancelled'])
        assert.throws(() => assertReceivableStatus(status), { status: 409 });
    for (const type of ['Warehouse', 'Quarantine'])
        assert.doesNotThrow(() => assertReceivingLocation(type));
    for (const type of ['Store', 'Branch', 'Scrap', 'In Transit', 'Packing'])
        assert.throws(() => assertReceivingLocation(type), { status: 400 });
});
