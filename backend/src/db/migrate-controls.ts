import { readFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { createPostgresClient, resolveDirectDatabaseUrl } from './connection.ts';
config({ path: '.env', quiet: true });
const migrationUrl = resolveDirectDatabaseUrl();
if (!migrationUrl) throw new Error('Configure DIRECT_URL or DATABASE_URL first.');
const client = createPostgresClient(migrationUrl, { max: 1, onnotice: () => {} });
try {
    const result = await client.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(1262896723, 20261108)`;
        await tx`set local lock_timeout='10s'`;
        const [existing] = await tx`select to_regclass('public.review_requests') as controls`;
        if (existing!.controls) {
            const [complete] =
                await tx`select count(*)::int as n from information_schema.tables where table_schema='public' and table_name in ('company_settings','reorder_policies','review_requests','review_events','count_sessions','count_observations','inventory_disposals','qc_decisions','formula_revisions','formula_revision_materials')`;
            if (complete!.n !== 10)
                throw new Error(
                    'Controls migration is incomplete; inspect schema before continuing.',
                );
            const [columns] =
                await tx`select count(*)::int as n from information_schema.columns where table_schema='public' and ((table_name='inventory_transactions' and column_name in ('review_request_id','count_observation_id')) or (table_name='packing_orders' and column_name='formula_revision_id') or (table_name='bill_of_materials' and column_name='revision_id') or (table_name='scrap_reason_codes' and column_name='is_active'))`;
            if (columns!.n !== 5)
                throw new Error(
                    'Controls migration is missing provenance columns; inspect schema before continuing.',
                );
            return 'already applied';
        }
        const [before] = await tx`select count(*)::int as n from inventory_transactions`;
        await tx.unsafe(
            await readFile(
                new URL(
                    '../../supabase/migrations/20261108000000_inventory_controls/migration.sql',
                    import.meta.url,
                ),
                'utf8',
            ),
        );
        const [after] = await tx`select count(*)::int as n from inventory_transactions`;
        if (before!.n !== after!.n) throw new Error('Migration changed operational history.');
        return 'applied; ' + after!.n + ' existing ledger entries preserved';
    });
    console.log('Inventory controls migration ' + result + '.');
} finally {
    await client.end();
}
