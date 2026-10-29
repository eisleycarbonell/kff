import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../errors/app-error.ts';
import { mapDatabaseError } from '../errors/database-error.ts';
import logger from '../utils/logger.ts';
import { sendErrorResponse, sendValidationError } from '../utils/responseHandler.ts';
import HttpStatusCode from '../utils/statusCodeHandler.ts';

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
    if (response.headersSent) return next(error);

    if (error instanceof ZodError) {
        return sendValidationError(
            response,
            error.issues.map((issue) => ({
                path: issue.path.map(String).join('.'),
                message: issue.message,
                code: issue.code,
            })),
            'Request validation failed.',
        );
    }

    if (typeof error === 'object' && error !== null && 'type' in error) {
        if (error.type === 'entity.parse.failed') {
            return sendErrorResponse(
                response,
                'Invalid JSON request body.',
                HttpStatusCode.BAD_REQUEST,
            );
        }
        if (error.type === 'entity.too.large') {
            return sendErrorResponse(
                response,
                'Request body is too large.',
                HttpStatusCode.PAYLOAD_TOO_LARGE,
            );
        }
    }

    const expected = error instanceof AppError ? error : mapDatabaseError(error);

    if (!expected || expected.status >= 500) {
        logger.error({ err: error, path: request.path }, 'Request failed');
    }

    return expected
        ? sendErrorResponse(response, expected.message, expected.status, expected.details)
        : sendErrorResponse(response);
};
