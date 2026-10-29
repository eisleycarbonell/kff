import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not configured.');

const sql = postgres(databaseUrl);

try {
    await sql`select 1`;
    console.log('Database connection successful.');
} catch {
    console.error('Database connection failed.');
    process.exitCode = 1;
} finally {
    await sql.end();
}
