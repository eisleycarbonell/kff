import * as UserService from '../modules/users/user.service.ts';
import type { NextFunction, Request, Response } from 'express';
import { sendBadRequestResponse } from '../utils/responseHandler.ts';
import { verifyToken } from '../utils/jwtHandler.ts';
import { errors } from 'jose';

const protectAuth = async (request: Request, response: Response, next: NextFunction) => {
    const token = request.cookies?.jwt;

    if (!token) {
        return sendBadRequestResponse(response, 'Unauthorized - you need to login');
    }

    try {
        const decoded = await verifyToken(token);
        const authUser = await UserService.getUserByID(decoded.id as string);

        // SECURITY FIX: Reject if token is valid but user no longer exists in the DB
        if (!authUser) {
            return sendBadRequestResponse(response, 'Unauthorized - user account invalid');
        }

        request.user = {
            id: String(authUser.userId),
            roleId: authUser.roleId,
            username: authUser.email,
        };
        next();
    } catch (error: any) {
        // Catch specific token errors to return 401s instead of 500 server crashes
        if (error instanceof errors.JWTExpired) {
            return sendBadRequestResponse(response, 'Unauthorized - token has expired');
        }
        if (error instanceof errors.JOSEError) {
            return sendBadRequestResponse(response, 'Unauthorized - invalid token');
        }

        // Pass true server/database errors to the global Express error handler
        next(error);
    }
};

export { protectAuth };
