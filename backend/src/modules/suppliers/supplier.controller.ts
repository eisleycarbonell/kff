import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as supplierService from './supplier.service.ts';
import type {
    supplierIdRequestSchema,
    createSupplierRequestSchema,
    updateSupplierRequestSchema,
    createSupplierItemRequestSchema,
    updateSupplierItemRequestSchema,
} from './supplier.schema.ts';

export type SupplierService = Pick<
    typeof supplierService,
    | 'listSuppliers'
    | 'getSupplier'
    | 'getSupplierOptions'
    | 'listSupplierItems'
    | 'createSupplier'
    | 'updateSupplier'
    | 'createSupplierItem'
    | 'updateSupplierItem'
>;
function actorId(request: Request) {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(401, 'Please sign in.');
    return id;
}
export function createSupplierController(service: SupplierService) {
    return {
        async listSuppliers(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listSuppliers());
        },
        async options(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.getSupplierOptions());
        },
        async getSupplier(
            _request: Request,
            response: ValidatedResponse<typeof supplierIdRequestSchema>,
        ) {
            const supplier = await service.getSupplier(response.locals.validated.params.id);
            if (!supplier) throw new AppError(404, 'Supplier not found.');
            return sendSuccessResponse(response, supplier);
        },
        async createSupplier(
            request: Request,
            response: ValidatedResponse<typeof createSupplierRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.createSupplier(response.locals.validated.body, actorId(request)),
                201,
            );
        },
        async updateSupplier(
            request: Request,
            response: ValidatedResponse<typeof updateSupplierRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            const supplier = await service.updateSupplier(params.id, body, actorId(request));
            if (!supplier) throw new AppError(404, 'Supplier not found.');
            return sendSuccessResponse(response, supplier);
        },
        async listItems(
            _request: Request,
            response: ValidatedResponse<typeof supplierIdRequestSchema>,
        ) {
            const offers = await service.listSupplierItems(response.locals.validated.params.id);
            if (!offers) throw new AppError(404, 'Supplier not found.');
            return sendSuccessResponse(response, offers);
        },
        async createItem(
            request: Request,
            response: ValidatedResponse<typeof createSupplierItemRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            const offer = await service.createSupplierItem(params.id, body, actorId(request));
            if (!offer) throw new AppError(404, 'Supplier not found.');
            return sendSuccessResponse(response, offer, 201);
        },
        async updateItem(
            request: Request,
            response: ValidatedResponse<typeof updateSupplierItemRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            const offer = await service.updateSupplierItem(
                params.id,
                params.supplierItemId,
                body,
                actorId(request),
            );
            if (!offer) throw new AppError(404, 'Supplier item not found.');
            return sendSuccessResponse(response, offer);
        },
    };
}
