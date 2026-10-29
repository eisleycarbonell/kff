import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createLocationController, type LocationService } from './location.controller.ts';
import {
    createLocationRequestSchema,
    updateLocationRequestSchema,
    locationIdSchema,
} from './location.schema.ts';
export function createLocationRouter(service: LocationService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createLocationController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.get('/:id', validateRequest(locationIdSchema), controller.get);
    router.post(
        '/',
        requirePermission('canManageInventory'),
        validateRequest(createLocationRequestSchema),
        controller.create,
    );
    router.patch(
        '/:id',
        requirePermission('canManageInventory'),
        validateRequest(updateLocationRequestSchema),
        controller.update,
    );
    return router;
}
