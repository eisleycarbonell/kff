import { readFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { createPostgresClient, resolveDirectDatabaseUrl } from './connection.ts';
config({ path: '.env', quiet: true });
const url = resolveDirectDatabaseUrl();
if (!url) throw new Error('Configure DIRECT_URL or DATABASE_URL first.');
const client = createPostgresClient(url, { max: 1, onnotice: () => {} });
try {
    const result = await client.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(1262896723, 20261114)`;
        await tx`set local lock_timeout='10s'`;
        const [before] = await tx`select count(*)::int as n from inventory_transactions`;
        await tx.unsafe(
            (
                await readFile(
                    new URL(
                        '../../supabase/migrations/20261114000000_customer_planning_labels/migration.sql',
                        import.meta.url,
                    ),
                    'utf8',
                )
            ).replace(/^\uFEFF/, ''),
        );
        const [after] = await tx`select count(*)::int as n from inventory_transactions`;
        if (before!.n !== after!.n) throw new Error('Migration changed operational history.');
        return after!.n;
    });
    console.log(
        'Customer planning and labels migration applied; ' +
            result +
            ' existing ledger entries preserved.',
    );
} finally {
    await client.end();
}
