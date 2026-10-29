import type { Request, Response } from 'express';

import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import HttpStatusCode from '../../utils/statusCodeHandler.ts';
import type * as userService from './user.service.ts';
import type {
    createUserRequestSchema,
    updateUserRequestSchema,
    userIdRequestSchema,
} from './user.schema.ts';

export type UserService = Pick<
    typeof userService,
    'listUsers' | 'getUserByID' | 'createUser' | 'updateUser' | 'deleteUser'
>;

/** Inject the service at startup so HTTP behavior can be tested without a database. */
export function createUserController(service: UserService) {
    return {
        async listUsers(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listUsers());
        },

        async getUser(_request: Request, response: ValidatedResponse<typeof userIdRequestSchema>) {
            const user = await service.getUserByID(response.locals.validated.params.id);
            if (!user) throw new AppError(HttpStatusCode.NOT_FOUND, 'User not found.');
            return sendSuccessResponse(response, user);
        },

        async createUser(
            _request: Request,
            response: ValidatedResponse<typeof createUserRequestSchema>,
        ) {
            const user = await service.createUser(response.locals.validated.body);
            return sendSuccessResponse(response, user, HttpStatusCode.CREATED);
        },

        async updateUser(
            _request: Request,
            response: ValidatedResponse<typeof updateUserRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            const user = await service.updateUser(params.id, body);
            if (!user) throw new AppError(HttpStatusCode.NOT_FOUND, 'User not found.');
            return sendSuccessResponse(response, user);
        },

        async deleteUser(
            _request: Request,
            response: ValidatedResponse<typeof userIdRequestSchema>,
        ) {
            const user = await service.deleteUser(response.locals.validated.params.id);
            if (!user) throw new AppError(HttpStatusCode.NOT_FOUND, 'User not found.');
            return response.status(HttpStatusCode.NO_CONTENT).send();
        },
    };
}
