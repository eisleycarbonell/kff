import { z } from 'zod';
import { formulaComponentsSchema } from '../packing-formulas/packing-formula.schema.ts';
const id = z.int().positive().max(2147483647);
const qty = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,4})?$/);
const positive = qty.refine((value) => /[1-9]/.test(value), 'Quantity must be positive.');
export const CONTROL_KINDS = ['Count', 'Scrap', 'Disposition', 'QC', 'Formula'] as const;
const common = {
    requestNumber: z.string().trim().toUpperCase().min(1).max(40),
    notes: z.string().trim().min(3).max(2000),
    evidenceReference: z
        .string()
        .trim()
        .max(2000)
        .transform((value) => value || null)
        .nullable()
        .default(null),
};
export const createControlSchema = z
    .discriminatedUnion('kind', [
        z.strictObject({
            ...common,
            kind: z.literal('Count'),
            locationId: id,
            reasonId: id,
            lotIds: z
                .array(id)
                .min(1)
                .max(100)
                .refine((ids) => new Set(ids).size === ids.length, 'Select each lot once.'),
        }),
        z.strictObject({
            ...common,
            kind: z.literal('Scrap'),
            lotId: id,
            sourceLocationId: id,
            reasonId: id,
            quantity: positive,
            expectedQty: qty,
        }),
        z.strictObject({
            ...common,
            kind: z.literal('Disposition'),
            lotId: id,
            sourceLocationId: id,
            destinationLocationId: id,
            reasonId: id,
            quantity: positive,
            expectedQty: qty,
        }),
        z.strictObject({
            ...common,
            kind: z.literal('QC'),
            lotId: id,
            previousStatus: z.enum(['Quarantine', 'Approved', 'Rejected', 'Expired']),
            newStatus: z.enum(['Quarantine', 'Approved', 'Rejected', 'Expired']),
        }),
        z.strictObject({
            ...common,
            kind: z.literal('Formula'),
            itemId: id,
            effectiveDate: z.iso.date(),
            changeType: z.enum(['Replace', 'Retire']),
            components: z.array(formulaComponentsSchema.element).max(100),
        }),
    ])
    .superRefine((input, ctx) => {
        if (input.kind === 'Disposition' && input.sourceLocationId === input.destinationLocationId)
            ctx.addIssue({
                code: 'custom',
                path: ['destinationLocationId'],
                message: 'Select a different destination.',
            });
        if (input.kind === 'QC' && input.previousStatus === input.newStatus)
            ctx.addIssue({
                code: 'custom',
                path: ['newStatus'],
                message: 'Choose a different QC status.',
            });
        if (input.kind === 'QC' && !input.evidenceReference)
            ctx.addIssue({
                code: 'custom',
                path: ['evidenceReference'],
                message: 'Record an evidence reference for the QC decision.',
            });
        if (input.kind === 'Formula') {
            if (input.changeType === 'Replace') {
                const check = formulaComponentsSchema.safeParse(input.components);
                if (!check.success)
                    for (const issue of check.error.issues)
                        ctx.addIssue({
                            code: 'custom',
                            path: ['components', ...issue.path],
                            message: issue.message,
                        });
                if (input.components.some((row) => row.componentItemId === input.itemId))
                    ctx.addIssue({
                        code: 'custom',
                        path: ['components'],
                        message: 'A product cannot be its own component.',
                    });
            } else if (input.components.length)
                ctx.addIssue({
                    code: 'custom',
                    path: ['components'],
                    message: 'Retirement requests do not have components.',
                });
        }
    });
export const controlParamsSchema = z.object({
    id: z.string().regex(/^\d+$/).transform(Number).pipe(id),
});
export const controlQuerySchema = z.strictObject({ kind: z.enum(CONTROL_KINDS).optional() });
export const controlListRequestSchema = z.object({ query: controlQuerySchema });
export const controlIdRequestSchema = z.object({ params: controlParamsSchema });
export const controlCreateRequestSchema = z.object({ body: createControlSchema });
export const controlActionRequestSchema = z.object({
    params: controlParamsSchema,
    body: z.strictObject({
        action: z.enum(['submit', 'approve', 'reject', 'cancel', 'reopen']),
        reviewNote: z.string().trim().min(3).max(2000),
    }),
});
export const observationsRequestSchema = z.object({
    params: controlParamsSchema,
    body: z.strictObject({
        observations: z
            .array(z.strictObject({ observationId: id, countedQty: qty }))
            .min(1)
            .max(100)
            .refine(
                (rows) => new Set(rows.map((row) => row.observationId)).size === rows.length,
                'Observe each line once.',
            ),
    }),
});
export type CreateControlInput = z.output<typeof createControlSchema>;
export type ControlKind = (typeof CONTROL_KINDS)[number];
export type ControlAction = z.output<typeof controlActionRequestSchema>['body'];
