import { z } from 'zod';
import { lotDateSchema } from '../lots/lot.schema.ts';

const id = z.int().positive().max(2_147_483_647);
const quantity = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,4})?$/, 'Use at most 10 whole digits and four decimal places.')
    .refine((value) => /[1-9]/.test(value), 'Quantity must be greater than zero.');
const metadata = {
    packingOrderNumber: z.string().trim().toUpperCase().min(1).max(30),
    destinationLocationId: id,
    scheduledDate: lotDateSchema,
    notes: z
        .string()
        .trim()
        .max(5000)
        .transform((value) => value || null)
        .nullable()
        .optional(),
};
export const createPackingOrderSchema = z.strictObject({
    ...metadata,
    itemId: id,
    targetQty: quantity,
    sourceLocationId: id,
});
export const updatePackingOrderSchema = z
    .strictObject(metadata)
    .partial()
    .refine(
        (input) => Object.values(input).some((value) => value !== undefined),
        'Provide at least one packing-order field to update.',
    );
export const previewPackingOrderSchema = z.strictObject({
    itemId: id,
    sourceLocationId: id,
    targetQty: quantity,
});
export const completePackingOrderSchema = z
    .strictObject({
        actualQty: quantity,
        lotNumber: z.string().trim().toUpperCase().min(1).max(100),
        manufactureDate: lotDateSchema,
        expirationDate: lotDateSchema,
    })
    .superRefine((input, context) => {
        if (
            input.manufactureDate &&
            input.expirationDate &&
            input.expirationDate <= input.manufactureDate
        )
            context.addIssue({
                code: 'custom',
                path: ['expirationDate'],
                message: 'Expiration date must be after manufacture date.',
            });
    });
export const packingOrderIdRequestSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/, 'Use a positive integer ID.').transform(Number).pipe(id),
    }),
});
export const createPackingOrderRequestSchema = z.object({ body: createPackingOrderSchema });
export const previewPackingOrderRequestSchema = z.object({ body: previewPackingOrderSchema });
export const updatePackingOrderRequestSchema = z.object({
    params: packingOrderIdRequestSchema.shape.params,
    body: updatePackingOrderSchema,
});
export const packingOrderActionRequestSchema = z.object({
    params: packingOrderIdRequestSchema.shape.params,
    body: z.strictObject({}),
});
export const completePackingOrderRequestSchema = z.object({
    params: packingOrderIdRequestSchema.shape.params,
    body: completePackingOrderSchema,
});
export type CreatePackingOrderInput = z.output<typeof createPackingOrderSchema>;
export type UpdatePackingOrderInput = z.output<typeof updatePackingOrderSchema>;
export type PreviewPackingOrderInput = z.output<typeof previewPackingOrderSchema>;
export type CompletePackingOrderInput = z.output<typeof completePackingOrderSchema>;
