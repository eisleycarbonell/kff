import type { Request, Response } from 'express';
import type * as authService from './auth.service.ts';
import type { loginRequestSchema, SessionUser } from './auth.schema.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { AppError } from '../../errors/app-error.ts';
import { generateToken } from '../../utils/jwtHandler.ts';
import { sendSuccessResponse, sendSuccessNoDataResponse } from '../../utils/responseHandler.ts';
import { auditLoginFailure, auditLoginSuccess, auditLogout } from '../../utils/auditLogger.ts';
import {
    SESSION_IDLE_TIMEOUT_SECONDS,
    clearSessionCookie,
    issueSessionCookie,
} from './session-cookie.ts';

export type AuthService = Pick<typeof authService, 'login' | 'getSessionUser'>;

export function createAuthController(service: AuthService) {
    return {
        async login(request: Request, response: ValidatedResponse<typeof loginRequestSchema>) {
            const input = response.locals.validated.body;
            const user = await service.login(input);
            if (!user) {
                auditLoginFailure(request, input.username, 'Invalid credentials');
                throw new AppError(401, 'Invalid email or password.');
            }
            await issueSessionCookie(response, user.userId);
            auditLoginSuccess(request, String(user.userId), user.email);
            return sendSuccessResponse(response, user);
        },
        logout(request: Request, response: Response) {
            clearSessionCookie(response);
            auditLogout(request);
            return sendSuccessNoDataResponse(response, 'Signed out.');
        },
        session(_request: Request, response: Response) {
            return sendSuccessResponse(response, response.locals.session);
        },
        async keepalive(_request: Request, response: Response) {
            const session = response.locals.session as SessionUser;
            const { expiresAt } = await issueSessionCookie(response, session.userId);
            return sendSuccessResponse(response, {
                expiresAt,
                idleTimeoutSeconds: SESSION_IDLE_TIMEOUT_SECONDS,
            });
        },
        async socketToken(_request: Request, response: Response) {
            const session = response.locals.session as SessionUser;
            const token = await generateToken(
                { id: String(session.userId), purpose: 'socket' },
                '10m',
            );
            return sendSuccessResponse(response, { token });
        },
    };
}
