import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as itemService from './item.service.ts';
import type {
    createItemRequestSchema,
    itemIdSchema,
    updateItemRequestSchema,
} from './item.schema.ts';

export type ItemService = Pick<
    typeof itemService,
    'listItems' | 'getItem' | 'listItemUoms' | 'createItem' | 'updateItem'
>;
function actorId(request: Request) {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(401, 'Please sign in.');
    return id;
}
export function createItemController(service: ItemService) {
    return {
        async listItems(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listItems());
        },
        async listUoms(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listItemUoms());
        },
        async getItem(_request: Request, response: ValidatedResponse<typeof itemIdSchema>) {
            const item = await service.getItem(response.locals.validated.params.id);
            if (!item) throw new AppError(404, 'Item not found.');
            return sendSuccessResponse(response, item);
        },
        async createItem(
            request: Request,
            response: ValidatedResponse<typeof createItemRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.createItem(response.locals.validated.body, actorId(request)),
                201,
            );
        },
        async updateItem(
            request: Request,
            response: ValidatedResponse<typeof updateItemRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            const item = await service.updateItem(params.id, body, actorId(request));
            if (!item) throw new AppError(404, 'Item not found.');
            return sendSuccessResponse(response, item);
        },
    };
}
