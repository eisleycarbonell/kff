import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

config({ path: '.env', quiet: true });

const URL_KEYS = ['SUPABASE_URL', 'DATABASE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const;

const ADMIN_KEY_KEYS = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
    'DATABASE_SUPABASE_SECRET_KEY',
] as const;

const PUBLIC_KEY_KEYS = [
    'SUPABASE_ANON_KEY',
    'DATABASE_SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'DATABASE_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
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

export function resolveSupabaseConfig(
    environment: NodeJS.ProcessEnv = process.env,
    preferServiceRole = true,
): { url: string; key: string; isServiceRole: boolean } {
    const url = firstNonEmptyEnv(environment, URL_KEYS);
    if (!url) {
        throw new Error(
            'Configure SUPABASE_URL (or DATABASE_SUPABASE_URL) before using the Supabase client.',
        );
    }

    const adminKey = preferServiceRole ? firstNonEmptyEnv(environment, ADMIN_KEY_KEYS) : undefined;
    const publicKey = firstNonEmptyEnv(environment, PUBLIC_KEY_KEYS);
    const key = adminKey ?? publicKey;

    if (!key) {
        throw new Error(
            'Configure SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY before using the Supabase client.',
        );
    }

    return {
        url,
        key,
        isServiceRole: Boolean(adminKey),
    };
}

export function isSupabaseConfigured(environment: NodeJS.ProcessEnv = process.env): boolean {
    return Boolean(
        firstNonEmptyEnv(environment, URL_KEYS) &&
        (firstNonEmptyEnv(environment, ADMIN_KEY_KEYS) ||
            firstNonEmptyEnv(environment, PUBLIC_KEY_KEYS)),
    );
}

export function createSupabaseClient(
    options: {
        url?: string;
        key?: string;
        preferServiceRole?: boolean;
        environment?: NodeJS.ProcessEnv;
    } = {},
): SupabaseClient {
    const env = options.environment ?? process.env;
    const resolved =
        options.url && options.key
            ? { url: options.url, key: options.key }
            : resolveSupabaseConfig(env, options.preferServiceRole ?? true);

    return createClient(resolved.url, resolved.key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

const globalForSupabase = globalThis as typeof globalThis & {
    __kffSupabaseClient?: SupabaseClient;
};

export function getSupabaseClient(): SupabaseClient {
    if (!globalForSupabase.__kffSupabaseClient) {
        globalForSupabase.__kffSupabaseClient = createSupabaseClient();
    }
    return globalForSupabase.__kffSupabaseClient;
}

/** Lazily initialized @supabase/supabase-js client so callers can query `supabase.from(...).select()`. */
export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        const client = getSupabaseClient();
        const value = Reflect.get(client, prop, client);
        return typeof value === 'function' ? value.bind(client) : value;
    },
});
