import type { Request, Response, NextFunction } from 'express';
import * as UserService from '../users/user.service.ts';
import {
    sendUnauthorizedResponse,
    sendSuccessResponse,
    sendSuccessNoDataResponse,
} from '../../utils/responseHandler.ts';
import { generateToken } from '../../utils/jwtHandler.ts';
import { comparePasswords } from '../../utils/hashHandler.ts';
import logger from '../../utils/logger.ts';
import { auditLoginSuccess, auditLoginFailure, auditLogout } from '../../utils/auditLogger.ts';

export const login = async (request: Request, response: Response, next: NextFunction) => {
    try {
        const { username, password } = request.body;
        const user = await UserService.getUserByUsername(username);

        // 1. Check if user exists
        if (!user) {
            auditLoginFailure(request, username, 'User not found');
            return sendUnauthorizedResponse(response, 'Invalid credentials');
        }

        // 2. Check password
        const isPasswordValid = await comparePasswords(password, user.password);

        if (!isPasswordValid) {
            auditLoginFailure(request, username, 'Incorrect password');
            return sendUnauthorizedResponse(response, 'Invalid credentials');
        }

        // 3. Generate token
        const token = await generateToken({ id: user.id }, '30d');

        // 4. Set cookie
        response.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        auditLoginSuccess(request, user.id, user.username);

        // 5. Send flat success response
        return sendSuccessResponse(response, {
            fullName: user.fullName,
            username: user.username,
            email: user.email,
        });
    } catch (error: any) {
        logger.error({ err: error }, 'Unexpected error during login');
        next(error);
    }
};

export const logout = async (request: Request, response: Response, next: NextFunction) => {
    try {
        response.cookie('jwt', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            expires: new Date(0),
        });

        auditLogout(request);

        return sendSuccessNoDataResponse(response, 'Logout Successful');
    } catch (error) {
        logger.error({ err: error }, 'Unexpected error during logout');
        next(error);
    }
};
