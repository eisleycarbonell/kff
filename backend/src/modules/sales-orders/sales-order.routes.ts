import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createSalesOrderController, type SalesOrderService } from './sales-order.controller.ts';
import {
    salesOrderIdRequestSchema,
    createSalesOrderRequestSchema,
    updateSalesOrderRequestSchema,
    salesOrderActionRequestSchema,
} from './sales-order.schema.ts';
export function createSalesOrderRouter(service: SalesOrderService, authenticate: RequestHandler) {
    const router = Router(),
        controller = createSalesOrderController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.get('/options', controller.options);
    router.get('/:id', validateRequest(salesOrderIdRequestSchema), controller.get);
    router.use(requirePermission('canManageInventory'));
    router.post('/', validateRequest(createSalesOrderRequestSchema), controller.create);
    router.patch('/:id', validateRequest(updateSalesOrderRequestSchema), controller.update);
    router.post('/:id/confirm', validateRequest(salesOrderActionRequestSchema), controller.confirm);
    router.post('/:id/cancel', validateRequest(salesOrderActionRequestSchema), controller.cancel);
    return router;
}
