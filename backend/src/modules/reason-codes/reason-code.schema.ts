import { z } from 'zod';

const reasonFields = {
    codeName: z.string().trim().min(1).max(50),
    category: z.enum([
        'Material Defect',
        'Packing Damage',
        'Spoilage',
        'Expired',
        'Inventory Adjustment',
        'Other',
    ]),
    description: z
        .string()
        .trim()
        .max(2000)
        .transform((value) => value || null)
        .nullable(),
    isActive: z.boolean(),
};

export const reasonInputSchema = z.strictObject({
    ...reasonFields,
    description: reasonFields.description.default(null),
    isActive: reasonFields.isActive.default(true),
});

export const reasonUpdateSchema = z
    .strictObject(reasonFields)
    .partial()
    .refine(
        (value) => Object.values(value).some((field) => field !== undefined),
        'Provide a field to update.',
    );

export const reasonIdSchema = z.object({
    id: z.string().regex(/^\d+$/).transform(Number).pipe(z.int().positive().max(2147483647)),
});

export const reasonCreateRequestSchema = z.object({ body: reasonInputSchema });

export const reasonUpdateRequestSchema = z.object({
    params: reasonIdSchema,
    body: reasonUpdateSchema,
});

export type ReasonInput = z.output<typeof reasonInputSchema>;
export type ReasonUpdate = z.output<typeof reasonUpdateSchema>;
