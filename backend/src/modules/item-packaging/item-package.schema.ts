import { z } from 'zod';
const id = z.int().positive().max(2147483647);
const quantity = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,4})?$/);
export const packageInputSchema = z.strictObject({
    itemId: id,
    uomId: id,
    baseQty: quantity.refine((value) => /[1-9]/.test(value), 'Pack quantity must be positive.'),
    barcode: z.string().trim().min(1).max(50).nullable().default(null),
    grossWeightG: z
        .string()
        .trim()
        .regex(/^\d{1,8}(?:\.\d{1,4})?$/)
        .nullable()
        .default(null),
});
export const packageParamsSchema = z.object({
    id: z.string().regex(/^\d+$/).transform(Number).pipe(id),
});
export const packageCreateRequestSchema = z.object({ body: packageInputSchema });
export const packageUpdateRequestSchema = z.object({
    params: packageParamsSchema,
    body: packageInputSchema,
});
export const packageIdRequestSchema = z.object({ params: packageParamsSchema });
export type PackageInput = z.output<typeof packageInputSchema>;
