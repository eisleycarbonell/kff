import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as receivingService from './receiving.service.ts';
import type { receivePurchaseOrderRequestSchema } from './receiving.schema.ts';
export type ReceivingService = Pick<
    typeof receivingService,
    'listReceipts' | 'getReceivingOptions' | 'receivePurchaseOrder'
>;
export function createReceivingController(service: ReceivingService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listReceipts());
        },
        async options(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.getReceivingOptions());
        },
        async receive(
            request: Request,
            response: ValidatedResponse<typeof receivePurchaseOrderRequestSchema>,
        ) {
            const actorId = Number(request.user?.id);
            if (!Number.isSafeInteger(actorId) || actorId <= 0)
                throw new AppError(401, 'Please sign in.');
            return sendSuccessResponse(
                response,
                await service.receivePurchaseOrder(response.locals.validated.body, actorId),
                201,
            );
        },
    };
}
