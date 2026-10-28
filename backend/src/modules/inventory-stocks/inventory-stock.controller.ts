import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as service from './inventory-stock.service.ts';
import type {
    listStocksRequestSchema,
    stockIdRequestSchema,
    adjustmentRequestSchema,
} from './inventory-stock.schema.ts';
export type StockService = Pick<
    typeof service,
    'listStocks' | 'getStock' | 'listStockOptions' | 'recordStockAdjustment'
>;
export function createStockController(stockService: StockService) {
    return {
        async list(_request: Request, response: ValidatedResponse<typeof listStocksRequestSchema>) {
            return sendSuccessResponse(
                response,
                await stockService.listStocks(response.locals.validated.query),
            );
        },
        async get(_request: Request, response: ValidatedResponse<typeof stockIdRequestSchema>) {
            const stock = await stockService.getStock(response.locals.validated.params.id);
            if (!stock) throw new AppError(404, 'Stock balance not found.');
            return sendSuccessResponse(response, stock);
        },
        async options(_request: Request, response: Response) {
            return sendSuccessResponse(response, await stockService.listStockOptions());
        },
        async adjust(
            request: Request,
            response: ValidatedResponse<typeof adjustmentRequestSchema>,
        ) {
            const actorId = Number(request.user?.id);
            if (!Number.isSafeInteger(actorId) || actorId <= 0)
                throw new AppError(401, 'Please sign in.');
            return sendSuccessResponse(
                response,
                await stockService.recordStockAdjustment(response.locals.validated.body, actorId),
                201,
            );
        },
    };
}
