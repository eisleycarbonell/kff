import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import {
    createDeliveryOrderController,
    type DeliveryOrderService,
} from './delivery-order.controller.ts';
import {
    deliveryOrderIdRequestSchema,
    createDeliveryOrderRequestSchema,
    updateDeliveryOrderRequestSchema,
    dispatchDeliveryOrderRequestSchema,
    deliveryOrderActionRequestSchema,
} from './delivery-order.schema.ts';
export function createDeliveryOrderRouter(
    service: DeliveryOrderService,
    authenticate: RequestHandler,
) {
    const router = Router(),
        controller = createDeliveryOrderController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.get('/options', controller.options);
    router.get('/:id', validateRequest(deliveryOrderIdRequestSchema), controller.get);
    router.use(requirePermission('canManageTransfers'));
    router.post('/', validateRequest(createDeliveryOrderRequestSchema), controller.create);
    router.patch('/:id', validateRequest(updateDeliveryOrderRequestSchema), controller.update);
    router.post(
        '/:id/dispatch',
        validateRequest(dispatchDeliveryOrderRequestSchema),
        controller.dispatch,
    );
    router.post(
        '/:id/complete',
        validateRequest(deliveryOrderActionRequestSchema),
        controller.complete,
    );
    router.post(
        '/:id/cancel',
        validateRequest(deliveryOrderActionRequestSchema),
        controller.cancel,
    );
    return router;
}
