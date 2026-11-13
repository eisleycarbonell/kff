import { config } from 'dotenv';
import { createPostgresClient } from './src/db/connection.ts';

config({ path: '.env', quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not configured.');

const sql = createPostgresClient(databaseUrl, { max: 1 });

try {
    await sql`select 1`;
    console.log('Database connection successful.');
} catch (error) {
    console.error(
        'Database connection failed:',
        error instanceof Error ? error.message : 'Unknown error',
    );
    process.exitCode = 1;
} finally {
    await sql.end();
}
