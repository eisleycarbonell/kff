import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createItemController, type ItemService } from './item.controller.ts';
import { createItemRequestSchema, itemIdSchema, updateItemRequestSchema } from './item.schema.ts';

export function createItemRouter(service: ItemService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createItemController(service);
    router.use(authenticate);
    router.get('/', controller.listItems);
    router.get('/uoms', controller.listUoms);
    router.get('/:id', validateRequest(itemIdSchema), controller.getItem);
    router.post(
        '/',
        requirePermission('canManageInventory'),
        validateRequest(createItemRequestSchema),
        controller.createItem,
    );
    router.patch(
        '/:id',
        requirePermission('canManageInventory'),
        validateRequest(updateItemRequestSchema),
        controller.updateItem,
    );
    return router;
}
