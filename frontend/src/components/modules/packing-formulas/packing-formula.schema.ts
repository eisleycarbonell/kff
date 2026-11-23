import { z } from "zod"
const id = z.int().positive().max(2_147_483_647)
const quantity = z
    .string()
    .regex(/^\d{1,8}(?:\.\d{1,6})?$/)
    .refine(
        (value) => /[1-9]/.test(value),
        "Enter a positive quantity with up to six decimal places.",
    )
export const formulaInputSchema = z
    .strictObject({
        itemId: id,
        components: z
            .array(z.strictObject({ componentItemId: id, quantity, uomId: id }))
            .min(1)
            .max(100),
    })
    .superRefine((input, context) => {
        const seen = new Set<number>()
        for (const row of input.components) {
            if (
                row.componentItemId === input.itemId ||
                seen.has(row.componentItemId)
            )
                context.addIssue({
                    code: "custom",
                    path: ["components"],
                    message:
                        "Choose distinct materials other than the finished product.",
                })
            seen.add(row.componentItemId)
        }
    })
export const formulaSchema = z.object({
    revisionId: id.nullable().optional(),
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    labelItemName: z.string().nullable(),
    isActive: z.boolean(),
    primaryUomId: id,
    primaryUomName: z.string(),
    componentCount: z.int().positive(),
    createdBy: id.nullable(),
    updatedBy: id.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    components: z
        .array(
            z.object({
                bomId: id,
                componentItemId: id,
                componentSku: z.string(),
                componentName: z.string(),
                componentIsActive: z.boolean(),
                quantity,
                uomId: id,
                uomName: z.string(),
            }),
        )
        .min(1),
})
export const formulaOptionsSchema = z.object({
    products: z.array(
        z.object({
            itemId: id,
            sku: z.string(),
            name: z.string(),
            primaryUomName: z.string(),
            labelItemId: id.nullable().optional(),
            hasFormula: z.boolean(),
        }),
    ),
    components: z.array(
        z.object({
            itemId: id,
            sku: z.string(),
            name: z.string(),
            itemType: z.string().optional(),
            primaryUomId: id,
            uomClassId: id,
        }),
    ),
    uoms: z.array(
        z.object({
            uomId: id,
            name: z.string(),
            uomClassId: id,
            factorToBase: z.string(),
        }),
    ),
})
export type PackingFormula = z.output<typeof formulaSchema>
export type FormulaInput = z.output<typeof formulaInputSchema>
export type FormulaOptions = z.output<typeof formulaOptionsSchema>
function scaledUnits(value: string): bigint | null {
    const trimmed = value.trim()
    if (!/^\d{1,8}(?:\.\d{1,6})?$/.test(trimmed)) return null
    const [whole, fraction = ""] = trimmed.split(".")
    return BigInt(whole + fraction.padEnd(6, "0"))
}
/** Compute exact per-pack component quantity (<=6 decimals) from a batch amount divided by pack count. */
export function divideBatchByPacks(batchAmount: string, packCount: string): string | null {
    const total = scaledUnits(batchAmount)
    const packs = scaledUnits(packCount)
    if (total === null || packs === null || total <= BigInt(0) || packs <= BigInt(0)) return null
    const scale = BigInt(1000000)
    const numerator = total * scale
    const quotient = numerator / packs
    const remainder = numerator % packs
    const rounded = remainder * BigInt(2) >= packs ? quotient + BigInt(1) : quotient
    if (rounded <= BigInt(0) || rounded > BigInt("99999999999999")) return null
    const whole = rounded / scale
    const fraction = (rounded % scale).toString().padStart(6, "0").replace(/0+$/, "")
    return fraction ? `${whole}.${fraction}` : String(whole)
}
export function validateFormula(
    input: FormulaInput,
    options: FormulaOptions,
): string | undefined {
    const parsed = formulaInputSchema.safeParse(input)
    if (!parsed.success) return parsed.error.issues[0]?.message
    if (!options.products.some((row) => row.itemId === input.itemId))
        return "Select an active finished product."
    for (const row of input.components) {
        const material = options.components.find(
            (entry) => entry.itemId === row.componentItemId,
        )
        const unit = options.uoms.find((entry) => entry.uomId === row.uomId)
        if (!material || !unit || material.uomClassId !== unit.uomClassId)
            return "Select an active material and a compatible unit for every row."
    }
}
