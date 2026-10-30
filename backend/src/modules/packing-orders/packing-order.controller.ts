import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as packingOrderService from './packing-order.service.ts';
import type {
    packingOrderIdRequestSchema,
    createPackingOrderRequestSchema,
    updatePackingOrderRequestSchema,
    previewPackingOrderRequestSchema,
    completePackingOrderRequestSchema,
    packingOrderActionRequestSchema,
} from './packing-order.schema.ts';

export type PackingOrderService = Pick<
    typeof packingOrderService,
    | 'listPackingOrders'
    | 'getPackingOrder'
    | 'getPackingOrderOptions'
    | 'previewPackingOrder'
    | 'listPackingReservations'
    | 'createPackingOrder'
    | 'updatePackingOrder'
    | 'planPackingOrder'
    | 'startPackingOrder'
    | 'completePackingOrder'
    | 'cancelPackingOrder'
>;
function actor(request: Request) {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(401, 'Please sign in.');
    return id;
}
function found<T>(order: T | null): T {
    if (!order) throw new AppError(404, 'Packing order not found.');
    return order;
}
export function createPackingOrderController(service: PackingOrderService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listPackingOrders());
        },
        async options(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.getPackingOrderOptions());
        },
        async reservations(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listPackingReservations());
        },
        async preview(
            _request: Request,
            response: ValidatedResponse<typeof previewPackingOrderRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.previewPackingOrder(response.locals.validated.body),
            );
        },
        async get(
            _request: Request,
            response: ValidatedResponse<typeof packingOrderIdRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                found(await service.getPackingOrder(response.locals.validated.params.id)),
            );
        },
        async create(
            request: Request,
            response: ValidatedResponse<typeof createPackingOrderRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.createPackingOrder(response.locals.validated.body, actor(request)),
                201,
            );
        },
        async update(
            request: Request,
            response: ValidatedResponse<typeof updatePackingOrderRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            return sendSuccessResponse(
                response,
                found(await service.updatePackingOrder(params.id, body, actor(request))),
            );
        },
        async plan(
            request: Request,
            response: ValidatedResponse<typeof packingOrderActionRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                found(
                    await service.planPackingOrder(
                        response.locals.validated.params.id,
                        actor(request),
                    ),
                ),
            );
        },
        async start(
            request: Request,
            response: ValidatedResponse<typeof packingOrderActionRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                found(
                    await service.startPackingOrder(
                        response.locals.validated.params.id,
                        actor(request),
                    ),
                ),
            );
        },
        async cancel(
            request: Request,
            response: ValidatedResponse<typeof packingOrderActionRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                found(
                    await service.cancelPackingOrder(
                        response.locals.validated.params.id,
                        actor(request),
                    ),
                ),
            );
        },
        async complete(
            request: Request,
            response: ValidatedResponse<typeof completePackingOrderRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            return sendSuccessResponse(
                response,
                found(await service.completePackingOrder(params.id, body, actor(request))),
            );
        },
    };
}
