import { z } from 'zod';

const id = z.int().positive().max(2_147_483_647);
const decimal = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,4})?$/, 'Use at most 10 whole digits and four decimal places.');
const positive = decimal.refine((value) => /[1-9]/.test(value), 'Quantity must be positive.');
const fields = {
    salesOrderNumber: z.string().trim().toUpperCase().min(1).max(30),
    customerId: id,
    orderDate: z.iso.date(),
    requestedDeliveryDate: z.iso.date().nullable().optional(),
    notes: z
        .string()
        .trim()
        .max(5000)
        .transform((value) => value || null)
        .nullable()
        .optional(),
    lines: z
        .array(z.strictObject({ itemId: id, uomId: id, qtyOrdered: positive, unitPrice: decimal }))
        .min(1)
        .max(100)
        .refine(
            (rows) => new Set(rows.map((row) => row.itemId)).size === rows.length,
            'Select each item only once.',
        ),
};
const validDates = (input: { orderDate?: string; requestedDeliveryDate?: string | null }) =>
    !input.orderDate ||
    !input.requestedDeliveryDate ||
    input.requestedDeliveryDate >= input.orderDate;
export const createSalesOrderSchema = z.strictObject(fields).refine(validDates, {
    path: ['requestedDeliveryDate'],
    message: 'Delivery date cannot precede the order date.',
});
export const updateSalesOrderSchema = z
    .strictObject(fields)
    .partial()
    .refine(
        (input) => Object.values(input).some((value) => value !== undefined),
        'Provide at least one field.',
    )
    .refine(validDates, {
        path: ['requestedDeliveryDate'],
        message: 'Delivery date cannot precede the order date.',
    });
const params = z.object({ id: z.string().regex(/^\d+$/).transform(Number).pipe(id) });
export const salesOrderIdRequestSchema = z.object({ params });
export const createSalesOrderRequestSchema = z.object({ body: createSalesOrderSchema });
export const updateSalesOrderRequestSchema = z.object({ params, body: updateSalesOrderSchema });
export const salesOrderActionRequestSchema = z.object({ params, body: z.strictObject({}) });
export type CreateSalesOrderInput = z.output<typeof createSalesOrderSchema>;
export type UpdateSalesOrderInput = z.output<typeof updateSalesOrderSchema>;
