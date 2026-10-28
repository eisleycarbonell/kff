import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import {
    createPurchaseOrderController,
    type PurchaseOrderService,
} from './purchase-order.controller.ts';
import {
    purchaseOrderIdRequestSchema,
    createPurchaseOrderRequestSchema,
    updatePurchaseOrderRequestSchema,
    purchaseOrderActionRequestSchema,
} from './purchase-order.schema.ts';

export function createPurchaseOrderRouter(
    service: PurchaseOrderService,
    authenticate: RequestHandler,
) {
    const router = Router();
    const controller = createPurchaseOrderController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.get('/options', controller.options);
    router.get('/:id', validateRequest(purchaseOrderIdRequestSchema), controller.get);
    router.post(
        '/',
        requirePermission('canManagePurchasing'),
        validateRequest(createPurchaseOrderRequestSchema),
        controller.create,
    );
    router.patch(
        '/:id',
        requirePermission('canManagePurchasing'),
        validateRequest(updatePurchaseOrderRequestSchema),
        controller.update,
    );
    router.post(
        '/:id/send',
        requirePermission('canManagePurchasing'),
        validateRequest(purchaseOrderActionRequestSchema),
        controller.send,
    );
    router.post(
        '/:id/cancel',
        requirePermission('canManagePurchasing'),
        validateRequest(purchaseOrderActionRequestSchema),
        controller.cancel,
    );
    return router;
}
