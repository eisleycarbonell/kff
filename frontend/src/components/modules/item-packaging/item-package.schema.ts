import { z } from "zod"
const id = z.int().positive(),
    text = z.string(),
    qty = text.regex(
        /^\d{1,10}(?:\.\d{1,4})?$/,
        "Use a nonnegative decimal with up to four places.",
    )
export const CATEGORIES = [
    "Material Defect",
    "Packing Damage",
    "Spoilage",
    "Expired",
    "Inventory Adjustment",
    "Other",
] as const
export const recordSchema = z.object({
    packagingId: id,
    itemId: id,
    itemName: text,
    sku: text,
    uomId: id,
    uomName: text,
    primaryUomName: text,
    baseQty: qty,
    barcode: text.nullable(),
    grossWeightG: text.nullable(),
    isInUse: z.boolean(),
})
export const inputSchema = z.object({
    itemId: id,
    uomId: id,
    baseQty: qty.refine((v) => /[1-9]/.test(v), "Quantity must be positive."),
    barcode: text.trim().max(50).nullable(),
    grossWeightG: qty.nullable(),
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
