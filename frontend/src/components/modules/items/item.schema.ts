import { z } from "zod"

export const ITEM_TYPES = [
    "Raw Material - Bulk",
    "Packaging - Hardware",
    "Packaging - Label",
    "Finished Good",
] as const
const id = z.int().positive().max(2_147_483_647)
const decimal = (digits: number) =>
    z
        .string()
        .trim()
        .regex(
            new RegExp(`^\\d{1,${digits}}(?:\\.\\d{1,4})?$`),
            `Use a non-negative decimal with up to ${digits} whole digits and 4 decimal places.`,
        )
export const itemInputSchema = z.strictObject({
    sku: z.string().trim().min(1, "Enter a SKU.").max(50).toUpperCase(),
    name: z.string().trim().min(1, "Enter an item name.").max(120),
    itemType: z.enum(ITEM_TYPES),
    primaryUomId: id,
    netWeightG: decimal(8).nullable(),
    shelfLifeDays: id.nullable(),
    requiresQc: z.boolean(),
    unitCost: decimal(10),
    isActive: z.boolean(),
})
export const itemSchema = z.object({
    ...itemInputSchema.shape,
    itemId: id,
    primaryUomName: z.string(),
    uomClassName: z.string(),
    isInUse: z.boolean(),
    createdBy: id.nullable(),
    updatedBy: id.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
})
export const itemUomSchema = z.object({
    uomId: id,
    name: z.string(),
    uomClassId: id,
    uomClassName: z.string(),
})
export type Item = z.output<typeof itemSchema>
export type ItemUom = z.output<typeof itemUomSchema>
export type CreateItemInput = z.output<typeof itemInputSchema>
export type UpdateItemInput = Partial<CreateItemInput>
export type ItemFormValues = Omit<
    CreateItemInput,
    "primaryUomId" | "netWeightG" | "shelfLifeDays"
> & {
    primaryUomId: number | null
    netWeightG: string
    shelfLifeDays: string
}
export type ItemFormErrors = Partial<Record<keyof ItemFormValues, string>>
export function toItemInput(values: ItemFormValues): CreateItemInput {
    return itemInputSchema.parse({
        ...values,
        primaryUomId: values.primaryUomId,
        netWeightG: values.netWeightG.trim() || null,
        shelfLifeDays: values.shelfLifeDays.trim() ? Number(values.shelfLifeDays) : null,
    })
}
export function validateItem(
    values: ItemFormValues,
    items: Item[],
    uoms: ItemUom[],
    item?: Item | null,
): ItemFormErrors {
    const result = itemInputSchema.safeParse({
        ...values,
        netWeightG: values.netWeightG.trim() || null,
        shelfLifeDays: values.shelfLifeDays.trim() ? Number(values.shelfLifeDays) : null,
    })
    const errors: ItemFormErrors = {}
    if (!result.success)
        for (const issue of result.error.issues) {
            const field = issue.path[0] as keyof ItemFormValues
            errors[field] ??= issue.message
        }
    if (!uoms.some((unit) => unit.uomId === values.primaryUomId))
        errors.primaryUomId = "Select a primary unit of measure."
    if (
        items.some(
            (existing) =>
                existing.itemId !== item?.itemId &&
                existing.sku.toUpperCase() === values.sku.trim().toUpperCase(),
        )
    )
        errors.sku = "An item with this SKU already exists."
    return errors
}
const numberFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 4 })
export const formatItemDecimal = (value: string) => numberFormat.format(Number(value))
