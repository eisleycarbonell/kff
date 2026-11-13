import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createPurchaseOrderSchema,
    updatePurchaseOrderSchema,
    purchaseOrderActionRequestSchema,
    purchaseOrderIdRequestSchema,
    purchaseOrderNumberRequestSchema,
} from '../src/modules/purchase-orders/purchase-order.schema.ts';
import {
    decimal4Units,
    purchaseOrderAmounts,
    purchaseOrderLineAmounts,
    assertDeliveryDate,
    assertDraftEditable,
    assertPurchaseOrderAction,
    assertActiveSupplier,
    assertPurchaseOrderLineDefinitions,
    assertSupplierMaterials,
    generatedPurchaseOrderNumber,
} from '../src/modules/purchase-orders/purchase-order.rules.ts';

const line = { itemId: 1, uomId: 1, qtyOrdered: '100.0000', unitPrice: '110.0000' };
const input = {
    supplierId: 1,
    orderDate: '2026-10-28T00:00:00Z',
    lines: [line],
};

test('purchase order creation normalizes nullable fields and protects server-managed data', () => {
    const parsed = createPurchaseOrderSchema.parse({
        ...input,
        notes: '  purchasing notes  ',
        expectedDeliveryDate: '',
    });
    assert.equal('poNumber' in parsed, false);
    assert.equal(parsed.notes, 'purchasing notes');
    assert.equal(parsed.expectedDeliveryDate, null);
    assert.equal('status' in parsed, false);
    for (const extra of [
        { status: 'Completed' },
        { poId: 1 },
        { createdBy: 1 },
        { updatedAt: '2026-10-28' },
        { qtyReceived: '1' },
    ]) {
        assert.equal(createPurchaseOrderSchema.safeParse({ ...input, ...extra }).success, false);
    }
    for (const change of [
        { poNumber: 'x'.repeat(31) },
        { supplierId: 0 },
        { notes: 'x'.repeat(5001) },
        { orderDate: 'invalid', expectedDeliveryDate: '2026-10-28' },
        { orderDate: '2026-02-30T00:00:00Z' },
        { expectedDeliveryDate: '2026-02-30' },
    ]) {
        assert.equal(createPurchaseOrderSchema.safeParse({ ...input, ...change }).success, false);
    }
});

test('PO creation accepts an optional normalized custom reference and blank requests use automatic numbering', () => {
    for (const poNumber of ['', '   ', '\t\n'])
        assert.equal(createPurchaseOrderSchema.parse({ ...input, poNumber }).poNumber, undefined);
    assert.equal(createPurchaseOrderSchema.parse(input).poNumber, undefined);
    assert.equal(
        createPurchaseOrderSchema.parse({ ...input, poNumber: '\t\u00a0External-42\ufeff\t' })
            .poNumber,
        'EXTERNAL-42',
    );
    assert.equal(
        createPurchaseOrderSchema.parse({ ...input, poNumber: '  external / po_ref-42  ' })
            .poNumber,
        'EXTERNAL / PO_REF-42',
    );
    assert.equal(
        createPurchaseOrderSchema.parse({ ...input, poNumber: 'x'.repeat(30) }).poNumber,
        'X'.repeat(30),
    );
    for (const poNumber of [null, false, 123, 'x'.repeat(31)])
        assert.equal(createPurchaseOrderSchema.safeParse({ ...input, poNumber }).success, false);
    assert.equal(
        updatePurchaseOrderSchema.safeParse({ poNumber: 'MANUAL-NEW', notes: 'Attempt renumber' })
            .success,
        false,
    );
});

test('purchase lines require positive exact quantities, nonnegative exact prices, and immutable server-owned fields', () => {
    assert.equal(
        createPurchaseOrderSchema.parse({
            ...input,
            lines: [{ ...line, qtyOrdered: '0.0001', unitPrice: '0' }],
        }).lines[0]!.qtyOrdered,
        '0.0001',
    );
    for (const change of [
        { qtyOrdered: '0' },
        { qtyOrdered: '000.0000' },
        { qtyOrdered: '-1' },
        { qtyOrdered: 1 },
        { qtyOrdered: '1e2' },
        { qtyOrdered: '10000000000' },
        { unitPrice: '-1' },
        { unitPrice: 1.2 },
        { unitPrice: '1.12345' },
        { uomId: 0 },
        { poLineId: 7 },
        { poId: 7 },
        { qtyReceived: '1' },
        { createdBy: 7 },
    ]) {
        assert.equal(
            createPurchaseOrderSchema.safeParse({ ...input, lines: [{ ...line, ...change }] })
                .success,
            false,
        );
    }
});

