import { z } from 'zod';

export const QC_STATUSES = ['Quarantine', 'Approved', 'Rejected', 'Expired'] as const;
const id = z.int().positive().max(2_147_483_647);
const routeId = z.string().regex(/^\d+$/).transform(Number).pipe(id);
const quantity = z
    .string()
    .trim()
    .regex(
        /^\d{1,10}(?:\.\d{1,4})?$/,
        'Use a non-negative quantity with up to 10 whole digits and 4 decimal places.',
    );
export const stockQuerySchema = z.strictObject({
    itemId: routeId.optional(),
    lotId: routeId.optional(),
    locationId: routeId.optional(),
    qcStatus: z.enum(QC_STATUSES).optional(),
    availability: z.enum(['available', 'unavailable']).optional(),
});
export const listStocksRequestSchema = z.object({ query: stockQuerySchema });
export const stockIdRequestSchema = z.object({ params: z.object({ id: routeId }) });
export const adjustmentSchema = z.strictObject({
    lotId: id,
    locationId: id,
    reasonId: id,
    expectedQtyOnHand: quantity,
    qtyOnHand: quantity,
    referenceId: z.string().trim().min(1).max(60).nullable().default(null),
});
export const adjustmentRequestSchema = z.object({ body: adjustmentSchema });
export type StockQuery = z.output<typeof stockQuerySchema>;
export type StockAdjustmentInput = z.output<typeof adjustmentSchema>;
