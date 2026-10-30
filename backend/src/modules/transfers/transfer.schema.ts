import { z } from 'zod';

const id = z.int().positive().max(2_147_483_647);
const quantity = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,4})?$/, 'Use at most 10 whole digits and four decimal places.')
    .refine((value) => /[1-9]/.test(value), 'Quantity must be greater than zero.');
const line = z.strictObject({ itemId: id, lotId: id, qtyRequested: quantity });
const fields = {
    transferNumber: z.string().trim().toUpperCase().min(1).max(30),
    sourceLocationId: id,
    destinationLocationId: id,
    notes: z
        .string()
        .trim()
        .max(5000)
        .transform((value) => value || null)
        .nullable()
        .optional(),
    lines: z
        .array(line)
        .min(1)
        .max(100)
        .refine((rows) => new Set(rows.map((row) => row.lotId)).size === rows.length, {
            message: 'Select each lot only once.',
        }),
};
const differentLocations = (input: { sourceLocationId?: number; destinationLocationId?: number }) =>
    input.sourceLocationId === undefined ||
    input.destinationLocationId === undefined ||
    input.sourceLocationId !== input.destinationLocationId;
export const createTransferSchema = z.strictObject(fields).refine(differentLocations, {
    path: ['destinationLocationId'],
    message: 'Choose a different destination location.',
});
export const updateTransferSchema = z
    .strictObject(fields)
    .partial()
    .refine((input) => Object.values(input).some((value) => value !== undefined), {
        message: 'Provide at least one transfer field to update.',
    })
    .refine(differentLocations, {
        path: ['destinationLocationId'],
        message: 'Choose a different destination location.',
    });
const dispatchLines = z.array(z.strictObject({ transferLineId: id, qtyShipped: quantity }));
const receiveLines = z.array(z.strictObject({ transferLineId: id, qtyReceived: quantity }));
const uniqueLineIds = (rows: { transferLineId: number }[]) =>
    new Set(rows.map((row) => row.transferLineId)).size === rows.length;
export const dispatchTransferSchema = z.strictObject({
    transitLocationId: id,
    lines: dispatchLines.min(1).max(100).refine(uniqueLineIds, 'Include each line only once.'),
});
export const receiveTransferSchema = z.strictObject({
    lines: receiveLines.min(1).max(100).refine(uniqueLineIds, 'Include each line only once.'),
});
const params = z.object({
    id: z.string().regex(/^\d+$/, 'Use a positive integer ID.').transform(Number).pipe(id),
});
export const transferIdRequestSchema = z.object({ params });
export const createTransferRequestSchema = z.object({ body: createTransferSchema });
export const updateTransferRequestSchema = z.object({ params, body: updateTransferSchema });
export const dispatchTransferRequestSchema = z.object({ params, body: dispatchTransferSchema });
export const receiveTransferRequestSchema = z.object({ params, body: receiveTransferSchema });
export const transferActionRequestSchema = z.object({ params, body: z.strictObject({}) });
export type CreateTransferInput = z.output<typeof createTransferSchema>;
export type UpdateTransferInput = z.output<typeof updateTransferSchema>;
export type DispatchTransferInput = z.output<typeof dispatchTransferSchema>;
export type ReceiveTransferInput = z.output<typeof receiveTransferSchema>;
