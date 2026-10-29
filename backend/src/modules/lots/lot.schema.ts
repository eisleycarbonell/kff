import { z } from 'zod';

export const QC_STATUSES = ['Quarantine', 'Approved', 'Rejected', 'Expired'] as const;
export const nullableLotReferenceSchema = z
    .string()
    .trim()
    .max(100)
    .transform((value) => value || null)
    .nullable()
    .optional();
export const lotDateSchema = z
    .union([z.iso.date(), z.literal('')])
    .transform((value) => value || null)
    .nullable()
    .optional();
export const updateLotSchema = z
    .strictObject({
        supplierLotNumber: nullableLotReferenceSchema,
        manufactureDate: lotDateSchema,
        expirationDate: lotDateSchema,
        qcStatus: z.enum(QC_STATUSES).optional(),
    })
    .refine(
        (input) => Object.values(input).some((value) => value !== undefined),
        'Provide at least one lot field to update.',
    )
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
export const lotIdRequestSchema = z.object({
    params: z.object({
        id: z
            .string()
            .regex(/^\d+$/, 'Use a positive integer ID.')
            .transform(Number)
            .pipe(z.int().positive().max(2_147_483_647)),
    }),
});
export const updateLotRequestSchema = z.object({
    params: lotIdRequestSchema.shape.params,
    body: updateLotSchema,
});
export type UpdateLotInput = z.output<typeof updateLotSchema>;
