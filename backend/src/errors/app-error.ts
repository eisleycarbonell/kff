import type { HttpStatusCode } from '../utils/statusCodeHandler.ts';

/** An expected failure whose message is safe to return to an API client. */
export class AppError extends Error {
    readonly status: HttpStatusCode;
    readonly details?: unknown[];

    constructor(status: HttpStatusCode, message: string, details?: unknown[]) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.details = details;
    }
}