test('purchase orders require 1 to 100 lines and reject duplicate item/unit pairs while allowing different units', () => {
    assert.equal(createPurchaseOrderSchema.safeParse({ ...input, lines: [] }).success, false);
    assert.equal(
        createPurchaseOrderSchema.safeParse({ ...input, lines: [line, { ...line }] }).success,
        false,
    );
    assert.equal(
        createPurchaseOrderSchema.safeParse({ ...input, lines: [line, { ...line, uomId: 2 }] })
            .success,
        true,
    );
    assert.equal(
        createPurchaseOrderSchema.safeParse({
            ...input,
            lines: Array.from({ length: 101 }, (_, index) => ({ ...line, itemId: index + 1 })),
        }).success,
        false,
    );
});

test('partial purchase-order edits preserve omission and explicit nulls and reject empty writes', () => {
    assert.deepEqual(updatePurchaseOrderSchema.parse({ notes: null, expectedDeliveryDate: null }), {
        notes: null,
        expectedDeliveryDate: null,
    });
    assert.equal(updatePurchaseOrderSchema.safeParse({ poNumber: 'PO-NEW' }).success, false);
    assert.equal(updatePurchaseOrderSchema.safeParse({}).success, false);
    assert.equal(updatePurchaseOrderSchema.safeParse({ notes: undefined }).success, false);
    assert.equal(updatePurchaseOrderSchema.safeParse({ lines: [] }).success, false);
    assert.equal(updatePurchaseOrderSchema.safeParse({ status: 'Sent' }).success, false);
});

test('delivery dates compare against the UTC order day, including merged partial updates', () => {
    const offsetDate = '2026-10-28T01:00:00+08:00';
    assert.equal(
        createPurchaseOrderSchema.safeParse({
            ...input,
            orderDate: offsetDate,
            expectedDeliveryDate: '2026-10-27',
        }).success,
        true,
    );
    assert.equal(
        createPurchaseOrderSchema.safeParse({
            ...input,
            orderDate: offsetDate,
            expectedDeliveryDate: '2026-10-26',
        }).success,
        false,
    );
    assert.throws(() => assertDeliveryDate(new Date('2026-10-28T00:00:00Z'), '2026-10-27'), {
        status: 400,
    });
    assert.doesNotThrow(() => assertDeliveryDate(offsetDate, '2026-10-27'));
    assert.doesNotThrow(() => assertDeliveryDate(offsetDate, null));
});

test('number allocation accepts only an explicit empty JSON object', () => {
    assert.deepEqual(purchaseOrderNumberRequestSchema.parse({ body: {} }), { body: {} });
    for (const body of [undefined, null, [], false, '', { poNumber: 'PO-42' }, { supplierId: 1 }])
        assert.equal(purchaseOrderNumberRequestSchema.safeParse({ body }).success, false);
});

test('lifecycle requests require strict empty bodies and positive decimal PostgreSQL IDs', () => {
    assert.deepEqual(purchaseOrderActionRequestSchema.parse({ params: { id: '17' }, body: {} }), {
        params: { id: 17 },
        body: {},
    });
    for (const body of [undefined, null, { status: 'Sent' }, { updatedBy: 7 }])
        assert.equal(
            purchaseOrderActionRequestSchema.safeParse({ params: { id: '1' }, body }).success,
            false,
        );
    for (const id of ['0', '-1', '1e2', '0x10', '1.2', '2147483648', 'NaN'])
        assert.equal(purchaseOrderIdRequestSchema.safeParse({ params: { id } }).success, false);
});

test('purchase amounts retain all eight product decimals and remain exact beyond JavaScript safe integers', () => {
    assert.deepEqual(
        purchaseOrderAmounts([
            { qtyOrdered: '100.0000', qtyReceived: '60.0000', unitPrice: '110.0000' },
        ]),
        {
            totalAmount: '11000.00000000',
            receivedAmount: '6600.00000000',
            outstandingAmount: '4400.00000000',
        },
    );
    assert.deepEqual(
        purchaseOrderLineAmounts({ qtyOrdered: '0.0001', qtyReceived: '0', unitPrice: '0.0001' }),
        { qtyRemaining: '0.0001', lineTotal: '0.00000001' },
    );
    const maximum = {
        qtyOrdered: '9999999999.9999',
        qtyReceived: '0',
        unitPrice: '9999999999.9999',
    };
    assert.equal(purchaseOrderAmounts([maximum]).totalAmount, '99999999999998000000.00000001');
    assert.equal(
        purchaseOrderAmounts(Array.from({ length: 100 }, () => maximum)).totalAmount,
        '9999999999999800000000.00000100',
    );
    assert.deepEqual(purchaseOrderAmounts([]), {
        totalAmount: '0.00000000',
        receivedAmount: '0.00000000',
        outstandingAmount: '0.00000000',
    });
    for (const invalid of ['-1', '1e2', '10000000000', '0.00001'])
        assert.throws(() => decimal4Units(invalid), { status: 400 });
});

