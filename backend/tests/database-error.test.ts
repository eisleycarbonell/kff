import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getDatabaseErrorCode, mapDatabaseError } from '../src/errors/database-error.ts';

test('extracts postgres.js and pg codes through nested Drizzle causes', () => {
    const driverError = Object.assign(new Error('duplicate key with private data'), {
        code: '23505',
    });
    const wrapped = Object.assign(new Error('query failed', { cause: driverError }), {
        code: 'ERR_QUERY',
    });
    const outer = new Error('transaction failed', { cause: wrapped });
    assert.equal(getDatabaseErrorCode(outer), '23505');
    assert.equal(mapDatabaseError(outer)?.status, 409);
});

test('database constraints have resource-independent HTTP errors without driver details', () => {
    for (const [code, status] of [
        ['23505', 409],
        ['23503', 400],
        ['23502', 400],
        ['23514', 400],
        ['22P02', 400],
        ['22001', 400],
        ['22003', 400],
        ['23001', 409],
        ['23P01', 409],
    ] as const) {
        const mapped = mapDatabaseError({
            code,
            detail: 'secret',
            query: 'private SQL',
            parameters: ['password'],
        });
        assert.equal(mapped?.status, status);
        assert.equal(mapped?.details, undefined);
        assert.doesNotMatch(mapped?.message ?? '', /secret|private SQL|password|user/i);
    }
});

test('connection failures and capacity errors become temporary service failures', () => {
    for (const code of ['08006', '08001', '53300']) {
        assert.equal(mapDatabaseError({ code })?.status, 503);
    }
});

test('unknown and cyclic errors terminate safely and remain unclassified', () => {
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    for (const error of [
        null,
        undefined,
        'failure',
        new Error('unknown'),
        cyclic,
        { code: '42P01' },
    ]) {
        assert.equal(mapDatabaseError(error), undefined);
    }
});
