import { type Request, type Response, type NextFunction } from 'express';
import * as UserService from '../services/user.service.ts';
import type { CreateUserInput, UpdateUserInput } from '../services/user.service.ts';
import {
    sendBadRequestResponse,
    sendErrorResponse,
    sendNotFoundResponse,
    sendSuccessResponse,
} from '../utils/responseHandler.ts';
import HttpStatusCode from '../utils/statusCodeHandler.ts';

const writableFields = [
    'firstName',
    'middleName',
    'lastName',
    'dateOfBirth',
    'avatarUrl',
    'mobileNumber',
    'address',
    'email',
    'isEmailVerified',
    'roleId',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isIsoDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const validateUserInput = (body: unknown, isCreate: boolean) => {
    if (!isRecord(body)) return 'Request body must be an object.';

    for (const field of ['firstName', 'lastName', 'email'] as const) {
        if (
            (isCreate || field in body) &&
            (typeof body[field] !== 'string' || !body[field].trim())
        ) {
            return `${field} is required.`;
        }
    }

    for (const field of [
        'middleName',
        'dateOfBirth',
        'avatarUrl',
        'mobileNumber',
        'address',
    ] as const) {
        if (field in body && body[field] !== null && typeof body[field] !== 'string') {
            return `${field} must be a string or null.`;
        }
    }

    if (
        typeof body.dateOfBirth === 'string' &&
        body.dateOfBirth.trim() &&
        !isIsoDate(body.dateOfBirth.trim())
    ) {
        return 'dateOfBirth must use YYYY-MM-DD.';
    }

    if (
        'email' in body &&
        typeof body.email === 'string' &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
    ) {
        return 'Enter a valid email address.';
    }

    if (
        (isCreate || 'roleId' in body) &&
        (!Number.isSafeInteger(body.roleId) || Number(body.roleId) <= 0)
    ) {
        return 'Select a valid role.';
    }

    if ('isEmailVerified' in body && typeof body.isEmailVerified !== 'boolean') {
        return 'isEmailVerified must be true or false.';
    }

    if (isCreate) {
        if (typeof body.password !== 'string' || body.password.length < 8) {
            return 'Password must contain at least 8 characters.';
        }
        if (body.password.length > 128) return 'Password must contain 128 characters or fewer.';
    } else if (!writableFields.some((field) => field in body)) {
        return 'Provide at least one user field to update.';
    }

    return null;
};

const databaseErrorCode = (error: unknown) => {
    let current = error;

    for (let depth = 0; depth < 3 && isRecord(current); depth += 1) {
        if (typeof current.code === 'string') return current.code;
        current = current.cause;
    }

    return undefined;
};

const handleDatabaseError = (error: unknown, response: Response) => {
    const code = databaseErrorCode(error);

    if (code === '23505') {
        return sendErrorResponse(
            response,
            'A user with this email already exists.',
            HttpStatusCode.CONFLICT,
        );
    }

    if (code === '23503') return sendBadRequestResponse(response, 'Select a valid role.');
    return null;
};

export const listUsers = async (request: Request, response: Response, next: NextFunction) => {
    try {
        const users = await UserService.listUsers();
        return sendSuccessResponse(response, users);
    } catch (error: any) {
        next(error);
    }
};

export const getUser = async (request: Request, response: Response, next: NextFunction) => {
    try {
        const user = await UserService.getUserByID(request.params.id as string);
        if (!user) return sendNotFoundResponse(response, 'User not found.');
        return sendSuccessResponse(response, user);
    } catch (error: unknown) {
        return next(error);
    }
};

export const createUser = async (request: Request, response: Response, next: NextFunction) => {
    const validationError = validateUserInput(request.body, true);
    if (validationError) return sendBadRequestResponse(response, validationError);

    try {
        const user = await UserService.createUser(request.body as CreateUserInput);
        return sendSuccessResponse(response, user, HttpStatusCode.CREATED);
    } catch (error: unknown) {
        const handled = handleDatabaseError(error, response);
        if (handled) return handled;
        return next(error);
    }
};

export const updateUser = async (request: Request, response: Response, next: NextFunction) => {
    const validationError = validateUserInput(request.body, false);
    if (validationError) return sendBadRequestResponse(response, validationError);

    try {
        const user = await UserService.updateUser(
            request.params.id as string,
            request.body as UpdateUserInput,
        );
        if (!user) return sendNotFoundResponse(response, 'User not found.');
        return sendSuccessResponse(response, user);
    } catch (error: unknown) {
        const handled = handleDatabaseError(error, response);
        if (handled) return handled;
        return next(error);
    }
};

export const deleteUser = async (request: Request, response: Response, next: NextFunction) => {
    try {
        const user = await UserService.deleteUser(request.params.id as string);
        if (!user) return sendNotFoundResponse(response, 'User not found.');
        return response.status(HttpStatusCode.NO_CONTENT).send();
    } catch (error: unknown) {
        return next(error);
    }
};
