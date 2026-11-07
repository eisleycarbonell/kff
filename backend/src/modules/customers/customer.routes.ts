import { Router, type RequestHandler } from 'express';

import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createCustomerController, type CustomerService } from './customer.controller.ts';
import {
    createCustomerRequestSchema,
    customerIdRequestSchema,
    updateCustomerRequestSchema,
} from './customer.schema.ts';

export function createCustomerRouter(service: CustomerService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createCustomerController(service);

    router.use(authenticate);
    router.get('/', controller.listCustomers);
    router.get('/:id', validateRequest(customerIdRequestSchema), controller.getCustomer);
    router.post(
        '/',
        requirePermission('canManageInventory'),
        validateRequest(createCustomerRequestSchema),
        controller.createCustomer,
    );
    router.patch(
        '/:id',
        requirePermission('canManageInventory'),
        validateRequest(updateCustomerRequestSchema),
        controller.updateCustomer,
    );

    return router;
}
