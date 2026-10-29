import { z } from 'zod';

const id = z.int().positive().max(2_147_483_647);
const routeId = z.string().regex(/^\d+$/, 'Use a positive integer ID.').transform(Number).pipe(id);
const optionalText = z
    .string()
    .trim()
    .max(100)
    .transform((value) => value || null)
    .nullable()
    .optional();
const email = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.union([z.email().max(100), z.literal('')]))
    .transform((value) => value || null)
    .nullable()
    .optional();
const supplierFields = { name: z.string().trim().min(1).max(100), email, isActive: z.boolean() };
const offerFields = {
    supplierItemCode: optionalText,
    defaultUomId: id.nullable().optional(),
    defaultPrice: z
        .string()
        .trim()
        .regex(
            /^\d{1,10}(?:\.\d{1,4})?$/,
            'Use a non-negative decimal with at most 10 whole digits and 4 decimal places.',
        )
        .nullable()
        .optional(),
    leadTimeDays: z.int().min(0).max(2_147_483_647).nullable().optional(),
    isPreferred: z.boolean(),
    isActive: z.boolean(),
};
const hasChanges = (input: Record<string, unknown>) =>
    Object.values(input).some((value) => value !== undefined);

export const createSupplierSchema = z.strictObject({
    ...supplierFields,
    isActive: supplierFields.isActive.default(true),
});
export const updateSupplierSchema = z
    .strictObject(supplierFields)
    .partial()
    .refine(hasChanges, 'Provide at least one supplier field to update.');
export const createSupplierItemSchema = z.strictObject({
    itemId: id,
    ...offerFields,
    isPreferred: offerFields.isPreferred.default(false),
    isActive: offerFields.isActive.default(true),
});
export const updateSupplierItemSchema = z
    .strictObject(offerFields)
    .partial()
    .refine(hasChanges, 'Provide at least one supplier item field to update.');
export const supplierIdRequestSchema = z.object({ params: z.object({ id: routeId }) });
export const createSupplierRequestSchema = z.object({ body: createSupplierSchema });
export const updateSupplierRequestSchema = z.object({
    params: supplierIdRequestSchema.shape.params,
    body: updateSupplierSchema,
});
export const createSupplierItemRequestSchema = z.object({
    params: supplierIdRequestSchema.shape.params,
    body: createSupplierItemSchema,
});
export const updateSupplierItemRequestSchema = z.object({
    params: z.object({ id: routeId, supplierItemId: routeId }),
    body: updateSupplierItemSchema,
});

export type CreateSupplierInput = z.output<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.output<typeof updateSupplierSchema>;
export type CreateSupplierItemInput = z.output<typeof createSupplierItemSchema>;
export type UpdateSupplierItemInput = z.output<typeof updateSupplierItemSchema>;
