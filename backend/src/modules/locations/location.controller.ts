import type { Request, Response } from 'express';
import type * as service from './location.service.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { AppError } from '../../errors/app-error.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type {
    createLocationRequestSchema,
    updateLocationRequestSchema,
    locationIdSchema,
} from './location.schema.ts';
export type LocationService = Pick<
    typeof service,
    'listLocations' | 'getLocation' | 'createLocation' | 'updateLocation'
>;
function actor(request: Request) {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(401, 'Please sign in.');
    return id;
}
export function createLocationController(service: LocationService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listLocations());
        },
        async get(_request: Request, response: ValidatedResponse<typeof locationIdSchema>) {
            const saved = await service.getLocation(response.locals.validated.params.id);
            if (!saved) throw new AppError(404, 'Location not found.');
            return sendSuccessResponse(response, saved);
        },
        async create(
            request: Request,
            response: ValidatedResponse<typeof createLocationRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.createLocation(response.locals.validated.body, actor(request)),
                201,
            );
        },
        async update(
            request: Request,
            response: ValidatedResponse<typeof updateLocationRequestSchema>,
        ) {
            const saved = await service.updateLocation(
                response.locals.validated.params.id,
                response.locals.validated.body,
                actor(request),
            );
            if (!saved) throw new AppError(404, 'Location not found.');
            return sendSuccessResponse(response, saved);
        },
    };
}
