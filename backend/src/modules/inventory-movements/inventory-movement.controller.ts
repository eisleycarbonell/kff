import type { Request } from 'express';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as movementService from './inventory-movement.service.ts';
import type { listInventoryMovementsRequestSchema } from './inventory-movement.schema.ts';

export type InventoryMovementService = Pick<typeof movementService, 'listInventoryMovements'>;

export function createInventoryMovementController(service: InventoryMovementService) {
    return {
        async list(
            _request: Request,
            response: ValidatedResponse<typeof listInventoryMovementsRequestSchema>,
        ) {
            return sendSuccessResponse(
                response,
                await service.listInventoryMovements(response.locals.validated.query),
            );
        },
    };
}
