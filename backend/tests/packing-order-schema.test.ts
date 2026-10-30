import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    completePackingOrderSchema,
    createPackingOrderSchema,
    packingOrderActionRequestSchema,
    packingOrderIdRequestSchema,
    previewPackingOrderSchema,
    updatePackingOrderSchema,
} from '../src/modules/packing-orders/packing-order.schema.ts';
import {
    allocatePackingMaterial,
    assertPackingLocation,
    assertPackingLot,
    assertPackingStatus,
    packingConsumption,
    packingMaximum,
    packingOutputStep,
    packingRequirement,
    packingUnitCost,
} from '../src/modules/packing-orders/packing-order.rules.ts';

const draft = {
    packingOrderNumber: ' pk-2026-001 ',
    itemId: 7,
    targetQty: ' 500.0000 ',
    sourceLocationId: 1,
    destinationLocationId: 2,
};

test('packing creation normalizes metadata, preserves exact quantities, and supports optional dates', () => {
    assert.deepEqual(
        createPackingOrderSchema.parse({ ...draft, scheduledDate: '', notes: '  Pack label A  ' }),
        {
            ...draft,
            packingOrderNumber: 'PK-2026-001',
            targetQty: '500.0000',
            scheduledDate: null,
            notes: 'Pack label A',
        },
    );
    assert.equal(createPackingOrderSchema.parse({ ...draft, notes: ' ' }).notes, null);
    assert.equal(
        createPackingOrderSchema.parse({ ...draft, scheduledDate: null }).scheduledDate,
        null,
    );
    assert.equal(createPackingOrderSchema.parse(draft).scheduledDate, undefined);
    assert.equal(
        createPackingOrderSchema.parse({ ...draft, targetQty: '9999999999.9999' }).targetQty,
        '9999999999.9999',
    );
    assert.deepEqual(
        previewPackingOrderSchema.parse({ itemId: 7, sourceLocationId: 1, targetQty: '0.0001' }),
        { itemId: 7, sourceLocationId: 1, targetQty: '0.0001' },
    );
});

test('packing inputs reject invalid precision, identities, stock writes, and client workflow states', () => {
    for (const change of [
        { packingOrderNumber: '' },
        { packingOrderNumber: 'X'.repeat(31) },
        { itemId: 0 },
        { sourceLocationId: 2_147_483_648 },
        { destinationLocationId: '2' },
        { targetQty: '0.0000' },
        { targetQty: '-1' },
        { targetQty: '1e3' },
        { targetQty: '1.00001' },
        { targetQty: '10000000000' },
        { targetQty: 500 },
        { scheduledDate: '2026-02-30' },
        { notes: 'X'.repeat(5001) },
        { packingOrderId: 1 },
        { status: 'Completed' },
        { actualQty: '10' },
        { createdBy: 4 },
        { updatedBy: 4 },
        { materials: [] },
        { reservations: [] },
        { qtyOnHand: '1' },
    ])
        assert.equal(createPackingOrderSchema.safeParse({ ...draft, ...change }).success, false);
    assert.equal(
        previewPackingOrderSchema.safeParse({
            itemId: 7,
            sourceLocationId: 1,
            targetQty: '1',
            unitCost: '1',
        }).success,
        false,
    );
});

test('draft patches preserve omission and null while locking the historical snapshot inputs', () => {
    assert.deepEqual(updatePackingOrderSchema.parse({ notes: null }), { notes: null });
    assert.deepEqual(updatePackingOrderSchema.parse({ scheduledDate: '' }), {
        scheduledDate: null,
    });
    assert.deepEqual(updatePackingOrderSchema.parse({ packingOrderNumber: ' pk-corrected ' }), {
        packingOrderNumber: 'PK-CORRECTED',
    });
    for (const body of [
        {},
        { notes: undefined },
        { itemId: 8 },
        { targetQty: '600' },
        { sourceLocationId: 3 },
        { status: 'Planned' },
    ])
        assert.equal(updatePackingOrderSchema.safeParse(body).success, false);
    for (const id of ['0', '-1', '1.5', '1e2', '2147483648', 'abc'])
        assert.equal(packingOrderIdRequestSchema.safeParse({ params: { id } }).success, false);
    assert.equal(
        packingOrderIdRequestSchema.parse({ params: { id: '2147483647' } }).params.id,
        2_147_483_647,
    );
    assert.equal(
        packingOrderActionRequestSchema.safeParse({ params: { id: '1' }, body: {} }).success,
        true,
    );
    assert.equal(
        packingOrderActionRequestSchema.safeParse({
            params: { id: '1' },
            body: { qtyReserved: '2' },
        }).success,
        false,
    );
});

test('completion normalizes lot numbers, allows undated output, and rejects impossible lot dates', () => {
    assert.deepEqual(
        completePackingOrderSchema.parse({
            actualQty: '400',
            lotNumber: ' fg-a-01 ',
            manufactureDate: '',
            expirationDate: null,
        }),
        {
            actualQty: '400',
            lotNumber: 'FG-A-01',
            manufactureDate: null,
            expirationDate: null,
        },
    );
    assert.equal(
        completePackingOrderSchema.safeParse({ actualQty: '1', lotNumber: 'FG' }).success,
        true,
    );
    for (const change of [
        { actualQty: '0' },
        { actualQty: '1.00001' },
        { lotNumber: '' },
        { lotNumber: 'X'.repeat(101) },
        { manufactureDate: '2026-02-30' },
        { manufactureDate: '2026-10-29', expirationDate: '2026-10-29' },
        { manufactureDate: '2026-10-29', expirationDate: '2026-10-28' },
        { unitCost: '1' },
        { qcStatus: 'Approved' },
        { consumedQty: '10' },
        { authorizedByUserId: 1 },
    ])
        assert.equal(
            completePackingOrderSchema.safeParse({ actualQty: '1', lotNumber: 'FG', ...change })
                .success,
            false,
        );
});

