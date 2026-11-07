import type { Request, Response } from 'express';

import { AppError } from '../../errors/app-error.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import HttpStatusCode from '../../utils/statusCodeHandler.ts';
import type * as customerService from './customer.service.ts';
import type {
    createCustomerRequestSchema,
    customerIdRequestSchema,
    updateCustomerRequestSchema,
} from './customer.schema.ts';

export type CustomerService = Pick<
    typeof customerService,
    'listCustomers' | 'getCustomer' | 'createCustomer' | 'updateCustomer'
>;

function actorId(request: Request) {
    const id = Number(request.user?.id);
    if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647)
        throw new AppError(HttpStatusCode.UNAUTHORIZED, 'Please sign in.');
    return id;
}

export function createCustomerController(service: CustomerService) {
    return {
        async listCustomers(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listCustomers());
        },
        async getCustomer(
            _request: Request,
            response: ValidatedResponse<typeof customerIdRequestSchema>,
        ) {
            const customer = await service.getCustomer(response.locals.validated.params.id);
            if (!customer) throw new AppError(HttpStatusCode.NOT_FOUND, 'Customer not found.');
            return sendSuccessResponse(response, customer);
        },
        async createCustomer(
            request: Request,
            response: ValidatedResponse<typeof createCustomerRequestSchema>,
        ) {
            const customer = await service.createCustomer(
                response.locals.validated.body,
                actorId(request),
            );
            return sendSuccessResponse(response, customer, HttpStatusCode.CREATED);
        },
        async updateCustomer(
            request: Request,
            response: ValidatedResponse<typeof updateCustomerRequestSchema>,
        ) {
            const { params, body } = response.locals.validated;
            const customer = await service.updateCustomer(params.id, body, actorId(request));
            if (!customer) throw new AppError(HttpStatusCode.NOT_FOUND, 'Customer not found.');
            return sendSuccessResponse(response, customer);
        },
    };
}
