import type { Request, Response } from 'express';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import { AppError } from '../../errors/app-error.ts';
import type * as service from './item-package.service.ts';
import type {
    packageCreateRequestSchema,
    packageUpdateRequestSchema,
    packageIdRequestSchema,
} from './item-package.schema.ts';
export type ItemPackageService = Pick<
    typeof service,
    'listItemPackaging' | 'createItemPackage' | 'updateItemPackage' | 'removeItemPackage'
>;
export function createItemPackageController(service: ItemPackageService) {
    return {
        async list(_req: Request, res: Response) {
            return sendSuccessResponse(res, await service.listItemPackaging());
        },
        async create(req: Request, res: ValidatedResponse<typeof packageCreateRequestSchema>) {
            return sendSuccessResponse(
                res,
                await service.createItemPackage(res.locals.validated.body, Number(req.user!.id)),
                201,
            );
        },
        async update(req: Request, res: ValidatedResponse<typeof packageUpdateRequestSchema>) {
            const saved = await service.updateItemPackage(
                res.locals.validated.params.id,
                res.locals.validated.body,
                Number(req.user!.id),
            );
            if (!saved) throw new AppError(404, 'Record not found.');
            return sendSuccessResponse(res, saved);
        },
        async remove(_req: Request, res: ValidatedResponse<typeof packageIdRequestSchema>) {
            if (!(await service.removeItemPackage(res.locals.validated.params.id)))
                throw new AppError(404, 'Record not found.');
            res.status(204).send();
        },
    };
}
