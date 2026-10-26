import type { Response } from 'express';
import HttpStatusCode, { type HttpStatusCode as HttpStatusCodeType } from './statusCodeHandler.ts';

// ==========================================
// 1. Interfaces
// ==========================================

export interface SuccessResponse<T = void> {
    success: true;
    message?: string;
    data?: T;
}

export interface ErrorResponse<T = unknown> {
    success: false;
    error: {
        message: string;
        details?: T[];
    };
}

// ==========================================
// 2. Success Handlers
// ==========================================

export const sendSuccessResponse = <T>(
    res: Response,
    data: T,
    status: HttpStatusCodeType = HttpStatusCode.OK,
    message?: string,
): Response<SuccessResponse<T>> => {
    const payload: SuccessResponse<T> = { success: true, data };
    if (message) payload.message = message;

    return res.status(status).json(payload);
};

export const sendSuccessNoDataResponse = (
    res: Response,
    message = 'Operation successful',
    status: HttpStatusCodeType = HttpStatusCode.OK,
): Response<SuccessResponse> => {
    return res.status(status).json({ success: true, message });
};

// ==========================================
// 3. Core Error Handler (Strictly Typed)
// ==========================================

export const sendErrorResponse = <T = unknown>(
    res: Response,
    message: string = 'Internal Server Error',
    status: HttpStatusCodeType = HttpStatusCode.INTERNAL_SERVER_ERROR,
    details?: T[],
): Response<ErrorResponse<T>> => {
    const payload: ErrorResponse<T> = { success: false, error: { message } };
    if (details && details.length > 0) payload.error.details = details;

    return res.status(status).json(payload);
};

// ==========================================
// 4. Specific Error Wrappers
// ==========================================

export const sendNotFoundResponse = (res: Response, message = 'Resource not found') =>
    sendErrorResponse(res, message, HttpStatusCode.NOT_FOUND);

// Defaults T to 'string' so you can pass an array of strings easily,
// but you can override it if using an object-based validation library (like Zod)
export const sendValidationError = <T = string>(
    res: Response,
    details: T[],
    message = 'Validation failed',
) => sendErrorResponse<T>(res, message, HttpStatusCode.BAD_REQUEST, details);

export const sendUnauthorizedResponse = (res: Response, message = 'Unauthorized - Please log in') =>
    sendErrorResponse(res, message, HttpStatusCode.UNAUTHORIZED);

export const sendForbiddenResponse = (
    res: Response,
    message = 'Forbidden - Insufficient permissions',
) => sendErrorResponse(res, message, HttpStatusCode.FORBIDDEN);

export const sendBadRequestResponse = (res: Response, message = 'Bad Request') =>
    sendErrorResponse(res, message, HttpStatusCode.BAD_REQUEST);
