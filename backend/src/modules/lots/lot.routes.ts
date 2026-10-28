import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createLotController, type LotService } from './lot.controller.ts';
import { lotIdRequestSchema, updateLotRequestSchema } from './lot.schema.ts';
export function createLotRouter(service: LotService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createLotController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.get('/:id', validateRequest(lotIdRequestSchema), controller.get);
    router.patch(
        '/:id',
        requirePermission('canManageInventory'),
        validateRequest(updateLotRequestSchema),
        controller.update,
    );
    return router;
}
