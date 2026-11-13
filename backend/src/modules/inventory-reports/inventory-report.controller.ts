import type { Request } from 'express';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as service from './inventory-report.service.ts';
import type { inventoryReportRequestSchema } from './inventory-report.schema.ts';
export type InventoryReportService = Pick<
    typeof service,
    'getInventoryReport' | 'getInventoryReportOptions'
>;
export function createInventoryReportController(service: InventoryReportService) {
    return {
        async get(
            _request: Request,
            response: ValidatedResponse<typeof inventoryReportRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.getInventoryReport(response.locals.validated.query),
            );
        },
        async options(_request: Request, response: import('express').Response) {
            return sendSuccessResponse(response, await service.getInventoryReportOptions());
        },
    };
}
