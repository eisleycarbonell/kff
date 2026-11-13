import { z } from 'zod';
const nullableText = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .transform((value) => value || null)
        .nullable();
export const settingsInputSchema = z.strictObject({
    expectedVersion: z.int().positive(),
    companyName: z.string().trim().min(1).max(120),
    address: nullableText(2000),
    email: z
        .union([z.email().max(254), z.literal('')])
        .transform((value) => value || null)
        .nullable(),
    phone: nullableText(40),
    currencyCode: z
        .string()
        .trim()
        .toUpperCase()
        .refine(
            (value) => Intl.supportedValuesOf('currency').includes(value),
            'Select a valid ISO currency code.',
        ),
    defaultReorderLevel: z.string().regex(/^\d{1,10}(?:\.\d{1,4})?$/),
    expiryWarningDays: z.int().min(0).max(3650),
});
export const settingsRequestSchema = z.object({ body: settingsInputSchema });
export type SettingsInput = z.output<typeof settingsInputSchema>;
