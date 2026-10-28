import { z } from 'zod';
const id = z.int().positive().max(2_147_483_647);
export const uomIdRequestSchema = z.object({
    params: z.object({ id: z.string().regex(/^\d+$/).transform(Number).pipe(id) }),
});
export const factorSchema = z
    .string()
    .trim()
    .regex(
        /^\d{1,10}(?:\.\d{1,8})?$/,
        'Use a positive factor with up to 10 whole digits and 8 decimal places.',
    )
    .refine((value) => /[1-9]/.test(value), 'Factor must be greater than zero.');
const fields = {
    name: z.string().trim().min(1).max(20),
    uomClassId: id,
    factorToBase: factorSchema,
    isBase: z.boolean(),
};
const baseFactorValid = (value: { isBase?: boolean; factorToBase?: string }) =>
    value.isBase !== true ||
    value.factorToBase === undefined ||
    /^0*1(?:\.0+)?$/.test(value.factorToBase);
const factorError = { message: 'A base unit must have a factor of 1.', path: ['factorToBase'] };
export const createUomSchema = z
    .strictObject({ ...fields, isBase: fields.isBase.default(false) })
    .refine(baseFactorValid, factorError);
export const updateUomSchema = z
    .strictObject(fields)
    .partial()
    .refine(
        (value) => Object.values(value).some((field) => field !== undefined),
        'Provide at least one unit field.',
    )
    .refine(baseFactorValid, factorError);
export const uomClassSchema = z.strictObject({ name: z.string().trim().min(1).max(30) });
export const createUomRequestSchema = z.object({ body: createUomSchema });
export const updateUomRequestSchema = z.object({
    params: uomIdRequestSchema.shape.params,
    body: updateUomSchema,
});
export const createClassRequestSchema = z.object({ body: uomClassSchema });
export const updateClassRequestSchema = z.object({
    params: uomIdRequestSchema.shape.params,
    body: uomClassSchema,
});
export type CreateUomInput = z.output<typeof createUomSchema>;
export type UpdateUomInput = z.output<typeof updateUomSchema>;
export type UomClassInput = z.output<typeof uomClassSchema>;
