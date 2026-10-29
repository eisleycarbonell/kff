import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createReceivingController, type ReceivingService } from './receiving.controller.ts';
import { receivePurchaseOrderRequestSchema } from './receiving.schema.ts';
export function createReceivingRouter(service: ReceivingService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createReceivingController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.get('/options', controller.options);
    router.post(
        '/',
        requirePermission('canManageInventory'),
        validateRequest(receivePurchaseOrderRequestSchema),
        controller.receive,
    );
    return router;
}
