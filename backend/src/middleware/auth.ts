import type { RequestHandler } from 'express';
import { errors } from 'jose';
import type { RoleSettings } from '../db/schema.ts';
import type { AuthService } from '../modules/auth/auth.controller.ts';
import {
    SESSION_SLIDE_THROTTLE_SECONDS,
    clearSessionCookie,
    issueSessionCookie,
} from '../modules/auth/session-cookie.ts';
import { AppError } from '../errors/app-error.ts';
import { verifyToken } from '../utils/jwtHandler.ts';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createAuthMiddleware(service: Pick<AuthService, 'getSessionUser'>): RequestHandler {
    return async (request, response, next) => {
        const authorization = request.get('authorization');
        let token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
        let usedCookieToken = false;
        if (!token) {
            const cookie = request.headers.cookie
                ?.split(';')
                .map((part) => part.trim())
                .find((part) => part.startsWith('jwt='));
            if (cookie) {
                try {
                    token = decodeURIComponent(cookie.slice(4));
                    usedCookieToken = true;
                } catch {
                    clearSessionCookie(response);
                    throw new AppError(401, 'Please sign in again.');
                }
            }
        }
        if (!token) throw new AppError(401, 'Please sign in.');
        let payload;
        try {
            payload = await verifyToken(token);
        } catch (error) {
            if (error instanceof errors.JOSEError) {
                if (usedCookieToken) {
                    clearSessionCookie(response);
                }
                if (error instanceof errors.JWTExpired) {
                    throw new AppError(
                        401,
                        'Your session expired due to inactivity. Please sign in again.',
                    );
                }
                throw new AppError(
                    401,
                    'Your session has expired or is invalid. Please sign in again.',
                );
            }
            throw error;
        }
        if (payload.purpose === 'socket')
            throw new AppError(401, 'Please sign in with a session token.');
        const id =
            typeof payload.id === 'string' && /^\d+$/.test(payload.id) ? Number(payload.id) : NaN;
        if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647)
            throw new AppError(401, 'Please sign in again.');
        const user = await service.getSessionUser(id);
        if (!user) throw new AppError(401, 'This account is no longer available.');
        request.user = {
            id: String(user.userId),
            roleId: user.roleId,
            username: user.email,
            permissions: user.permissions,
        };
        response.locals.session = user;

        const path = request.originalUrl || request.url;
        if (usedCookieToken && MUTATING_METHODS.has(request.method) && !path.startsWith('/api/auth/')) {
            const nowSec = Math.floor(Date.now() / 1000);
            if (
                typeof payload.iat !== 'number' ||
                nowSec - payload.iat >= SESSION_SLIDE_THROTTLE_SECONDS
            ) {
                await issueSessionCookie(response, user.userId);
            }
        }

        next();
    };
}

export function requirePermission(permission: keyof RoleSettings): RequestHandler {
    return (request, _response, next) => {
        if (!request.user) throw new AppError(401, 'Please sign in.');
        if (request.user.permissions?.[permission] !== true)
            throw new AppError(403, 'Your role does not allow this action.');
        next();
    };
}
