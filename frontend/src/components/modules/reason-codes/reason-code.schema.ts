import { z } from "zod"
const id = z.int().positive(),
    text = z.string()
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
    codeName: text.trim().min(1).max(50),
    category: z.enum(CATEGORIES),
    description: text.trim().max(500).nullable(),
    isActive: z.boolean(),
})
export const optionsSchema = z.object({
    items: z.array(
        z.object({
            itemId: id,
            sku: text,
            name: text,
            isActive: z.boolean(),
            primaryUomId: id,
            primaryUomName: text,
            uomClassId: id,
        }),
    ),
    uoms: z.array(z.object({ uomId: id, name: text, uomClassId: id })),
})
export type RecordDto = z.output<typeof recordSchema>
export type InputDto = z.output<typeof inputSchema>
export type Options = z.output<typeof optionsSchema>
