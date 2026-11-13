import postgres, { type Options, type Sql } from 'postgres';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const RUNTIME_URL_KEYS = [
    'DATABASE_URL',
    'POSTGRES_PRISMA_URL',
    'DATABASE_POSTGRES_PRISMA_URL',
    'POSTGRES_URL',
    'DATABASE_POSTGRES_URL',
    'DIRECT_URL',
    'POSTGRES_URL_NON_POOLING',
    'DATABASE_POSTGRES_URL_NON_POOLING',
] as const;

const DIRECT_URL_KEYS = [
    'DIRECT_URL',
    'POSTGRES_URL_NON_POOLING',
    'DATABASE_POSTGRES_URL_NON_POOLING',
] as const;

function firstNonEmptyEnv(
    environment: NodeJS.ProcessEnv,
    keys: readonly string[],
): string | undefined {
    for (const key of keys) {
        const value = environment[key]?.trim();
        if (value) return value;
    }
    return undefined;
}

export function resolveDatabaseUrl(
    environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
    return firstNonEmptyEnv(environment, RUNTIME_URL_KEYS);
}

export function resolveDirectDatabaseUrl(
    environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
    return firstNonEmptyEnv(environment, DIRECT_URL_KEYS) ?? resolveDatabaseUrl(environment);
}

/** Format a direct PostgreSQL URL for pg/drizzle-kit CLI tools (avoiding self-signed cert failures on Supabase). */
export function resolveDrizzleKitUrl(
    environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
    const raw = resolveDirectDatabaseUrl(environment);
    if (!raw) return undefined;

    const parsed = new URL(raw);
    const isLocal = !parsed.hostname || isLocalHostname(parsed.hostname) || raw.startsWith('/');
    parsed.searchParams.delete('pgbouncer');
    parsed.searchParams.delete('supa');

    if (!isLocal) {
        const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
        if (sslMode !== 'disable' && sslMode !== 'verify-full') {
            parsed.searchParams.set('sslmode', 'require');
            if (!parsed.searchParams.has('uselibpqcompat')) {
                parsed.searchParams.set('uselibpqcompat', 'true');
            }
        }
    }

    return parsed.toString();
}

function isLocalHostname(hostname: string) {
    return LOCAL_HOSTS.has(hostname.toLowerCase());
}

function isSupabaseHostname(hostname: string) {
    const normalized = hostname.toLowerCase();
    return normalized.endsWith('.supabase.co') || normalized.endsWith('.supabase.com');
}

function parseSslSetting(
    raw: string | null | undefined,
): Options<Record<string, never>>['ssl'] | undefined {
    if (!raw) return undefined;
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'disable' || normalized === 'false') return false;
    if (
        normalized === 'require' ||
        normalized === 'allow' ||
        normalized === 'prefer' ||
        normalized === 'verify-full' ||
        normalized === 'true'
    ) {
        return normalized === 'true' ? 'require' : normalized;
    }
    return undefined;
}

function parsePositiveInt(raw: string | undefined): number | undefined {
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/** Resolve postgres.js connection options for local PostgreSQL, Supabase poolers, and serverless runtimes. */
export function resolveDatabaseConfig(
    connectionString?: string,
    environment: NodeJS.ProcessEnv = process.env,
    overrides: Options<Record<string, never>> = {},
): { url: string; options: Options<Record<string, never>> } {
    const trimmed = connectionString?.trim() || resolveDatabaseUrl(environment);
    if (!trimmed) {
        throw new Error(
            'Configure DATABASE_URL (or POSTGRES_URL / DATABASE_POSTGRES_URL) before connecting to PostgreSQL.',
        );
    }

    const parsed = new URL(trimmed);
    const hostname = parsed.hostname;
    const isLocal = !hostname || isLocalHostname(hostname) || trimmed.startsWith('/');
    const isSupabase = isSupabaseHostname(hostname);
    const isSupabasePooler = hostname.toLowerCase().endsWith('.pooler.supabase.com');
    const isTransactionPooler =
        parsed.port === '6543' || parsed.searchParams.get('pgbouncer') === 'true';
    const isServerless = Boolean(environment.VERCEL || environment.AWS_LAMBDA_FUNCTION_NAME);

    // Strip provider-specific pooling params so postgres.js does not forward them as PostgreSQL GUCs.
    parsed.searchParams.delete('pgbouncer');
    parsed.searchParams.delete('supa');

    const envSsl = parseSslSetting(environment.DB_SSL);
    const querySsl =
        parseSslSetting(parsed.searchParams.get('sslmode')) ??
        parseSslSetting(parsed.searchParams.get('ssl'));
    const defaultSsl = isLocal ? false : 'require';

    const queryPrepare = parsed.searchParams.get('prepare');
    const disablePrepared =
        environment.DB_PREPARE === 'false' ||
        queryPrepare === 'false' ||
        isTransactionPooler ||
        isSupabasePooler ||
        isServerless;

    const max = parsePositiveInt(environment.DB_POOL_MAX) ?? (isServerless ? 1 : 10);

    const options: Options<Record<string, never>> = {
        max,
        idle_timeout: 20,
        connect_timeout: isSupabase ? 15 : 30,
        max_lifetime: 60 * 30,
        ssl: envSsl ?? querySsl ?? defaultSsl,
        prepare: disablePrepared ? false : true,
        ...overrides,
    };

    return {
        url: parsed.toString(),
        options,
    };
}

export function createPostgresClient(
    connectionString?: string,
    overrides: Options<Record<string, never>> = {},
    environment: NodeJS.ProcessEnv = process.env,
): Sql {
    const { url, options } = resolveDatabaseConfig(connectionString, environment, overrides);
    return postgres(url, options);
}
