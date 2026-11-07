import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as service from './brand.service.ts';
import type {
    brandIdRequestSchema,
    createBrandRequestSchema,
    updateBrandRequestSchema,
} from './brand.schema.ts';
export type BrandService = Pick<
    typeof service,
    'listBrands' | 'getBrand' | 'createBrand' | 'updateBrand'
>;
const actor = (request: Request) => {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(401, 'Please sign in.');
    return id;
};
export function createBrandController(service: BrandService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listBrands());
        },
        async get(_request: Request, response: ValidatedResponse<typeof brandIdRequestSchema>) {
            const saved = await service.getBrand(response.locals.validated.params.id);
            if (!saved) throw new AppError(404, 'Brand not found.');
            return sendSuccessResponse(response, saved);
        },
        async create(
            request: Request,
            response: ValidatedResponse<typeof createBrandRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.createBrand(response.locals.validated.body, actor(request)),
                201,
            );
        },
        async update(
            request: Request,
            response: ValidatedResponse<typeof updateBrandRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            const saved = await service.updateBrand(params.id, body, actor(request));
            if (!saved) throw new AppError(404, 'Brand not found.');
            return sendSuccessResponse(response, saved);
        },
    };
}
