import { Router, type RequestHandler } from 'express';
import { requirePermission } from '../../middleware/auth.ts';
import { validateRequest } from '../../middleware/validate-request.ts';
import { accountingRequestSchema } from './accounting.schema.ts';
import { createAccountingController, type AccountingService } from './accounting.controller.ts';

export function createAccountingRouter(
    service: AccountingService,
    authenticate: RequestHandler,
) {
    const router = Router();
    const controller = createAccountingController(service);

    router.use(authenticate, requirePermission('canManageAccounting'));
    router.get('/', validateRequest(accountingRequestSchema), controller.getOverview);

    return router;
}
