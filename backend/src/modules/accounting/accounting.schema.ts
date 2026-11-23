import { z } from 'zod';

export const accountingQuerySchema = z
    .strictObject({
        fromDate: z.iso.date().optional(),
        toDate: z.iso.date().optional(),
    })
    .superRefine((query, ctx) => {
        if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
            ctx.addIssue({
                code: 'custom',
                path: ['toDate'],
                message: 'End date must follow start date.',
            });
        }
    });

export const accountingRequestSchema = z.object({
    query: accountingQuerySchema,
});

export type AccountingQuery = z.output<typeof accountingQuerySchema>;
