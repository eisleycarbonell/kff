import { z } from 'zod';

const id = z.int().positive().max(2_147_483_647);
const decimal = z
    .string()
    .trim()
    .regex(
        /^\d{1,10}(?:\.\d{1,4})?$/,
        'Use a non-negative decimal with at most 10 whole digits and 4 decimal places.',
    );
export const purchaseOrderLineSchema = z.strictObject({
    itemId: id,
    uomId: id,
    qtyOrdered: decimal.refine(
        (value) => /[1-9]/.test(value),
        'Ordered quantity must be greater than zero.',
    ),
    unitPrice: decimal,
});
const lines = z
    .array(purchaseOrderLineSchema)
    .min(1)
    .max(100)
    .superRefine((rows, context) => {
        const seen = new Set<string>();
        rows.forEach((line, index) => {
            const key = `${line.itemId}:${line.uomId}`;
            if (seen.has(key))
                context.addIssue({
                    code: 'custom',
                    path: [index, 'itemId'],
                    message: 'Each item and unit pair can appear only once.',
                });
            seen.add(key);
        });
    });
const fields = {
    poNumber: z.string().trim().toUpperCase().min(1).max(30),
    supplierId: id,
    orderDate: z.iso.datetime({ offset: true }),
    expectedDeliveryDate: z
        .union([z.iso.date(), z.literal('')])
        .transform((value) => value || null)
        .nullable()
        .optional(),
    notes: z
        .string()
        .trim()
        .max(5000)
        .transform((value) => value || null)
        .nullable()
        .optional(),
    lines,
};
const checkDates = (
    input: { orderDate?: string; expectedDeliveryDate?: string | null },
    context: z.RefinementCtx,
) => {
    const orderDate = input.orderDate ? new Date(input.orderDate) : null;
    if (
        orderDate &&
        !Number.isNaN(orderDate.valueOf()) &&
        input.expectedDeliveryDate &&
        input.expectedDeliveryDate < orderDate.toISOString().slice(0, 10)
    ) {
        context.addIssue({
            code: 'custom',
            path: ['expectedDeliveryDate'],
            message: 'Expected delivery cannot be before the order date (UTC).',
        });
    }
};
export const createPurchaseOrderSchema = z.strictObject(fields).superRefine(checkDates);
export const updatePurchaseOrderSchema = z
    .strictObject(fields)
    .partial()
    .refine(
        (input) => Object.values(input).some((value) => value !== undefined),
        'Provide at least one purchase-order field to update.',
    )
    .superRefine(checkDates);
export const purchaseOrderIdRequestSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/, 'Use a positive integer ID.').transform(Number).pipe(id),
    }),
});
export const createPurchaseOrderRequestSchema = z.object({ body: createPurchaseOrderSchema });
export const updatePurchaseOrderRequestSchema = z.object({
    params: purchaseOrderIdRequestSchema.shape.params,
    body: updatePurchaseOrderSchema,
});
export const purchaseOrderActionRequestSchema = z.object({
    params: purchaseOrderIdRequestSchema.shape.params,
    body: z.strictObject({}),
});
export type CreatePurchaseOrderInput = z.output<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.output<typeof updatePurchaseOrderSchema>;
export type PurchaseOrderLineInput = z.output<typeof purchaseOrderLineSchema>;
