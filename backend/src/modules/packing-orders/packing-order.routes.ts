import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import {
    createPackingOrderController,
    type PackingOrderService,
} from './packing-order.controller.ts';
import {
    packingOrderIdRequestSchema,
    createPackingOrderRequestSchema,
    updatePackingOrderRequestSchema,
    previewPackingOrderRequestSchema,
    completePackingOrderRequestSchema,
    packingOrderActionRequestSchema,
} from './packing-order.schema.ts';

export function createPackingOrderRouter(
    service: PackingOrderService,
    authenticate: RequestHandler,
) {
    const router = Router();
    const controller = createPackingOrderController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.get('/options', controller.options);
    router.get('/reservations', controller.reservations);
    router.post('/preview', validateRequest(previewPackingOrderRequestSchema), controller.preview);
    router.get('/:id', validateRequest(packingOrderIdRequestSchema), controller.get);
    router.post(
        '/',
        requirePermission('canManagePacking'),
        validateRequest(createPackingOrderRequestSchema),
        controller.create,
    );
    router.patch(
        '/:id',
        requirePermission('canManagePacking'),
        validateRequest(updatePackingOrderRequestSchema),
        controller.update,
    );
    router.post(
        '/:id/plan',
        requirePermission('canManagePacking'),
        validateRequest(packingOrderActionRequestSchema),
        controller.plan,
    );
    router.post(
        '/:id/start',
        requirePermission('canManagePacking'),
        validateRequest(packingOrderActionRequestSchema),
        controller.start,
    );
    router.post(
        '/:id/cancel',
        requirePermission('canManagePacking'),
        validateRequest(packingOrderActionRequestSchema),
        controller.cancel,
    );
    router.post(
        '/:id/complete',
        requirePermission('canManagePacking'),
        validateRequest(completePackingOrderRequestSchema),
        controller.complete,
    );
    return router;
}
