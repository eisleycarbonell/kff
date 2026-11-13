import { z } from 'zod';
const qty = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,4})?$/);
export const policyInputSchema = z.strictObject({
    itemId: z.int().positive().max(2147483647),
    reorderLevel: qty,
});
export const policyUpdateSchema = z.strictObject({ reorderLevel: qty });
export const policyParamsSchema = z.object({
    id: z.string().regex(/^\d+$/).transform(Number).pipe(z.int().positive().max(2147483647)),
});
export const policyCreateRequestSchema = z.object({ body: policyInputSchema });
export const policyUpdateRequestSchema = z.object({
    params: policyParamsSchema,
    body: policyUpdateSchema,
});
export const policyIdRequestSchema = z.object({ params: policyParamsSchema });
