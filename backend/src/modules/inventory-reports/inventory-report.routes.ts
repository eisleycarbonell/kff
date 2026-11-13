import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../middleware/validate-request.ts';
import {
    createInventoryReportController,
    type InventoryReportService,
} from './inventory-report.controller.ts';
import { inventoryReportRequestSchema } from './inventory-report.schema.ts';
export function createInventoryReportRouter(
    service: InventoryReportService,
    authenticate: RequestHandler,
) {
    const router = Router();
    const controller = createInventoryReportController(service);
    router.use(authenticate);
    router.get('/options', controller.options);
    router.get('/', validateRequest(inventoryReportRequestSchema), controller.get);
    return router;
}
