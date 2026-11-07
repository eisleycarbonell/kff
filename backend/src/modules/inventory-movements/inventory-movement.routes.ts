import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../middleware/validate-request.ts';
import {
    createInventoryMovementController,
    type InventoryMovementService,
} from './inventory-movement.controller.ts';
import { listInventoryMovementsRequestSchema } from './inventory-movement.schema.ts';

export function createInventoryMovementRouter(
    service: InventoryMovementService,
    authenticate: RequestHandler,
) {
    const router = Router();
    const controller = createInventoryMovementController(service);
    router.use(authenticate);
    router.get('/', validateRequest(listInventoryMovementsRequestSchema), controller.list);
    return router;
}
