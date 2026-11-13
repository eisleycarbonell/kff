import { z } from 'zod';

const id = z.string().regex(/^\d+$/).transform(Number).pipe(z.int().positive().max(2_147_483_647));

export const inventoryMovementQuerySchema = z.strictObject({
    transactionType: z
        .enum(['Receive', 'Consume', 'Produce', 'Transfer', 'Scrap', 'Adjustment', 'Sale'])
        .optional(),
    itemId: id.optional(),
    lotId: id.optional(),
    locationId: id.optional(),
});

export const listInventoryMovementsRequestSchema = z.object({
    query: inventoryMovementQuerySchema,
});
export type InventoryMovementQuery = z.output<typeof inventoryMovementQuerySchema>;
