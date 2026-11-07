import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import type * as service from './role.service.ts';
import type {
    createRoleRequestSchema,
    roleIdRequestSchema,
    updateRoleRequestSchema,
} from './role.schema.ts';

export type RoleService = Pick<
    typeof service,
    'listRoles' | 'getRole' | 'createRole' | 'updateRole' | 'deleteRole'
>;
export function createRoleController(roles: RoleService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await roles.listRoles());
        },
        async get(_request: Request, response: ValidatedResponse<typeof roleIdRequestSchema>) {
            const role = await roles.getRole(response.locals.validated.params.id);
            if (!role) throw new AppError(404, 'Role not found.');
            return sendSuccessResponse(response, role);
        },
        async create(
            request: Request,
            response: ValidatedResponse<typeof createRoleRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await roles.createRole(response.locals.validated.body, Number(request.user!.id)),
                201,
            );
        },
        async update(
            request: Request,
            response: ValidatedResponse<typeof updateRoleRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            const role = await roles.updateRole(params.id, body, Number(request.user!.id));
            if (!role) throw new AppError(404, 'Role not found.');
            return sendSuccessResponse(response, role);
        },
        async remove(request: Request, response: ValidatedResponse<typeof roleIdRequestSchema>) {
            const role = await roles.deleteRole(
                response.locals.validated.params.id,
                Number(request.user!.id),
            );
            if (!role) throw new AppError(404, 'Role not found.');
            return response.status(204).send();
        },
    };
}
