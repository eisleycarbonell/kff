import type { RequestHandler, Response } from 'express';
import type { output, ZodType } from 'zod';

export type ValidatedResponse<Schema extends ZodType> = Response<
    unknown,
    { validated: output<Schema> }
>;

/** Preserve Express 5's read-only query getter; controllers consume the parsed output in locals. */
export function validateRequest<Schema extends ZodType>(schema: Schema): RequestHandler {
    return (request, response, next) => {
        const result = schema.safeParse({
            body: request.body,
            params: request.params,
            query: request.query,
        });

        if (!result.success) return next(result.error);

        response.locals.validated = result.data;
        next();
    };
}
