import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as transferService from './transfer.service.ts';
import type {
    transferIdRequestSchema,
    createTransferRequestSchema,
    updateTransferRequestSchema,
    dispatchTransferRequestSchema,
    receiveTransferRequestSchema,
    transferActionRequestSchema,
} from './transfer.schema.ts';

export type TransferService = Pick<
    typeof transferService,
    | 'listTransfers'
    | 'getTransfer'
    | 'getTransferOptions'
    | 'createTransfer'
    | 'updateTransfer'
    | 'dispatchTransfer'
    | 'receiveTransfer'
    | 'cancelTransfer'
>;
function actor(request: Request) {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(401, 'Please sign in.');
    return id;
}
function found<T>(value: T | null): T {
    if (!value) throw new AppError(404, 'Stock transfer not found.');
    return value;
}
export function createTransferController(service: TransferService) {
    return {
        async list(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listTransfers());
        },
        async options(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.getTransferOptions());
        },
        async get(_request: Request, response: ValidatedResponse<typeof transferIdRequestSchema>) {
            return sendSuccessResponse(
                response,
                found(await service.getTransfer(response.locals.validated.params.id)),
            );
        },
        async create(
            request: Request,
            response: ValidatedResponse<typeof createTransferRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.createTransfer(response.locals.validated.body, actor(request)),
                201,
            );
        },
        async update(
            request: Request,
            response: ValidatedResponse<typeof updateTransferRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            return sendSuccessResponse(
                response,
                found(await service.updateTransfer(params.id, body, actor(request))),
            );
        },
        async dispatch(
            request: Request,
            response: ValidatedResponse<typeof dispatchTransferRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            return sendSuccessResponse(
                response,
                found(await service.dispatchTransfer(params.id, body, actor(request))),
            );
        },
        async receive(
            request: Request,
            response: ValidatedResponse<typeof receiveTransferRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            return sendSuccessResponse(
                response,
                found(await service.receiveTransfer(params.id, body, actor(request))),
            );
        },
        async cancel(
            request: Request,
            response: ValidatedResponse<typeof transferActionRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                found(
                    await service.cancelTransfer(
                        response.locals.validated.params.id,
                        actor(request),
                    ),
                ),
            );
        },
    };
}
