import { z } from 'zod';

const positiveId = z.int().positive().max(2_147_483_647);
const nullableText = (maxLength: number) =>
    z
        .string()
        .trim()
        .max(maxLength)
        .transform((value) => value || null)
        .nullable()
        .optional();
const customerFields = {
    name: z.string().trim().min(1).max(120),
    contactName: nullableText(100),
    email: z
        .string()
        .trim()
        .toLowerCase()
        .pipe(z.union([z.email().max(254), z.literal('')]))
        .transform((value) => value || null)
        .nullable()
        .optional(),
    phone: nullableText(40),
    address: nullableText(500),
    notes: nullableText(2000),
    isActive: z.boolean(),
};

export const createCustomerSchema = z.strictObject({
    ...customerFields,
    isActive: customerFields.isActive.default(true),
});
export const updateCustomerSchema = z
    .strictObject(customerFields)
    .partial()
    .refine((input) => Object.values(input).some((value) => value !== undefined), {
        message: 'Provide at least one customer field to update.',
    });
export const customerIdRequestSchema = z.object({
    params: z.object({
        id: z
            .string()
            .regex(/^\d+$/, 'Use a positive integer ID.')
            .transform(Number)
            .pipe(positiveId),
    }),
});
export const createCustomerRequestSchema = z.object({ body: createCustomerSchema });
export const updateCustomerRequestSchema = z.object({
    params: customerIdRequestSchema.shape.params,
    body: updateCustomerSchema,
});

export type CreateCustomerInput = z.output<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.output<typeof updateCustomerSchema>;
