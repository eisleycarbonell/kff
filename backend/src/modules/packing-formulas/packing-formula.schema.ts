import { z } from 'zod';
const id = z.int().positive().max(2_147_483_647);
export const formulaComponentsSchema = z
    .array(
        z.strictObject({
            componentItemId: id,
            uomId: id,
            quantity: z
                .string()
                .trim()
                .regex(
                    /^\d{1,8}(?:\.\d{1,6})?$/,
                    'Use up to eight whole digits and six decimal places.',
                )
                .refine((value) => /[1-9]/.test(value), 'Component quantity must be positive.'),
        }),
    )
    .min(1)
    .max(100)
    .superRefine((rows, context) => {
        const seen = new Set<number>();
        rows.forEach((row, index) => {
            if (seen.has(row.componentItemId))
                context.addIssue({
                    code: 'custom',
                    path: [index, 'componentItemId'],
                    message: 'Each material may appear only once.',
                });
            seen.add(row.componentItemId);
        });
    });
export const createFormulaSchema = z
    .strictObject({ itemId: id, components: formulaComponentsSchema })
    .superRefine((input, context) => {
        if (input.components.some((row) => row.componentItemId === input.itemId))
            context.addIssue({
                code: 'custom',
                path: ['components'],
                message: 'A product cannot be its own component.',
            });
    });
export const updateFormulaSchema = z.strictObject({ components: formulaComponentsSchema });
export const formulaIdRequestSchema = z.object({
    params: z.object({ id: z.string().regex(/^\d+$/).transform(Number).pipe(id) }),
});
export const createFormulaRequestSchema = z.object({ body: createFormulaSchema });
export const updateFormulaRequestSchema = z.object({
    params: formulaIdRequestSchema.shape.params,
    body: updateFormulaSchema,
});
export type CreateFormulaInput = z.output<typeof createFormulaSchema>;
export type UpdateFormulaInput = z.output<typeof updateFormulaSchema>;
