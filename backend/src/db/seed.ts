import { db } from './index.ts';
import { seedSampleData, SAMPLE_ADMIN_EMAIL, SAMPLE_PASSWORD } from './sample-data.ts';
import { sampleAccounts } from './sample-accounts.ts';
import { databaseTarget, requireTestDataOptIn, TestDatabaseError } from './test-database.ts';

try {
    if (process.argv.includes('--help')) {
        console.log('Load spice and pantry sample data into an EMPTY application database.');
        console.log(
            'Use load-sample-data.cmd, or set KFF_ALLOW_TEST_DATA=true and run npm run db:seed.',
        );
    } else {
        requireTestDataOptIn();
        console.log(`Sample data target: ${databaseTarget(process.env.DATABASE_URL)}`);
        const result = await seedSampleData();
        if (result.status === 'seeded') {
            console.log(
                'Sample data loaded. Stock balances and ledger history were committed together.',
            );
            console.log(`Administrator: ${SAMPLE_ADMIN_EMAIL} / ${SAMPLE_PASSWORD}`);
            console.log(
                `Other accounts: ${sampleAccounts
                    .filter((account) => account.email !== SAMPLE_ADMIN_EMAIL)
                    .map((account) => account.email)
                    .join(', ')} / ${SAMPLE_PASSWORD}`,
            );
        } else {
            console.log('Existing application data was preserved; no samples were added.');
            console.log(
                'For a fresh test database, run rebuild-test-database.cmd, then load-sample-data.cmd.',
            );
        }
    }
} catch (error) {
    console.error(
        error instanceof TestDatabaseError
            ? error.message
            : 'Sample loading failed and was rolled back. Check DATABASE_URL and apply the current schema with rebuild-test-database.cmd on your test database.',
    );
    process.exitCode = 1;
} finally {
    await db.$client.end({ timeout: 5 });
}
