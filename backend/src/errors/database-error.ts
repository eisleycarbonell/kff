import { AppError } from './app-error.ts';
import HttpStatusCode from '../utils/statusCodeHandler.ts';

const connectionErrorCodes = new Set([
    'CONNECT_TIMEOUT',
    'CONNECTION_CLOSED',
    'CONNECTION_ENDED',
    'CONNECTION_DESTROYED',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ECONNRESET',
    'ECONNABORTED',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
]);

/** Inspect Drizzle causes and aggregated socket errors without exposing driver details. */
export function getDatabaseErrorCode(error: unknown): string | undefined {
    const visited = new Set<object>();
    const pending: unknown[] = [error];

    while (pending.length) {
        const current = pending.pop();
        if (typeof current !== 'object' || current === null || visited.has(current)) continue;
        visited.add(current);
        const candidate = current as { code?: unknown; cause?: unknown; errors?: unknown };
        if (
            typeof candidate.code === 'string' &&
            (/^[0-9A-Z]{5}$/.test(candidate.code) || connectionErrorCodes.has(candidate.code))
        ) {
            return candidate.code;
        }
        if (Array.isArray(candidate.errors)) {
            for (const nested of candidate.errors) pending.push(nested);
        }
        pending.push(candidate.cause);
    }

    return undefined;
}

/** Shared, resource-independent messages. Never return SQL, parameters, or driver details. */
export function mapDatabaseError(error: unknown): AppError | undefined {
    const code = getDatabaseErrorCode(error);

    switch (code) {
        case '23505':
        case '23P01':
            return new AppError(
                HttpStatusCode.CONFLICT,
                'A record with these values already exists.',
            );
        case '23503':
            return new AppError(
                HttpStatusCode.BAD_REQUEST,
                'A referenced record does not exist or is still in use.',
            );
        case '23001':
            return new AppError(HttpStatusCode.CONFLICT, 'This record is still in use.');
        case '23502':
            return new AppError(HttpStatusCode.BAD_REQUEST, 'A required value is missing.');
        case '23514':
            return new AppError(
                HttpStatusCode.BAD_REQUEST,
                'A value does not meet the required constraints.',
            );
        case '22P02':
            return new AppError(HttpStatusCode.BAD_REQUEST, 'A value has an invalid format.');
        case '22001':
            return new AppError(HttpStatusCode.BAD_REQUEST, 'A value exceeds the allowed length.');
        case '22003':
            return new AppError(
                HttpStatusCode.BAD_REQUEST,
                'A numeric value is outside the allowed range.',
            );
        default:
            if (
                code &&
                (code.startsWith('08') || code === '53300' || connectionErrorCodes.has(code))
            ) {
                return new AppError(
                    HttpStatusCode.SERVICE_UNAVAILABLE,
                    'The database is temporarily unavailable. Please try again later.',
                );
            }
            return undefined;
    }
}
