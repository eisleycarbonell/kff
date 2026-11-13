import { z } from 'zod';

const id = z.int().positive().max(2_147_483_647);
const fields = {
    code: z.string().trim().toUpperCase().min(1).max(30),
    name: z.string().trim().min(1).max(120),
    description: z
        .string()
        .trim()
        .max(2000)
        .transform((value) => value || null)
        .nullable()
        .optional(),
    isActive: z.boolean(),
};
export const createBrandSchema = z.strictObject({
    ...fields,
    isActive: fields.isActive.default(true),
});
export const updateBrandSchema = z
    .strictObject(fields)
    .partial()
    .refine(
        (input) => Object.values(input).some((value) => value !== undefined),
        'Provide at least one brand field to update.',
    );
export const brandIdRequestSchema = z.object({
    params: z.object({ id: z.string().regex(/^\d+$/).transform(Number).pipe(id) }),
});
export const createBrandRequestSchema = z.object({ body: createBrandSchema });
export const updateBrandRequestSchema = z.object({
    params: brandIdRequestSchema.shape.params,
    body: updateBrandSchema,
});
export type CreateBrandInput = z.output<typeof createBrandSchema>;
export type UpdateBrandInput = z.output<typeof updateBrandSchema>;
