import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as serviceModule from './sales-order.service.ts';
import type {
    salesOrderIdRequestSchema,
    createSalesOrderRequestSchema,
    updateSalesOrderRequestSchema,
    salesOrderActionRequestSchema,
} from './sales-order.schema.ts';

export type SalesOrderService = Pick<
    typeof serviceModule,
    | 'listSalesOrders'
    | 'getSalesOrder'
    | 'getSalesOrderOptions'
    | 'createSalesOrder'
    | 'updateSalesOrder'
    | 'confirmSalesOrder'
    | 'cancelSalesOrder'
>;
function actor(request: Request) {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(401, 'Please sign in.');
    return id;
}
function found<T>(value: T | null): T {
    if (!value) throw new AppError(404, 'Sales order not found.');
    return value;
}
export function createSalesOrderController(service: SalesOrderService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listSalesOrders());
        },
        async options(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.getSalesOrderOptions());
        },
        async get(
            _request: Request,
            response: ValidatedResponse<typeof salesOrderIdRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                found(await service.getSalesOrder(response.locals.validated.params.id)),
            );
        },
        async create(
            request: Request,
            response: ValidatedResponse<typeof createSalesOrderRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.createSalesOrder(response.locals.validated.body, actor(request)),
                201,
            );
        },
        async update(
            request: Request,
            response: ValidatedResponse<typeof updateSalesOrderRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            return sendSuccessResponse(
                response,
                found(await service.updateSalesOrder(params.id, body, actor(request))),
            );
        },
        async confirm(
            request: Request,
            response: ValidatedResponse<typeof salesOrderActionRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                found(
                    await service.confirmSalesOrder(
                        response.locals.validated.params.id,
                        actor(request),
                    ),
                ),
            );
        },
        async cancel(
            request: Request,
            response: ValidatedResponse<typeof salesOrderActionRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                found(
                    await service.cancelSalesOrder(
                        response.locals.validated.params.id,
                        actor(request),
                    ),
                ),
            );
        },
    };
}
