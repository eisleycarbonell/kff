import type { Request } from 'express';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type { operationalReportRequestSchema } from './operational-report.schema.ts';
import type * as service from './operational-report.service.ts';
export type OperationalReportService = Pick<typeof service, 'getOperationalReport'>;
export function createOperationalReportController(reports: OperationalReportService) {
    return {
        async get(_req: Request, res: ValidatedResponse<typeof operationalReportRequestSchema>) {
            return sendSuccessResponse(
                res,
                await reports.getOperationalReport(res.locals.validated.query),
            );
        },
    };
}
