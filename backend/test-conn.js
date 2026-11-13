import { config } from 'dotenv';
import { createPostgresClient, resolveDatabaseUrl } from './src/db/connection.ts';
import { createSupabaseClient, isSupabaseConfigured } from './src/db/supabase.ts';

config({ path: '.env', quiet: true });

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
    throw new Error('Configure DATABASE_URL (or POSTGRES_URL / DATABASE_POSTGRES_URL) first.');
}

const sql = createPostgresClient(databaseUrl, { max: 1 });

try {
    await sql`select 1`;
    console.log('PostgreSQL connection successful.');

    if (isSupabaseConfigured()) {
        const supabase = createSupabaseClient();
        const { error } = await supabase.from('roles').select('role_id').limit(1);
        if (error) {
            console.warn('Supabase JS client reached Supabase, query returned:', error.message);
        } else {
            console.log('Supabase JS client connection successful.');
        }
    }
} catch (error) {
    console.error(
        'Database connection failed:',
        error instanceof Error ? error.message : 'Unknown error',
    );
    process.exitCode = 1;
} finally {
    await sql.end();
}
