import { z } from 'zod';
import { lotDateSchema, nullableLotReferenceSchema } from '../lots/lot.schema.ts';

const id = z.int().positive().max(2_147_483_647);
const quantity = z
    .string()
    .trim()
    .regex(
        /^\d{1,10}(?:\.\d{1,4})?$/,
        'Use a non-negative decimal with at most 10 whole digits and four decimal places.',
    );
export const receivingLineSchema = z
    .strictObject({
        poLineId: id,
        qtyReceived: quantity.refine(
            (value) => /[1-9]/.test(value),
            'Receipt quantity must be greater than zero.',
        ),
        expectedQtyReceived: quantity,
        lotNumber: z.string().trim().toUpperCase().min(1).max(100),
        supplierLotNumber: nullableLotReferenceSchema,
        locationId: id,
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
export const receivePurchaseOrderSchema = z
    .strictObject({ poId: id, lines: z.array(receivingLineSchema).min(1).max(100) })
    .superRefine((input, context) => {
        const lots = new Set<string>();
        input.lines.forEach((line, index) => {
            if (lots.has(line.lotNumber))
                context.addIssue({
                    code: 'custom',
                    path: ['lines', index, 'lotNumber'],
                    message: 'Each receipt entry must have a different lot number.',
                });
            lots.add(line.lotNumber);
        });
    });
export const receivePurchaseOrderRequestSchema = z.object({ body: receivePurchaseOrderSchema });
export type ReceivePurchaseOrderInput = z.output<typeof receivePurchaseOrderSchema>;
