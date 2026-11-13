import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createSettingsController, type SettingsService } from './company-setting.controller.ts';
import { settingsRequestSchema } from './company-setting.schema.ts';
export function createSettingsRouter(service: SettingsService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createSettingsController(service);
    router.use(authenticate);
    router.get('/', controller.get);
    router.patch(
        '/',
        requirePermission('canManageUsers'),
        validateRequest(settingsRequestSchema),
        controller.update,
    );
    return router;
}
