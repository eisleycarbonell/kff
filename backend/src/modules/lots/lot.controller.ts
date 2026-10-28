import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as lotService from './lot.service.ts';
import type { lotIdRequestSchema, updateLotRequestSchema } from './lot.schema.ts';
export type LotService = Pick<typeof lotService, 'listLots' | 'getLot' | 'updateLot'>;
export function createLotController(service: LotService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listLots());
        },
        async get(_request: Request, response: ValidatedResponse<typeof lotIdRequestSchema>) {
            const lot = await service.getLot(response.locals.validated.params.id);
            if (!lot) throw new AppError(404, 'Lot not found.');
            return sendSuccessResponse(response, lot);
        },
        async update(request: Request, response: ValidatedResponse<typeof updateLotRequestSchema>) {
            const actorId = Number(request.user?.id);
            if (!Number.isSafeInteger(actorId) || actorId <= 0)
                throw new AppError(401, 'Please sign in.');
            const { params, body } = response.locals.validated;
            const lot = await service.updateLot(params.id, body, actorId);
            if (!lot) throw new AppError(404, 'Lot not found.');
            return sendSuccessResponse(response, lot);
        },
    };
}
