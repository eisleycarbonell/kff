import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createBrandController, type BrandService } from './brand.controller.ts';
import {
    brandIdRequestSchema,
    createBrandRequestSchema,
    updateBrandRequestSchema,
} from './brand.schema.ts';
export function createBrandRouter(service: BrandService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createBrandController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.get('/:id', validateRequest(brandIdRequestSchema), controller.get);
    router.use(requirePermission('canManageInventory'));
    router.post('/', validateRequest(createBrandRequestSchema), controller.create);
    router.patch('/:id', validateRequest(updateBrandRequestSchema), controller.update);
    return router;
}
