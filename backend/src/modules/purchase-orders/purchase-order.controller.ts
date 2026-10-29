import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as purchaseOrderService from './purchase-order.service.ts';
import type {
    createPurchaseOrderRequestSchema,
    updatePurchaseOrderRequestSchema,
    purchaseOrderIdRequestSchema,
    purchaseOrderActionRequestSchema,
} from './purchase-order.schema.ts';

export type PurchaseOrderService = Pick<
    typeof purchaseOrderService,
    | 'listPurchaseOrders'
    | 'getPurchaseOrder'
    | 'getPurchaseOrderOptions'
    | 'createPurchaseOrder'
    | 'updatePurchaseOrder'
    | 'sendPurchaseOrder'
    | 'cancelPurchaseOrder'
>;
function actor(request: Request) {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(401, 'Please sign in.');
    return id;
}
export function createPurchaseOrderController(service: PurchaseOrderService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listPurchaseOrders());
        },
        async options(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.getPurchaseOrderOptions());
        },
        async get(
            _request: Request,
            response: ValidatedResponse<typeof purchaseOrderIdRequestSchema>,
        ) {
            const order = await service.getPurchaseOrder(response.locals.validated.params.id);
            if (!order) throw new AppError(404, 'Purchase order not found.');
            return sendSuccessResponse(response, order);
        },
        async create(
            request: Request,
            response: ValidatedResponse<typeof createPurchaseOrderRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.createPurchaseOrder(response.locals.validated.body, actor(request)),
                201,
            );
        },
        async update(
            request: Request,
            response: ValidatedResponse<typeof updatePurchaseOrderRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            const order = await service.updatePurchaseOrder(params.id, body, actor(request));
            if (!order) throw new AppError(404, 'Purchase order not found.');
            return sendSuccessResponse(response, order);
        },
        async send(
            request: Request,
            response: ValidatedResponse<typeof purchaseOrderActionRequestSchema>,
        ) {
            const order = await service.sendPurchaseOrder(
                response.locals.validated.params.id,
                actor(request),
            );
            if (!order) throw new AppError(404, 'Purchase order not found.');
            return sendSuccessResponse(response, order);
        },
        async cancel(
            request: Request,
            response: ValidatedResponse<typeof purchaseOrderActionRequestSchema>,
        ) {
            const order = await service.cancelPurchaseOrder(
                response.locals.validated.params.id,
                actor(request),
            );
            if (!order) throw new AppError(404, 'Purchase order not found.');
            return sendSuccessResponse(response, order);
        },
    };
}
