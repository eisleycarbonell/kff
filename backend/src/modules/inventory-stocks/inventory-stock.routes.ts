import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createStockController, type StockService } from './inventory-stock.controller.ts';
import {
    listStocksRequestSchema,
    stockIdRequestSchema,
    adjustmentRequestSchema,
} from './inventory-stock.schema.ts';
export function createStockRouter(service: StockService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createStockController(service);
    router.use(authenticate);
    router.get('/', validateRequest(listStocksRequestSchema), controller.list);
    router.get('/options', requirePermission('canManageInventory'), controller.options);
    router.post(
        '/adjustments',
        requirePermission('canManageInventory'),
        validateRequest(adjustmentRequestSchema),
        controller.adjust,
    );
    router.get('/:id', validateRequest(stockIdRequestSchema), controller.get);
    return router;
}
