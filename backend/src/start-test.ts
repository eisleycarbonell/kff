// Explicit launcher for a compiled application connected to a testing database.
process.env.KFF_ALLOW_TEST_DATA = 'true';
process.env.KFF_SAMPLE_DATA_ON_START = 'true';
await import('./index.ts');
