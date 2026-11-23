import { readFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { createPostgresClient, resolveDirectDatabaseUrl } from './connection.ts';

config({ path: '.env', quiet: true });
const url = resolveDirectDatabaseUrl();
if (!url) throw new Error('Configure DIRECT_URL or DATABASE_URL first.');

const client = createPostgresClient(url, { max: 1, onnotice: () => {} });
try {
    const result = await client.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(1262896723, 20261120)`;
        await tx`set local lock_timeout='10s'`;
        await tx.unsafe(
            (
                await readFile(
                    new URL(
                        '../../supabase/migrations/20261120000000_performance_indexes/migration.sql',
                        import.meta.url,
                    ),
                    'utf8',
                )
            ).replace(/^\uFEFF/, ''),
        );
        return true;
    });
    if (result) console.log('Performance indexes migration applied.');
} finally {
    await client.end();
}
