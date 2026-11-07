import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { getTableName, is, sql } from 'drizzle-orm';
import { isPgEnum, PgTable } from 'drizzle-orm/pg-core';
import type { db } from './index.ts';
import * as schema from './schema.ts';

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export class TestDatabaseError extends Error {}
export const applicationTables = Object.values(schema)
    .filter((value) => is(value, PgTable))
    .sort((a, b) => getTableName(a).localeCompare(getTableName(b)));
const applicationEnums = Object.values(schema).flatMap((value) =>
    isPgEnum(value) ? [value.enumName] : [],
);

export function requireTestDataOptIn(environment: NodeJS.ProcessEnv = process.env) {
    if (environment.KFF_ALLOW_TEST_DATA !== 'true') {
        throw new TestDatabaseError(
            'Test data is disabled. Use the test-data Windows launchers or set KFF_ALLOW_TEST_DATA=true for a dedicated test database.',
        );
    }
}

export function databaseTarget(connectionString: string | undefined) {
    if (!connectionString)
        throw new TestDatabaseError('Configure DATABASE_URL before using the database scripts.');
    const target = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
        throw new TestDatabaseError('DATABASE_URL must be a PostgreSQL connection string.');
    }
    // Deliberately omit credentials and query parameters from console output.
    return `${target.hostname}${target.port ? `:${target.port}` : ''}/${decodeURIComponent(target.pathname.slice(1))}`;
}

export async function lockTestDatabase(transaction: Transaction, schemaName = 'public') {
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schemaName))
        throw new TestDatabaseError('Invalid test schema name.');
    await transaction.execute(
        sql`select pg_advisory_xact_lock(1262896723, hashtext(${schemaName}))`,
    );
    await transaction.execute(sql`select set_config('search_path', ${schemaName}, true)`);
}

export function tableNames(schemaName: string) {
    return sql.join(
        applicationTables.map(
            (table) => sql`${sql.identifier(schemaName)}.${sql.identifier(getTableName(table))}`,
        ),
        sql`, `,
    );
}

export async function isApplicationDatabaseEmpty(transaction: Transaction, schemaName: string) {
    // Prevent application writes from racing the initial empty-database check.
    await transaction.execute(sql`lock table ${tableNames(schemaName)} in access exclusive mode`);
    const sources = applicationTables.map(
        (table) =>
            sql`select 1 from ${sql.identifier(schemaName)}.${sql.identifier(getTableName(table))}`,
    );
    const [result] = await transaction.execute<{ populated: boolean }>(
        sql`select exists (${sql.join(sources, sql` union all `)}) as populated`,
    );
    return !result!.populated;
}

/** Generate the current schema, rather than replaying obsolete migration snapshots. */
export async function exportApplicationSchema(backendDirectory = process.cwd()) {
    const { stdout } = await promisify(execFile)(
        process.execPath,
        [
            resolve(backendDirectory, 'node_modules/drizzle-kit/bin.cjs'),
            'export',
            '--dialect',
            'postgresql',
            '--schema',
            './src/db/schema.ts',
            '--sql',
        ],
        { cwd: backendDirectory, maxBuffer: 8 * 1024 * 1024 },
    );
    if (
        !stdout.trimStart().startsWith('CREATE TYPE') ||
        !stdout.includes('CREATE TABLE "inventory_stock"')
    ) {
        throw new TestDatabaseError(
            'Drizzle did not produce the application schema. No database changes were made.',
        );
    }
    return stdout;
}

export async function rebuildApplicationSchema(
    database: Database,
    ddl: string,
    schemaName = 'public',
    environment: NodeJS.ProcessEnv = process.env,
) {
    requireTestDataOptIn(environment);
    await database.transaction(async (transaction) => {
        await lockTestDatabase(transaction, schemaName);
        await transaction.execute(sql`set local lock_timeout = '10s'`);
        await transaction.execute(sql`set local client_min_messages = warning`);
        // Drop all related app tables together. External dependencies block the reset;
        // no CASCADE into Supabase/auth/storage or unrelated application objects.
        await transaction.execute(sql`drop table if exists ${tableNames(schemaName)}`);
        for (const enumName of applicationEnums) {
            await transaction.execute(
                sql`drop type if exists ${sql.identifier(schemaName)}.${sql.identifier(enumName)}`,
            );
        }
        await transaction.execute(sql.raw(ddl));
    });
}
