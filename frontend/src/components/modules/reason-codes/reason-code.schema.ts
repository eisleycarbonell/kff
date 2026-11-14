import { z } from "zod"

const id = z.int().positive()
const text = z.string()

export const CATEGORIES = [
    "Material Defect",
    "Packing Damage",
    "Spoilage",
    "Expired",
    "Inventory Adjustment",
    "Other",
] as const

export const recordSchema = z.object({
    reasonId: id,
    codeName: text,
    category: z.enum(CATEGORIES),
    description: text.nullable(),
    isActive: z.boolean(),
})

export const inputSchema = z.object({
    codeName: text.trim().min(1, "Enter a reason code.").max(50, "Reason code must be 50 characters or fewer."),
    category: z.enum(CATEGORIES),
    description: text
        .trim()
        .max(2000, "Description must be 2000 characters or fewer.")
        .transform((value) => value || null)
        .nullable(),
    isActive: z.boolean(),
})

export type RecordDto = z.output<typeof recordSchema>
export type InputDto = z.output<typeof inputSchema>
