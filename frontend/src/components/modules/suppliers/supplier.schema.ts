import { z } from "zod"

export const SUPPLIER_ITEM_TYPES = [
    "Raw Material - Bulk",
    "Packaging - Hardware",
    "Packaging - Label",
    "Finished Good",
] as const

const id = z.int().positive().max(2_147_483_647)
const nonNegativeInteger = z.int().nonnegative().max(2_147_483_647)
const price = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,4})?$/, "Use up to 10 whole digits and 4 decimal places.")
const auditFields = {
    createdBy: id.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedBy: id.nullable(),
    updatedAt: z.iso.datetime({ offset: true }),
}

export const supplierInputSchema = z.strictObject({
    name: z.string().trim().min(1, "Enter a supplier name.").max(100),
    email: z.string().trim().toLowerCase().pipe(z.email().max(100)).nullable().optional(),
    isActive: z.boolean().optional(),
})
export const supplierSchema = z.object({
    supplierId: id,
    name: z.string(),
    email: z.string().nullable(),
    isActive: z.boolean(),
    itemCount: nonNegativeInteger,
    activeItemCount: nonNegativeInteger,
    preferredItemCount: nonNegativeInteger,
    hasOpenPurchaseOrders: z.boolean(),
    ...auditFields,
})
export const supplierItemInputSchema = z.strictObject({
    itemId: id,
    supplierItemCode: z.string().trim().max(100).nullable().optional(),
    defaultUomId: id.nullable().optional(),
    defaultPrice: price.nullable().optional(),
    leadTimeDays: nonNegativeInteger.nullable().optional(),
    isPreferred: z.boolean().optional(),
    isActive: z.boolean().optional(),
})
export const supplierItemSchema = z.object({
    supplierItemId: id,
    supplierId: id,
    itemId: id,
    supplierItemCode: z.string().nullable(),
    defaultUomId: id.nullable(),
    defaultPrice: price.nullable(),
    leadTimeDays: nonNegativeInteger.nullable(),
    isPreferred: z.boolean(),
    isActive: z.boolean(),
    itemSku: z.string(),
    itemName: z.string(),
    itemType: z.enum(SUPPLIER_ITEM_TYPES),
    itemIsActive: z.boolean(),
    primaryUomId: id,
    primaryUomName: z.string(),
    defaultUomName: z.string().nullable(),
    uomClassId: id,
    ...auditFields,
})
export const supplierOptionsSchema = z.object({
    items: z.array(
        z.object({
            itemId: id,
            sku: z.string(),
            name: z.string(),
            itemType: z.enum(SUPPLIER_ITEM_TYPES),
            primaryUomId: id,
            primaryUomName: z.string(),
            uomClassId: id,
            isActive: z.boolean(),
        }),
    ),
    uoms: z.array(z.object({ uomId: id, name: z.string(), uomClassId: id })),
})

export type Supplier = z.output<typeof supplierSchema>
export type SupplierItem = z.output<typeof supplierItemSchema>
export type SupplierOptions = z.output<typeof supplierOptionsSchema>
export type CreateSupplierInput = z.output<typeof supplierInputSchema>
export type UpdateSupplierInput = Partial<CreateSupplierInput>
export type CreateSupplierItemInput = z.output<typeof supplierItemInputSchema>
export type UpdateSupplierItemInput = Partial<Omit<CreateSupplierItemInput, "itemId">>
export type SupplierFormValues = { name: string; email: string; isActive: boolean }
export type SupplierFormErrors = Partial<Record<keyof SupplierFormValues, string>>
export type SupplierItemFormValues = {
    itemId: number | null
    supplierItemCode: string
    defaultUomId: number | null
    defaultPrice: string
    leadTimeDays: string
    isPreferred: boolean
    isActive: boolean
}
export type SupplierItemFormErrors = Partial<Record<keyof SupplierItemFormValues, string>>

export function toSupplierInput(values: SupplierFormValues): CreateSupplierInput {
    return supplierInputSchema.parse({ ...values, email: values.email.trim() || null })
}

export function validateSupplier(
    values: SupplierFormValues,
    suppliers: Supplier[],
    supplier?: Supplier | null,
): SupplierFormErrors {
    const result = supplierInputSchema.safeParse({ ...values, email: values.email.trim() || null })
    const errors: SupplierFormErrors = {}
    if (!result.success)
        for (const issue of result.error.issues) {
            const field = issue.path[0] as keyof SupplierFormValues
            errors[field] ??= issue.message
        }
    if (
        suppliers.some(
            (existing) =>
                existing.supplierId !== supplier?.supplierId &&
                existing.name === values.name.trim(),
        )
    )
        errors.name = "A supplier with this name already exists."
    if (supplier?.hasOpenPurchaseOrders && !values.isActive)
        errors.isActive =
            "Complete or cancel open purchase orders before deactivating this supplier."
    return errors
}

function supplierItemFormInput(values: SupplierItemFormValues) {
    const days = values.leadTimeDays.trim()
    return {
        ...values,
        supplierItemCode: values.supplierItemCode.trim() || null,
        defaultPrice: values.defaultPrice.trim() || null,
        leadTimeDays: days ? (/^\d+$/.test(days) ? Number(days) : NaN) : null,
        isPreferred: values.isActive && values.isPreferred,
    }
}

export function toSupplierItemInput(values: SupplierItemFormValues): CreateSupplierItemInput {
    return supplierItemInputSchema.parse(supplierItemFormInput(values))
}

export function validateSupplierItem(
    values: SupplierItemFormValues,
    options: SupplierOptions,
    items: SupplierItem[],
    item?: SupplierItem | null,
): SupplierItemFormErrors {
    const result = supplierItemInputSchema.safeParse(supplierItemFormInput(values))
    const errors: SupplierItemFormErrors = {}
    if (!result.success)
        for (const issue of result.error.issues) {
            const field = issue.path[0] as keyof SupplierItemFormValues
            errors[field] ??= issue.message
        }
    const selected = options.items.find((option) => option.itemId === values.itemId)
    if (!selected) errors.itemId = "Select an item."
    else if (
        (!item || values.isActive) &&
        (!selected.isActive || selected.itemType === "Finished Good")
    )
        errors.itemId = "Select an active raw material or packaging item."
    if (item && values.itemId !== item.itemId) errors.itemId = "The linked item cannot be changed."
    if (
        items.some(
            (existing) =>
                existing.supplierItemId !== item?.supplierItemId &&
                existing.itemId === values.itemId,
        )
    )
        errors.itemId = "This supplier already has this item. Edit its existing offer."
    if (
        values.defaultUomId !== null &&
        !options.uoms.some(
            (unit) =>
                unit.uomId === values.defaultUomId && unit.uomClassId === selected?.uomClassId,
        )
    )
        errors.defaultUomId = "Select a unit in the item's unit class, or use its primary unit."
    return errors
}