test('draft edits and lifecycle transitions reject received or referenced historical orders', () => {
    assert.doesNotThrow(() => assertDraftEditable({ status: 'Draft', hasReceipts: false }));
    for (const status of ['Sent', 'Partially Received', 'Completed', 'Cancelled'])
        assert.throws(() => assertDraftEditable({ status, hasReceipts: false }), { status: 409 });
    assert.throws(() => assertDraftEditable({ status: 'Draft', hasReceipts: true }), {
        status: 409,
    });
    assert.doesNotThrow(() =>
        assertPurchaseOrderAction({ status: 'Draft', hasReceipts: false }, 'send'),
    );
    for (const status of ['Draft', 'Sent'])
        assert.doesNotThrow(() =>
            assertPurchaseOrderAction({ status, hasReceipts: false }, 'cancel'),
        );
    for (const status of ['Sent', 'Partially Received', 'Completed', 'Cancelled'])
        assert.throws(() => assertPurchaseOrderAction({ status, hasReceipts: false }, 'send'), {
            status: 409,
        });
    for (const status of ['Partially Received', 'Completed', 'Cancelled'])
        assert.throws(() => assertPurchaseOrderAction({ status, hasReceipts: false }, 'cancel'), {
            status: 409,
        });
    for (const action of ['send', 'cancel'] as const)
        assert.throws(
            () => assertPurchaseOrderAction({ status: 'Draft', hasReceipts: true }, action),
            { status: 409 },
        );
});

test('purchase material definitions require active materials and compatible units', () => {
    const materials = [
        { itemId: 1, isActive: true, itemType: 'Raw Material - Bulk', primaryUomId: 1 },
    ];
    const units = [
        { uomId: 1, uomClassId: 1 },
        { uomId: 2, uomClassId: 1 },
        { uomId: 3, uomClassId: 2 },
    ];
    assert.doesNotThrow(() =>
        assertPurchaseOrderLineDefinitions([{ itemId: 1, uomId: 2 }], materials, units),
    );
    for (const lines of [
        [],
        [{ itemId: 1, uomId: 3 }],
        [{ itemId: 9, uomId: 1 }],
        [
            { itemId: 1, uomId: 1 },
            { itemId: 1, uomId: 1 },
        ],
    ])
        assert.throws(() => assertPurchaseOrderLineDefinitions(lines, materials, units), {
            status: 400,
        });
    assert.throws(
        () =>
            assertPurchaseOrderLineDefinitions(
                [line],
                [{ ...materials[0]!, isActive: false }],
                units,
            ),
        { status: 400 },
    );
    assert.throws(
        () =>
            assertPurchaseOrderLineDefinitions(
                [line],
                [{ ...materials[0]!, itemType: 'Finished Good' }],
                units,
            ),
        { status: 400 },
    );
    assert.throws(() => assertActiveSupplier(undefined), { status: 400 });
    assert.throws(() => assertActiveSupplier({ isActive: false }), { status: 409 });
    assert.doesNotThrow(() => assertActiveSupplier({ isActive: true }));
});

test('supplier material links must be active and belong to the selected supplier', () => {
    const lines = [{ itemId: 1 }, { itemId: 2 }];
    const offers = [
        { supplierId: 7, itemId: 1, isActive: true },
        { supplierId: 7, itemId: 2, isActive: true },
    ];
    assert.doesNotThrow(() => assertSupplierMaterials(lines, 7, offers));
    assert.doesNotThrow(() =>
        assertSupplierMaterials(lines, 7, [
            ...offers,
            { supplierId: 8, itemId: 1, isActive: true },
        ]),
    );
    for (const changed of [
        [],
        offers.slice(0, 1),
        offers.map((offer) => ({ ...offer, supplierId: 8 })),
        offers.map((offer) => ({ ...offer, isActive: false })),
    ])
        assert.throws(() => assertSupplierMaterials(lines, 7, changed), { status: 409 });
});
test('generated PO references use UTC creation year and stable padded identities', () => {
    const created = new Date('2026-12-31T23:30:00Z');
    assert.equal(generatedPurchaseOrderNumber(1, created), 'PO-2026-0001');
    assert.equal(generatedPurchaseOrderNumber(12345, created), 'PO-2026-12345');
    assert.equal(
        generatedPurchaseOrderNumber(2, new Date('2027-01-01T00:30:00+08:00')),
        'PO-2026-0002',
    );
    for (const id of [0, -1, 1.5, 2147483648])
        assert.throws(() => generatedPurchaseOrderNumber(id, created));
});
