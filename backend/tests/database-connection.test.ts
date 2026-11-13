import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveDatabaseConfig } from '../src/db/connection.ts';

test('local PostgreSQL keeps SSL disabled and prepared statements enabled by default', () => {
    const resolved = resolveDatabaseConfig('postgresql://postgres:secret@localhost:5433/kff', {});
    assert.equal(resolved.options.ssl, false);
    assert.equal(resolved.options.prepare, true);
    assert.equal(resolved.options.max, 10);
});

test('Supabase transaction pooler enables SSL and disables prepared statements', () => {
    const resolved = resolveDatabaseConfig(
        'postgresql://postgres.abcd1234:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
        {},
    );
    assert.equal(resolved.options.ssl, 'require');
    assert.equal(resolved.options.prepare, false);
    assert.equal(new URL(resolved.url).searchParams.has('pgbouncer'), false);
});

test('Supabase direct host defaults to SSL and respects explicit sslmode/VERCEL overrides', () => {
    const direct = resolveDatabaseConfig(
        'postgresql://postgres:secret@db.abcd1234.supabase.co:5432/postgres',
        {},
    );
    assert.equal(direct.options.ssl, 'require');
    assert.equal(direct.options.prepare, true);

    const serverless = resolveDatabaseConfig(
        'postgresql://postgres:secret@db.abcd1234.supabase.co:5432/postgres',
        { VERCEL: '1' },
    );
    assert.equal(serverless.options.prepare, false);
    assert.equal(serverless.options.max, 1);

    const disabledSsl = resolveDatabaseConfig(
        'postgresql://postgres:secret@db.abcd1234.supabase.co:5432/postgres?sslmode=disable',
        {},
    );
    assert.equal(disabledSsl.options.ssl, false);
});

test('missing DATABASE_URL fails with a clear configuration error', () => {
    assert.throws(() => resolveDatabaseConfig('', {}), /DATABASE_URL/);
});

