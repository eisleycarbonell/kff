import { type Request, type Response, type NextFunction } from 'express';
import * as UserService from '../services/user.service.ts';
import { sendSuccessResponse } from '../utils/responseHandler.ts';

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
        return sendSuccessResponse(response, user);
    } catch (error: any) {
        next(error);
    }
};
