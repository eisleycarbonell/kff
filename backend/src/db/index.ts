import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import { createPostgresClient } from './connection.ts';

config({ path: '.env', quiet: true });

const globalForDb = globalThis as typeof globalThis & { __kffPgClient?: Sql };
const client = globalForDb.__kffPgClient ?? createPostgresClient(process.env.DATABASE_URL);
if (!globalForDb.__kffPgClient) {
    globalForDb.__kffPgClient = client;
}

export const db = drizzle({ client });
