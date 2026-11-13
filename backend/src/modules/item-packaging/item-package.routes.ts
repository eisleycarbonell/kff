import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createItemPackageController, type ItemPackageService } from './item-package.controller.ts';
import {
    packageCreateRequestSchema,
    packageUpdateRequestSchema,
    packageIdRequestSchema,
} from './item-package.schema.ts';
export function createItemPackageRouter(service: ItemPackageService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createItemPackageController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.post(
        '/',
        requirePermission('canManageInventory'),
        validateRequest(packageCreateRequestSchema),
        controller.create,
    );
    router.patch(
        '/:id',
        requirePermission('canManageInventory'),
        validateRequest(packageUpdateRequestSchema),
        controller.update,
    );
    router.delete(
        '/:id',
        requirePermission('canManageInventory'),
        validateRequest(packageIdRequestSchema),
        controller.remove,
    );
    return router;
}
