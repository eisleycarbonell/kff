import type { Request, Response } from 'express';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import { AppError } from '../../errors/app-error.ts';
import type * as service from './reason-code.service.ts';
import type { reasonCreateRequestSchema, reasonUpdateRequestSchema } from './reason-code.schema.ts';
export type ReasonCodeService = Pick<
    typeof service,
    'listReasonCodes' | 'createReasonCode' | 'updateReasonCode'
>;
export function createReasonCodeController(service: ReasonCodeService) {
    return {
        async list(_req: Request, res: Response) {
            return sendSuccessResponse(res, await service.listReasonCodes());
        },
        async create(req: Request, res: ValidatedResponse<typeof reasonCreateRequestSchema>) {
            return sendSuccessResponse(
                res,
                await service.createReasonCode(res.locals.validated.body, Number(req.user!.id)),
                201,
            );
        },
        async update(req: Request, res: ValidatedResponse<typeof reasonUpdateRequestSchema>) {
            const saved = await service.updateReasonCode(
                res.locals.validated.params.id,
                res.locals.validated.body,
                Number(req.user!.id),
            );
            if (!saved) throw new AppError(404, 'Record not found.');
            return sendSuccessResponse(res, saved);
        },
    };
}
