import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createFormulaController, type FormulaService } from './packing-formula.controller.ts';
import {
    formulaIdRequestSchema,
    createFormulaRequestSchema,
    updateFormulaRequestSchema,
} from './packing-formula.schema.ts';
export function createFormulaRouter(service: FormulaService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createFormulaController(service);
    router.use(authenticate);
    router.get('/', controller.list);
    router.get('/options', controller.options);
    router.get('/:id', validateRequest(formulaIdRequestSchema), controller.get);
    router.use(requirePermission('canManagePacking'));
    router.post('/', validateRequest(createFormulaRequestSchema), controller.create);
    router.patch('/:id', validateRequest(updateFormulaRequestSchema), controller.update);
    router.delete('/:id', validateRequest(formulaIdRequestSchema), controller.remove);
    return router;
}
