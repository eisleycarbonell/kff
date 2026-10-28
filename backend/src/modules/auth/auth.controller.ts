import type { Request, Response } from 'express';
import type * as authService from './auth.service.ts';
import type { loginRequestSchema } from './auth.schema.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { AppError } from '../../errors/app-error.ts';
import { generateToken } from '../../utils/jwtHandler.ts';
import { sendSuccessResponse, sendSuccessNoDataResponse } from '../../utils/responseHandler.ts';
import { auditLoginFailure, auditLoginSuccess, auditLogout } from '../../utils/auditLogger.ts';

export type AuthService = Pick<typeof authService, 'login' | 'getSessionUser'>;
const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
});

export function createAuthController(service: AuthService) {
    return {
        async login(request: Request, response: ValidatedResponse<typeof loginRequestSchema>) {
            const input = response.locals.validated.body;
            const user = await service.login(input);
            if (!user) {
                auditLoginFailure(request, input.username, 'Invalid credentials');
                throw new AppError(401, 'Invalid email or password.');
            }
            const token = await generateToken({ id: String(user.userId) }, '30d');
            response.cookie('jwt', token, { ...cookieOptions(), maxAge: 30 * 24 * 60 * 60 * 1000 });
            auditLoginSuccess(request, String(user.userId), user.email);
            return sendSuccessResponse(response, user);
        },
        logout(request: Request, response: Response) {
            response.clearCookie('jwt', cookieOptions());
            auditLogout(request);
            return sendSuccessNoDataResponse(response, 'Signed out.');
        },
        session(_request: Request, response: Response) {
            return sendSuccessResponse(response, response.locals.session);
        },
    };
}
