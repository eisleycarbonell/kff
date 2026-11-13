import type { Request, Response } from 'express';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import { AppError } from '../../errors/app-error.ts';
import type * as service from './reorder-policy.service.ts';
import type {
    policyCreateRequestSchema,
    policyUpdateRequestSchema,
    policyIdRequestSchema,
} from './reorder-policy.schema.ts';
export type ReorderPolicyService = Pick<
    typeof service,
    'listReorderPolicies' | 'createReorderPolicy' | 'updateReorderPolicy' | 'removeReorderPolicy'
>;
export function createReorderPolicyController(service: ReorderPolicyService) {
    return {
        async list(_req: Request, res: Response) {
            return sendSuccessResponse(res, await service.listReorderPolicies());
        },
        async create(req: Request, res: ValidatedResponse<typeof policyCreateRequestSchema>) {
            return sendSuccessResponse(
                res,
                await service.createReorderPolicy(res.locals.validated.body, Number(req.user!.id)),
                201,
            );
        },
        async update(req: Request, res: ValidatedResponse<typeof policyUpdateRequestSchema>) {
            const saved = await service.updateReorderPolicy(
                res.locals.validated.params.id,
                res.locals.validated.body,
                Number(req.user!.id),
            );
            if (!saved) throw new AppError(404, 'Record not found.');
            return sendSuccessResponse(res, saved);
        },
        async remove(_req: Request, res: ValidatedResponse<typeof policyIdRequestSchema>) {
            if (!(await service.removeReorderPolicy(res.locals.validated.params.id)))
                throw new AppError(404, 'Record not found.');
            res.status(204).send();
        },
    };
}
