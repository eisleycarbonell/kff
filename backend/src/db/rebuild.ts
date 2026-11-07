import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { db } from './index.ts';
import {
    databaseTarget,
    exportApplicationSchema,
    rebuildApplicationSchema,
    requireTestDataOptIn,
    TestDatabaseError,
} from './test-database.ts';

try {
    if (process.argv.includes('--help')) {
        console.log(
            'Rebuild all KFF application tables, constraints, indexes, enums and identity sequences.',
        );
        console.log(
            'DELETES application data. Supabase auth/storage and unrelated tables are preserved.',
        );
        console.log(
            'Use rebuild-test-database.cmd. For automation: KFF_ALLOW_TEST_DATA=true npm run db:rebuild -- --yes',
        );
    } else {
        requireTestDataOptIn();
        console.log(`Database to rebuild: ${databaseTarget(process.env.DATABASE_URL)}`);
        console.log(
            'All KFF application records, including users and inventory history, will be deleted.',
        );
        console.log('Stop the backend before continuing.');
        if (!process.argv.includes('--yes')) {
            if (!stdin.isTTY)
                throw new TestDatabaseError(
                    'Interactive confirmation is required. Use --yes only for an automated test database.',
                );
            const prompt = createInterface({ input: stdin, output: stdout });
            try {
                if ((await prompt.question('Type REBUILD to continue: ')) !== 'REBUILD') {
                    throw new TestDatabaseError(
                        'Rebuild cancelled. No database changes were made.',
                    );
                }
            } finally {
                prompt.close();
            }
        }
        // Generate successfully before beginning any destructive work.
        const ddl = await exportApplicationSchema();
        await rebuildApplicationSchema(db, ddl);
        console.log('Application database rebuilt successfully from the current schema.');
        console.log(
            'Run load-sample-data.cmd to populate it, or start-test-backend.cmd for first-start seeding.',
        );
    }
} catch (error) {
    console.error(
        error instanceof TestDatabaseError
            ? error.message
            : 'Database rebuild failed. Database changes were rolled back. Check the connection, database permissions and external dependencies on KFF tables.',
    );
    process.exitCode = 1;
} finally {
    await db.$client.end({ timeout: 5 });
}
