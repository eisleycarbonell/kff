import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import { createPostgresClient } from './connection.ts';

config({ path: '.env', quiet: true });

const globalForDb = globalThis as typeof globalThis & { __kffPgClient?: Sql };

const bufferedOptions = {
    parsers: {} as Record<string, unknown>,
    serializers: {} as Record<string, unknown>,
};

function getPostgresClient(): Sql {
    if (!globalForDb.__kffPgClient) {
        const client = createPostgresClient();
        Object.assign(client.options.parsers, bufferedOptions.parsers);
        Object.assign(client.options.serializers, bufferedOptions.serializers);
        globalForDb.__kffPgClient = client;
    }
    return globalForDb.__kffPgClient;
}

const lazyClientTarget = Object.assign(() => undefined, {
    options: bufferedOptions,
}) as unknown as Sql;

/** Lazily create the postgres.js client on first query so missing or malformed DB URLs fail inside handlers rather than cold start. */
const clientProxy: Sql = new Proxy(lazyClientTarget, {
    get(_target, prop) {
        if (prop === 'options') {
            return globalForDb.__kffPgClient?.options ?? bufferedOptions;
        }
        if (prop === 'end' && !globalForDb.__kffPgClient) {
            return async () => undefined;
        }
        const client = getPostgresClient();
        const value = Reflect.get(client, prop, client);
        return typeof value === 'function' ? value.bind(client) : value;
    },
    apply(_target, thisArg, argArray) {
        const client = getPostgresClient();
        return Reflect.apply(client as unknown as (...args: unknown[]) => unknown, thisArg, argArray);
    },
});

export const db = drizzle({ client: clientProxy });
