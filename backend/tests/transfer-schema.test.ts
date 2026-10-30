import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createTransferSchema,
    updateTransferSchema,
    dispatchTransferSchema,
    receiveTransferSchema,
    transferIdRequestSchema,
    transferActionRequestSchema,
} from '../src/modules/transfers/transfer.schema.ts';

const draft = {
    transferNumber: ' tr-2026-001 ',
    sourceLocationId: 1,
    destinationLocationId: 2,
    lines: [{ itemId: 3, lotId: 4, qtyRequested: ' 200.0000 ' }],
};

test('transfer drafts normalize metadata and preserve exact primary-UOM quantities', () => {
    assert.deepEqual(createTransferSchema.parse({ ...draft, notes: '  Branch delivery  ' }), {
        ...draft,
        transferNumber: 'TR-2026-001',
        notes: 'Branch delivery',
        lines: [{ itemId: 3, lotId: 4, qtyRequested: '200.0000' }],
    });
    assert.equal(createTransferSchema.parse({ ...draft, notes: '' }).notes, null);
    assert.equal(createTransferSchema.parse({ ...draft, notes: null }).notes, null);
    assert.equal(createTransferSchema.parse(draft).notes, undefined);
    for (const qtyRequested of ['0.0001', '9999999999.9999'])
        assert.equal(
            createTransferSchema.parse({
                ...draft,
                lines: [{ itemId: 3, lotId: 4, qtyRequested }],
            }).lines[0]!.qtyRequested,
            qtyRequested,
        );
});

test('transfer drafts reject malformed identifiers, state writes, actor spoofing and lossy quantities', () => {
    for (const change of [
        { transferNumber: '' },
        { transferNumber: 'X'.repeat(31) },
        { sourceLocationId: 0 },
        { destinationLocationId: 2_147_483_648 },
        { destinationLocationId: '2' },
        { notes: 'X'.repeat(5001) },
        { transferId: 1 },
        { status: 'Completed' },
        { requestedAt: '2026-10-30T00:00:00Z' },
        { dispatchedAt: null },
        { createdBy: 9 },
        { updatedBy: 9 },
        { qtyOnHand: '200' },
        { transitLocationId: 3 },
        { lines: [] },
        {
            lines: Array.from({ length: 101 }, (_, index) => ({
                itemId: 3,
                lotId: index + 1,
                qtyRequested: '1',
            })),
        },
        {
            lines: [
                { itemId: 3, lotId: 4, qtyRequested: '1' },
                { itemId: 3, lotId: 4, qtyRequested: '2' },
            ],
        },
    ])
        assert.equal(createTransferSchema.safeParse({ ...draft, ...change }).success, false);
    for (const qtyRequested of ['0', '0.0000', '-1', '1e3', '1.00001', '10000000000', 200])
        assert.equal(
            createTransferSchema.safeParse({
                ...draft,
                lines: [{ itemId: 3, lotId: 4, qtyRequested }],
            }).success,
            false,
        );
    for (const change of [
        { itemId: 0 },
        { lotId: 0 },
        { lotId: 2_147_483_648 },
        { transferLineId: 1 },
        { qtyShipped: '1' },
        { qtyReceived: '1' },
        { authorizedByUserId: 1 },
    ])
        assert.equal(
            createTransferSchema.safeParse({
                ...draft,
                lines: [{ itemId: 3, lotId: 4, qtyRequested: '1', ...change }],
            }).success,
            false,
        );
});

test('transfer patches distinguish omission and null, allow line replacement, and reject empty updates', () => {
    assert.deepEqual(updateTransferSchema.parse({ notes: null }), { notes: null });
    assert.deepEqual(updateTransferSchema.parse({ notes: '  ' }), { notes: null });
    assert.deepEqual(updateTransferSchema.parse({ transferNumber: ' tr-corrected ' }), {
        transferNumber: 'TR-CORRECTED',
    });
    assert.deepEqual(updateTransferSchema.parse({ sourceLocationId: 3 }), { sourceLocationId: 3 });
    assert.deepEqual(
        updateTransferSchema.parse({ lines: [{ itemId: 3, lotId: 5, qtyRequested: '1' }] }),
        {
            lines: [{ itemId: 3, lotId: 5, qtyRequested: '1' }],
        },
    );
    for (const body of [
        {},
        { notes: undefined },
        { lines: [] },
        { status: 'Cancelled' },
        { createdBy: 5 },
    ])
        assert.equal(updateTransferSchema.safeParse(body).success, false);
});

test('dispatch and receipt require unique positive exact line quantities without accepting cumulative state or actors', () => {
    assert.deepEqual(
        dispatchTransferSchema.parse({
            transitLocationId: 3,
            lines: [{ transferLineId: 5, qtyShipped: ' 100.0001 ' }],
        }),
        {
            transitLocationId: 3,
            lines: [{ transferLineId: 5, qtyShipped: '100.0001' }],
        },
    );
    assert.deepEqual(
        receiveTransferSchema.parse({ lines: [{ transferLineId: 5, qtyReceived: '50' }] }),
        {
            lines: [{ transferLineId: 5, qtyReceived: '50' }],
        },
    );
    for (const [schema, quantityField, extra] of [
        [dispatchTransferSchema, 'qtyShipped', { transitLocationId: 3 }],
        [receiveTransferSchema, 'qtyReceived', {}],
    ] as const) {
        for (const value of ['0', '-1', '1e3', '0.00001', '10000000000', 100])
            assert.equal(
                schema.safeParse({
                    ...extra,
                    lines: [{ transferLineId: 5, [quantityField]: value }],
                }).success,
                false,
            );
        for (const lines of [
            [],
            [{ transferLineId: 0, [quantityField]: '1' }],
            [
                { transferLineId: 5, [quantityField]: '1' },
                { transferLineId: 5, [quantityField]: '2' },
            ],
            [{ transferLineId: 5, [quantityField]: '1', authorizedByUserId: 2 }],
        ])
            assert.equal(schema.safeParse({ ...extra, lines }).success, false);
        assert.equal(
            schema.safeParse({
                ...extra,
                lines: [{ transferLineId: 5, [quantityField]: '1' }],
                updatedBy: 2,
            }).success,
            false,
        );
    }
    assert.equal(
        dispatchTransferSchema.safeParse({
            transitLocationId: 0,
            lines: [{ transferLineId: 5, qtyShipped: '1' }],
        }).success,
        false,
    );
    assert.equal(
        receiveTransferSchema.safeParse({
            transitLocationId: 4,
            lines: [{ transferLineId: 5, qtyReceived: '1' }],
        }).success,
        false,
    );
});

test('transfer route IDs enforce PostgreSQL integer bounds and cancellation rejects writable state', () => {
    for (const id of ['0', '-1', '1.5', '1e2', '2147483648', 'abc'])
        assert.equal(transferIdRequestSchema.safeParse({ params: { id } }).success, false);
    assert.equal(
        transferIdRequestSchema.parse({ params: { id: '2147483647' } }).params.id,
        2_147_483_647,
    );
    assert.equal(
        transferActionRequestSchema.safeParse({ params: { id: '1' }, body: {} }).success,
        true,
    );
    assert.equal(
        transferActionRequestSchema.safeParse({
            params: { id: '1' },
            body: { status: 'Cancelled' },
        }).success,
        false,
    );
});
