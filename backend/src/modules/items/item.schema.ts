import { z } from 'zod';

export const ITEM_TYPES = [
    'Raw Material - Bulk',
    'Packaging - Hardware',
    'Packaging - Label',
    'Finished Good',
] as const;
const id = z.int().positive().max(2_147_483_647);

// PostgreSQL numeric values travel as strings, with no floating-point conversion.
export const decimalSchema = (integerDigits: number) =>
    z
        .string()
        .trim()
        .regex(
            new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,4})?$`),
            `Use a non-negative decimal with at most ${integerDigits} whole digits and 4 decimal places.`,
        );

const fields = {
    sku: z.string().trim().min(1).max(50).toUpperCase(),
    name: z.string().trim().min(1).max(120),
    itemType: z.enum(ITEM_TYPES),
    primaryUomId: id,
    netWeightG: decimalSchema(8).nullable().optional(),
    shelfLifeDays: id.nullable().optional(),
    requiresQc: z.boolean(),
    unitCost: decimalSchema(10),
    isActive: z.boolean(),
};

export const createItemSchema = z.strictObject({
    ...fields,
    requiresQc: fields.requiresQc.default(false),
    unitCost: fields.unitCost.default('0'),
    isActive: fields.isActive.default(true),
});
export const updateItemSchema = z
    .strictObject(fields)
    .partial()
    .refine(
        (value) => Object.values(value).some((field) => field !== undefined),
        'Provide at least one item field to update.',
    );
export const itemIdSchema = z.object({
    params: z.object({ id: z.string().regex(/^\d+$/).transform(Number).pipe(id) }),
});
export const createItemRequestSchema = z.object({ body: createItemSchema });
export const updateItemRequestSchema = z.object({
    params: itemIdSchema.shape.params,
    body: updateItemSchema,
});
export type CreateItemInput = z.output<typeof createItemSchema>;
export type UpdateItemInput = z.output<typeof updateItemSchema>;
