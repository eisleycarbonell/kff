import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createReasonCodeController, type ReasonCodeService } from './reason-code.controller.ts';
import { reasonCreateRequestSchema, reasonUpdateRequestSchema } from './reason-code.schema.ts';
export function createReasonCodeRouter(service: ReasonCodeService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createReasonCodeController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.post(
        '/',
        requirePermission('canManageInventory'),
        validateRequest(reasonCreateRequestSchema),
        controller.create,
    );
    router.patch(
        '/:id',
        requirePermission('canManageInventory'),
        validateRequest(reasonUpdateRequestSchema),
        controller.update,
    );
    return router;
}
