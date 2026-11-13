import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    resolveDatabaseConfig,
    resolveDatabaseUrl,
    resolveDirectDatabaseUrl,
    resolveDrizzleKitUrl,
} from '../src/db/connection.ts';
import { isSupabaseConfigured, resolveSupabaseConfig } from '../src/db/supabase.ts';

test('local PostgreSQL keeps SSL disabled and prepared statements enabled by default', () => {
    const resolved = resolveDatabaseConfig('postgresql://postgres:secret@localhost:5433/kff', {});
    assert.equal(resolved.options.ssl, false);
    assert.equal(resolved.options.prepare, true);
    assert.equal(resolved.options.max, 10);
});

test('Supabase transaction pooler enables SSL and disables prepared statements', () => {
    const resolved = resolveDatabaseConfig(
        'postgresql://postgres.abcd1234:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&supa=base-pooler.x',
        {},
    );
    assert.equal(resolved.options.ssl, 'require');
    assert.equal(resolved.options.prepare, false);
    const params = new URL(resolved.url).searchParams;
    assert.equal(params.has('pgbouncer'), false);
    assert.equal(params.has('supa'), false);
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

test('Vercel Supabase integration PostgreSQL env vars resolve for runtime and migrations', () => {
    const env = {
        DATABASE_POSTGRES_PRISMA_URL:
            'postgresql://postgres.ref:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true',
        DATABASE_POSTGRES_URL_NON_POOLING:
            'postgresql://postgres.ref:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
    };
    assert.equal(resolveDatabaseUrl(env), env.DATABASE_POSTGRES_PRISMA_URL);
    assert.equal(resolveDirectDatabaseUrl(env), env.DATABASE_POSTGRES_URL_NON_POOLING);

    const resolved = resolveDatabaseConfig(undefined, env);
    assert.equal(resolved.options.prepare, false);
    assert.equal(resolved.options.ssl, 'require');

    const kitUrl = new URL(resolveDrizzleKitUrl(env)!);
    assert.equal(kitUrl.searchParams.get('sslmode'), 'require');
    assert.equal(kitUrl.searchParams.get('uselibpqcompat'), 'true');
});

test('Supabase JS client configuration supports standard and Vercel-prefixed env vars', () => {
    assert.equal(isSupabaseConfigured({}), false);

    const standard = resolveSupabaseConfig({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
    });
    assert.equal(standard.url, 'https://example.supabase.co');
    assert.equal(standard.key, 'anon-key');
    assert.equal(standard.isServiceRole, false);

    const vercelPrefixed = resolveSupabaseConfig({
        DATABASE_SUPABASE_URL: 'https://example.supabase.co',
        DATABASE_SUPABASE_ANON_KEY: 'anon-key',
        DATABASE_SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    });
    assert.equal(vercelPrefixed.key, 'service-key');
    assert.equal(vercelPrefixed.isServiceRole, true);
});

test('missing DATABASE_URL fails with a clear configuration error', () => {
    assert.throws(() => resolveDatabaseConfig('', {}), /DATABASE_URL/);
});