test('BOM requirements convert six-place recipes and eight-place factors into exact primary quantities', () => {
    assert.equal(packingRequirement('100.000000', '500', '1.00000000', '1000.00000000'), '50.0000');
    assert.equal(packingRequirement('1', '500.0000', '1', '1'), '500.0000');
    assert.equal(packingRequirement('0.000001', '100', '1', '1'), '0.0001');
    assert.equal(packingRequirement('1', '9999999999.9999', '1', '1'), '9999999999.9999');
    for (const args of [
        ['0.000001', '1', '1', '1'],
        ['1', '0.0001', '1', '3'],
        ['1', '9999999999.9999', '2', '1'],
        ['0', '500', '1', '1'],
        ['1', '500', '1', '0'],
    ] as const)
        assert.throws(() => packingRequirement(args[0], args[1], args[2], args[3]), {
            status: 400,
        });
});

test('actual output scales the historical requirements exactly and rejects overproduction or rounded consumption', () => {
    assert.equal(packingConsumption('50', '400', '500'), '40.0000');
    assert.equal(packingConsumption('500', '400.0000', '500'), '400.0000');
    assert.equal(packingConsumption('0.0001', '100', '100'), '0.0001');
    for (const args of [
        ['50', '501', '500'],
        ['50', '0', '500'],
        ['0.0001', '1', '100'],
    ] as const)
        assert.throws(() => packingConsumption(args[0], args[1], args[2]), { status: 400 });
});

test('maximum output respects the limiting stock and the common exact output increment', () => {
    assert.equal(packingMaximum('50', '0.1', '1'), '500.0000');
    assert.equal(packingMaximum('1', '0.3333', '1'), '3.0000');
    assert.equal(packingMaximum('-1.0000', '0.1', '1'), '0.0000');
    assert.equal(packingMaximum('0', '0.1', '1'), '0.0000');
    assert.equal(packingMaximum('100', '33.3333', '100'), '300.0000');
    assert.equal(packingOutputStep(['0.0004', '0.0006'], '1'), 5000n);
    assert.equal(packingOutputStep(['0.3333', '0.25'], '1'), 10000n);
    const target = packingMaximum('1', '0.3333', '1');
    assert.equal(packingConsumption('3.3330', target, '10'), '0.9999');
    assert.equal(packingRequirement('0.333300', target, '1', '1'), '0.9999');
});

test('lot allocation subtracts active outstanding reservations and never promises unavailable stock', () => {
    const candidates = [
        { lotId: 1, qtyOnHand: '10', qtyReserved: '11' },
        { lotId: 2, qtyOnHand: '10', qtyReserved: '3' },
        { lotId: 3, qtyOnHand: '5', qtyReserved: '1' },
    ];
    assert.deepEqual(allocatePackingMaterial('9', candidates), [
        { lotId: 2, qtyReserved: '7.0000' },
        { lotId: 3, qtyReserved: '2.0000' },
    ]);
    assert.throws(() => allocatePackingMaterial('11.0001', candidates), { status: 409 });
    assert.throws(() => allocatePackingMaterial('1', []), { status: 409 });
    assert.equal(candidates[1]!.qtyOnHand, '10');
});

test('packing policies require the supported state, usable location, and approved unexpired lots', () => {
    assert.doesNotThrow(() => assertPackingStatus('Planned', ['Planned']));
    assert.throws(() => assertPackingStatus('Completed', ['In Progress']), { status: 409 });
    for (const type of ['Warehouse', 'Packing'])
        assert.doesNotThrow(() => assertPackingLocation(type));
    for (const type of ['Quarantine', 'Scrap', 'Store', 'Branch', 'In Transit'])
        assert.throws(() => assertPackingLocation(type), { status: 400 });
    assert.doesNotThrow(() => assertPackingLot('Approved', null, '2026-10-29'));
    assert.doesNotThrow(() => assertPackingLot('Approved', '2026-10-30', '2026-10-29'));
    for (const status of ['Quarantine', 'Rejected', 'Expired'])
        assert.throws(() => assertPackingLot(status, null, '2026-10-29'), { status: 409 });
    for (const date of ['2026-10-28', '2026-10-29'])
        assert.throws(() => assertPackingLot('Approved', date, '2026-10-29'), { status: 409 });
});

test('finished cost uses consumed lot costs, half-up precision, unknown costs, and overflow protection', () => {
    assert.equal(
        packingUnitCost(
            [
                { qtyConsumed: '50', unitCost: '100' },
                { qtyConsumed: '500', unitCost: '1' },
            ],
            '500',
        ),
        '11.0000',
    );
    assert.equal(packingUnitCost([{ qtyConsumed: '1', unitCost: '0.0001' }], '2'), '0.0001');
    assert.equal(packingUnitCost([{ qtyConsumed: '1', unitCost: '0.0001' }], '3'), '0.0000');
    assert.equal(packingUnitCost([{ qtyConsumed: '1', unitCost: null }], '1'), null);
    assert.equal(packingUnitCost([{ qtyConsumed: '1', unitCost: '0' }], '1'), '0.0000');
    assert.throws(() => packingUnitCost([{ qtyConsumed: '2', unitCost: '9999999999.9999' }], '1'), {
        status: 400,
    });
});
