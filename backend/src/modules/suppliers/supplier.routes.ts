import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createSupplierController, type SupplierService } from './supplier.controller.ts';
import {
    supplierIdRequestSchema,
    createSupplierRequestSchema,
    updateSupplierRequestSchema,
    createSupplierItemRequestSchema,
    updateSupplierItemRequestSchema,
} from './supplier.schema.ts';

export function createSupplierRouter(service: SupplierService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createSupplierController(service);
    router.use(authenticate);
    router.get('/', controller.listSuppliers);
    router.get('/options', controller.options);
    router.get('/:id', validateRequest(supplierIdRequestSchema), controller.getSupplier);
    router.get('/:id/items', validateRequest(supplierIdRequestSchema), controller.listItems);
    router.post(
        '/',
        requirePermission('canManagePurchasing'),
        validateRequest(createSupplierRequestSchema),
        controller.createSupplier,
    );
    router.patch(
        '/:id',
        requirePermission('canManagePurchasing'),
        validateRequest(updateSupplierRequestSchema),
        controller.updateSupplier,
    );
    router.post(
        '/:id/items',
        requirePermission('canManagePurchasing'),
        validateRequest(createSupplierItemRequestSchema),
        controller.createItem,
    );
    router.patch(
        '/:id/items/:supplierItemId',
        requirePermission('canManagePurchasing'),
        validateRequest(updateSupplierItemRequestSchema),
        controller.updateItem,
    );
    return router;
}
