import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { resolveDrizzleKitUrl } from './src/db/connection.ts';

export default defineConfig({
    out: './supabase/migrations',
    schema: './src/db/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url: resolveDrizzleKitUrl()!,
    },
    schemaFilter: ['public'],
});
