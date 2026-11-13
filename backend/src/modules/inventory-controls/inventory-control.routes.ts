import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createControlController, type ControlService } from './inventory-control.controller.ts';
import {
    controlActionRequestSchema,
    controlCreateRequestSchema,
    controlIdRequestSchema,
    controlListRequestSchema,
    observationsRequestSchema,
} from './inventory-control.schema.ts';
export function createControlRouter(service: ControlService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createControlController(service);
    router.use(authenticate);
    router.get('/options', controller.options);
    router.get('/', validateRequest(controlListRequestSchema), controller.list);
    router.get('/:id', validateRequest(controlIdRequestSchema), controller.get);
    router.post('/', validateRequest(controlCreateRequestSchema), controller.create);
    router.patch(
        '/:id/observations',
        validateRequest(observationsRequestSchema),
        controller.observe,
    );
    router.post('/:id/actions', validateRequest(controlActionRequestSchema), controller.action);
    return router;
}
