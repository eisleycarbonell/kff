import { AppError } from './app-error.ts';
import HttpStatusCode from '../utils/statusCodeHandler.ts';

/** Drizzle wraps driver errors in `cause`; postgres.js and pg expose SQLSTATE as `code`. */
export function getDatabaseErrorCode(error: unknown): string | undefined {
    const visited = new Set<object>();
    let current = error;

    while (typeof current === 'object' && current !== null && !visited.has(current)) {
        visited.add(current);
        const candidate = current as { code?: unknown; cause?: unknown };
        if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) {
            return candidate.code;
        }
        current = candidate.cause;
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
            if (code?.startsWith('08') || code === '53300') {
                return new AppError(
                    HttpStatusCode.SERVICE_UNAVAILABLE,
                    'The database is temporarily unavailable. Please try again later.',
                );
            }
            return undefined;
    }
}
