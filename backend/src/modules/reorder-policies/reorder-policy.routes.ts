import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import {
    createReorderPolicyController,
    type ReorderPolicyService,
} from './reorder-policy.controller.ts';
import {
    policyCreateRequestSchema,
    policyUpdateRequestSchema,
    policyIdRequestSchema,
} from './reorder-policy.schema.ts';
export function createReorderPolicyRouter(
    service: ReorderPolicyService,
    authenticate: RequestHandler,
) {
    const router = Router();
    const controller = createReorderPolicyController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.post(
        '/',
        requirePermission('canManageInventory'),
        validateRequest(policyCreateRequestSchema),
        controller.create,
    );
    router.patch(
        '/:id',
        requirePermission('canManageInventory'),
        validateRequest(policyUpdateRequestSchema),
        controller.update,
    );
    router.delete(
        '/:id',
        requirePermission('canManageInventory'),
        validateRequest(policyIdRequestSchema),
        controller.remove,
    );
    return router;
}
