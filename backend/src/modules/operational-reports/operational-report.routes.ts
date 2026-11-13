import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../middleware/validate-request.ts';
import { operationalReportRequestSchema } from './operational-report.schema.ts';
import {
    createOperationalReportController,
    type OperationalReportService,
} from './operational-report.controller.ts';
export function createOperationalReportRouter(
    service: OperationalReportService,
    authenticate: RequestHandler,
) {
    const router = Router();
    router.use(authenticate);
    router.get(
        '/',
        validateRequest(operationalReportRequestSchema),
        createOperationalReportController(service).get,
    );
    return router;
}
