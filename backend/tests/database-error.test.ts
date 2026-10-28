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
    for (const code of [
        '08006',
        '08001',
        '53300',
        'CONNECT_TIMEOUT',
        'CONNECTION_CLOSED',
        'CONNECTION_ENDED',
        'CONNECTION_DESTROYED',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ECONNRESET',
        'ECONNABORTED',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'ENOTFOUND',
        'EAI_AGAIN',
        'EPIPE',
    ]) {
        const driverError = Object.assign(new Error('private database host and password'), {
            code,
            query: 'private SQL',
            parameters: ['password'],
        });
        const wrapped = new Error('Drizzle query failed', { cause: driverError });
        assert.equal(getDatabaseErrorCode(wrapped), code);
        const mapped = mapDatabaseError(wrapped);
        assert.equal(mapped?.status, 503);
        assert.equal(
            mapped?.message,
            'The database is temporarily unavailable. Please try again later.',
        );
        assert.equal(mapped?.details, undefined);
    }
});

test('recognizes aggregate connection errors with or without an outer code', () => {
    const socketError = Object.assign(new Error('private host'), { code: 'ECONNREFUSED' });
    for (const aggregate of [
        new AggregateError([null, new Error('unknown'), socketError], 'connect failed'),
        Object.assign(new AggregateError([socketError], 'connect failed'), {
            code: 'ETIMEDOUT',
        }),
        new AggregateError(
            [new Error('query failed', { cause: socketError })],
            'multiple connections failed',
        ),
    ]) {
        const wrapped = new Error('Drizzle query failed', { cause: aggregate });
        assert.equal(mapDatabaseError(wrapped)?.status, 503);
    }
});

test('cyclic aggregate errors still find connection errors and terminate safely', () => {
    const aggregate = new AggregateError([], 'connect failed');
    const wrapped = new Error('query failed', { cause: aggregate });
    aggregate.errors.push(wrapped, aggregate);
    assert.equal(getDatabaseErrorCode(wrapped), undefined);
    assert.equal(mapDatabaseError(wrapped), undefined);

    aggregate.errors.push(Object.assign(new Error('private host'), { code: 'CONNECT_TIMEOUT' }));
    assert.equal(getDatabaseErrorCode(wrapped), 'CONNECT_TIMEOUT');
    assert.equal(mapDatabaseError(wrapped)?.status, 503);
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
        { code: 'EACCES' },
        { code: 'ENOSPC' },
        { code: 'ENOENT' },
        new Error('file operation failed', { cause: { code: 'EACCES' } }),
        new AggregateError([{ code: 'ENOSPC' }, { code: 'ENOENT' }], 'file operations failed'),
    ]) {
        assert.equal(mapDatabaseError(error), undefined);
    }
});
