import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createRoleController, type RoleService } from './role.controller.ts';
import {
    createRoleRequestSchema,
    roleIdRequestSchema,
    updateRoleRequestSchema,
} from './role.schema.ts';

export function createRoleRouter(service: RoleService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createRoleController(service);
    router.use(authenticate, requirePermission('canManageUsers'));
    router.get('/', controller.list);
    router.get('/:id', validateRequest(roleIdRequestSchema), controller.get);
    router.post('/', validateRequest(createRoleRequestSchema), controller.create);
    router.patch('/:id', validateRequest(updateRoleRequestSchema), controller.update);
    router.delete('/:id', validateRequest(roleIdRequestSchema), controller.remove);
    return router;
}
