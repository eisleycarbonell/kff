import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import HttpStatusCode from '../../utils/statusCodeHandler.ts';
import type * as service from './uom.service.ts';
import type {
    uomIdRequestSchema,
    createUomRequestSchema,
    updateUomRequestSchema,
    createClassRequestSchema,
    updateClassRequestSchema,
} from './uom.schema.ts';
export type UomService = Pick<
    typeof service,
    | 'listUoms'
    | 'getUom'
    | 'createUom'
    | 'updateUom'
    | 'deleteUom'
    | 'listUomClasses'
    | 'createUomClass'
    | 'updateUomClass'
    | 'deleteUomClass'
>;
function actor(request: Request) {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(401, 'Please sign in.');
    return id;
}
export function createUomController(service: UomService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listUoms());
        },
        async classes(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listUomClasses());
        },
        async get(_request: Request, response: ValidatedResponse<typeof uomIdRequestSchema>) {
            const unit = await service.getUom(response.locals.validated.params.id);
            if (!unit) throw new AppError(404, 'Unit not found.');
            return sendSuccessResponse(response, unit);
        },
        async create(request: Request, response: ValidatedResponse<typeof createUomRequestSchema>) {
            return sendSuccessResponse(
                response,
                await service.createUom(response.locals.validated.body, actor(request)),
                201,
            );
        },
        async update(request: Request, response: ValidatedResponse<typeof updateUomRequestSchema>) {
            const saved = await service.updateUom(
                response.locals.validated.params.id,
                response.locals.validated.body,
                actor(request),
            );
            if (!saved) throw new AppError(404, 'Unit not found.');
            return sendSuccessResponse(response, saved);
        },
        async remove(_request: Request, response: ValidatedResponse<typeof uomIdRequestSchema>) {
            if (!(await service.deleteUom(response.locals.validated.params.id)))
                throw new AppError(404, 'Unit not found.');
            return response.status(HttpStatusCode.NO_CONTENT).send();
        },
        async createClass(
            request: Request,
            response: ValidatedResponse<typeof createClassRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.createUomClass(response.locals.validated.body, actor(request)),
                201,
            );
        },
        async updateClass(
            request: Request,
            response: ValidatedResponse<typeof updateClassRequestSchema>,
        ) {
            const saved = await service.updateUomClass(
                response.locals.validated.params.id,
                response.locals.validated.body,
                actor(request),
            );
            if (!saved) throw new AppError(404, 'Unit class not found.');
            return sendSuccessResponse(response, saved);
        },
        async removeClass(
            _request: Request,
            response: ValidatedResponse<typeof uomIdRequestSchema>,
        ) {
            if (!(await service.deleteUomClass(response.locals.validated.params.id)))
                throw new AppError(404, 'Unit class not found.');
            return response.status(HttpStatusCode.NO_CONTENT).send();
        },
    };
}
