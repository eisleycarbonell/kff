import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as service from './packing-formula.service.ts';
import type {
    formulaIdRequestSchema,
    createFormulaRequestSchema,
    updateFormulaRequestSchema,
} from './packing-formula.schema.ts';
export type FormulaService = Pick<
    typeof service,
    | 'listFormulas'
    | 'getFormula'
    | 'getFormulaOptions'
    | 'createFormula'
    | 'updateFormula'
    | 'removeFormula'
>;
function actor(request: Request) {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(401, 'Please sign in.');
    return id;
}
export function createFormulaController(service: FormulaService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listFormulas());
        },
        async options(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.getFormulaOptions());
        },
        async get(_request: Request, response: ValidatedResponse<typeof formulaIdRequestSchema>) {
            const saved = await service.getFormula(response.locals.validated.params.id);
            if (!saved) throw new AppError(404, 'Packing formula not found.');
            return sendSuccessResponse(response, saved);
        },
        async create(
            request: Request,
            response: ValidatedResponse<typeof createFormulaRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.createFormula(response.locals.validated.body, actor(request)),
                201,
            );
        },
        async update(
            request: Request,
            response: ValidatedResponse<typeof updateFormulaRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            const saved = await service.updateFormula(params.id, body, actor(request));
            if (!saved) throw new AppError(404, 'Packing formula not found.');
            return sendSuccessResponse(response, saved);
        },
        async remove(
            _request: Request,
            response: ValidatedResponse<typeof formulaIdRequestSchema>,
        ) {
            if (!(await service.removeFormula(response.locals.validated.params.id)))
                throw new AppError(404, 'Packing formula not found.');
            return response.status(204).end();
        },
    };
}
