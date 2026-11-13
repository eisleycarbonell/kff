import { z } from "zod"
export const settingsSchema = z.object({
    companyName: z.string(),
    address: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    currencyCode: z.string(),
    defaultReorderLevel: z.string(),
    expiryWarningDays: z.int(),
    version: z.int().positive(),
})
export const settingsInputSchema = z.object({
    expectedVersion: z.int().positive(),
    companyName: z.string().trim().min(1).max(120),
    address: z.string().trim().max(500).nullable(),
    email: z.email().nullable(),
    phone: z.string().trim().max(50).nullable(),
    currencyCode: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/),
    defaultReorderLevel: z.string().regex(/^\d{1,10}(?:\.\d{1,4})?$/),
    expiryWarningDays: z.int().min(0).max(3650),
})
export type Settings = z.output<typeof settingsSchema>
export type SettingsInput = z.output<typeof settingsInputSchema>
