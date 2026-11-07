import { z } from 'zod';

const id = z.int().positive().max(2_147_483_647);
const quantity = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,4})?$/, 'Use at most 10 whole digits and four decimal places.')
    .refine((value) => /[1-9]/.test(value), 'Quantity must be positive.');
const fields = {
    deliveryOrderNumber: z.string().trim().toUpperCase().min(1).max(30),
    salesOrderId: id,
    sourceLocationId: id,
    deliveryDate: z.iso.date(),
    notes: z
        .string()
        .trim()
        .max(5000)
        .transform((value) => value || null)
        .nullable()
        .optional(),
    lines: z
        .array(z.strictObject({ salesOrderLineId: id, lotId: id, qtyDelivered: quantity }))
        .min(1)
        .max(100)
        .refine(
            (rows) => new Set(rows.map((row) => row.lotId)).size === rows.length,
            'Select each lot only once.',
        ),
};
export const createDeliveryOrderSchema = z.strictObject(fields);
export const updateDeliveryOrderSchema = z
    .strictObject(fields)
    .partial()
    .refine(
        (input) => Object.values(input).some((value) => value !== undefined),
        'Provide at least one field.',
    );
export const dispatchDeliveryOrderSchema = z.strictObject({ transitLocationId: id });
const params = z.object({ id: z.string().regex(/^\d+$/).transform(Number).pipe(id) });
export const deliveryOrderIdRequestSchema = z.object({ params });
export const createDeliveryOrderRequestSchema = z.object({ body: createDeliveryOrderSchema });
export const updateDeliveryOrderRequestSchema = z.object({
    params,
    body: updateDeliveryOrderSchema,
});
export const dispatchDeliveryOrderRequestSchema = z.object({
    params,
    body: dispatchDeliveryOrderSchema,
});
export const deliveryOrderActionRequestSchema = z.object({ params, body: z.strictObject({}) });
export type CreateDeliveryOrderInput = z.output<typeof createDeliveryOrderSchema>;
export type UpdateDeliveryOrderInput = z.output<typeof updateDeliveryOrderSchema>;
export type DispatchDeliveryOrderInput = z.output<typeof dispatchDeliveryOrderSchema>;
