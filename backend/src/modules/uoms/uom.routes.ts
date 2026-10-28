import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createUomController, type UomService } from './uom.controller.ts';
import {
    uomIdRequestSchema,
    createUomRequestSchema,
    updateUomRequestSchema,
    createClassRequestSchema,
    updateClassRequestSchema,
} from './uom.schema.ts';
export function createUomRouter(service: UomService, authenticate: RequestHandler) {
    const router = Router(),
        controller = createUomController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.get('/classes', controller.classes);
    router.post(
        '/classes',
        requirePermission('canManageInventory'),
        validateRequest(createClassRequestSchema),
        controller.createClass,
    );
    router.patch(
        '/classes/:id',
        requirePermission('canManageInventory'),
        validateRequest(updateClassRequestSchema),
        controller.updateClass,
    );
    router.delete(
        '/classes/:id',
        requirePermission('canManageInventory'),
        validateRequest(uomIdRequestSchema),
        controller.removeClass,
    );
    router.get('/:id', validateRequest(uomIdRequestSchema), controller.get);
    router.post(
        '/',
        requirePermission('canManageInventory'),
        validateRequest(createUomRequestSchema),
        controller.create,
    );
    router.patch(
        '/:id',
        requirePermission('canManageInventory'),
        validateRequest(updateUomRequestSchema),
        controller.update,
    );
    router.delete(
        '/:id',
        requirePermission('canManageInventory'),
        validateRequest(uomIdRequestSchema),
        controller.remove,
    );
    return router;
}
