import type { Request, Response } from 'express';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as service from './accounting.service.ts';
import type { AccountingQuery } from './accounting.schema.ts';

export type AccountingService = Pick<typeof service, 'getAccountingOverview'>;

export function createAccountingController(accountingService: AccountingService) {
    return {
        async getOverview(_request: Request, response: Response) {
            const query = (response.locals.query ?? {}) as AccountingQuery;
            const data = await accountingService.getAccountingOverview(query);
            return sendSuccessResponse(response, data);
        },
    };
}
