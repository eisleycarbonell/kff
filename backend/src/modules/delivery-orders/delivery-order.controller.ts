import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as serviceModule from './delivery-order.service.ts';
import type {
    deliveryOrderIdRequestSchema,
    createDeliveryOrderRequestSchema,
    updateDeliveryOrderRequestSchema,
    dispatchDeliveryOrderRequestSchema,
    deliveryOrderActionRequestSchema,
} from './delivery-order.schema.ts';
export type DeliveryOrderService = Pick<
    typeof serviceModule,
    | 'listDeliveryOrders'
    | 'getDeliveryOrder'
    | 'getDeliveryOrderOptions'
    | 'createDeliveryOrder'
    | 'updateDeliveryOrder'
    | 'dispatchDeliveryOrder'
    | 'completeDeliveryOrder'
    | 'cancelDeliveryOrder'
>;
function actor(request: Request) {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(401, 'Please sign in.');
    return id;
}
function found<T>(value: T | null): T {
    if (!value) throw new AppError(404, 'Delivery order not found.');
    return value;
}
export function createDeliveryOrderController(service: DeliveryOrderService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listDeliveryOrders());
        },
        async options(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.getDeliveryOrderOptions());
        },
        async get(
            _request: Request,
            response: ValidatedResponse<typeof deliveryOrderIdRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                found(await service.getDeliveryOrder(response.locals.validated.params.id)),
            );
        },
        async create(
            request: Request,
            response: ValidatedResponse<typeof createDeliveryOrderRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.createDeliveryOrder(response.locals.validated.body, actor(request)),
                201,
            );
        },
        async update(
            request: Request,
            response: ValidatedResponse<typeof updateDeliveryOrderRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            return sendSuccessResponse(
                response,
                found(await service.updateDeliveryOrder(params.id, body, actor(request))),
            );
        },
        async dispatch(
            request: Request,
            response: ValidatedResponse<typeof dispatchDeliveryOrderRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            return sendSuccessResponse(
                response,
                found(await service.dispatchDeliveryOrder(params.id, body, actor(request))),
            );
        },
        async complete(
            request: Request,
            response: ValidatedResponse<typeof deliveryOrderActionRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                found(
                    await service.completeDeliveryOrder(
                        response.locals.validated.params.id,
                        actor(request),
                    ),
                ),
            );
        },
        async cancel(
            request: Request,
            response: ValidatedResponse<typeof deliveryOrderActionRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                found(
                    await service.cancelDeliveryOrder(
                        response.locals.validated.params.id,
                        actor(request),
                    ),
                ),
            );
        },
    };
}
