import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createTransferController, type TransferService } from './transfer.controller.ts';
import {
    transferIdRequestSchema,
    createTransferRequestSchema,
    updateTransferRequestSchema,
    dispatchTransferRequestSchema,
    receiveTransferRequestSchema,
    transferActionRequestSchema,
} from './transfer.schema.ts';

export function createTransferRouter(service: TransferService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createTransferController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.get('/options', controller.options);
    router.get('/:id', validateRequest(transferIdRequestSchema), controller.get);
    router.use(requirePermission('canManageTransfers'));
    router.post('/', validateRequest(createTransferRequestSchema), controller.create);
    router.patch('/:id', validateRequest(updateTransferRequestSchema), controller.update);
    router.post(
        '/:id/dispatch',
        validateRequest(dispatchTransferRequestSchema),
        controller.dispatch,
    );
    router.post('/:id/receive', validateRequest(receiveTransferRequestSchema), controller.receive);
    router.post('/:id/cancel', validateRequest(transferActionRequestSchema), controller.cancel);
    return router;
}
