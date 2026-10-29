import { z } from "zod"

export const PURCHASE_ORDER_STATUSES = [
    "Draft",
    "Sent",
    "Partially Received",
    "Completed",
    "Cancelled",
] as const
const ITEM_TYPES = [
    "Raw Material - Bulk",
    "Packaging - Hardware",
    "Packaging - Label",
    "Finished Good",
] as const
const id = z.int().positive().max(2_147_483_647)
const timestamp = z.iso.datetime({ offset: true })
const decimal = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,4})?$/, "Use up to 10 whole digits and 4 decimal places.")
const positiveDecimal = decimal.refine(
    (value) => /[1-9]/.test(value),
    "Enter a quantity greater than zero.",
)
const amount = z.string().regex(/^\d{1,30}\.\d{8}$/)
const auditFields = {
    createdBy: id.nullable(),
    createdAt: timestamp,
    updatedBy: id.nullable(),
    updatedAt: timestamp,
}

export const purchaseOrderSchema = z.object({
    poId: id,
    poNumber: z.string(),
    supplierId: id,
    supplierName: z.string(),
    supplierIsActive: z.boolean(),
    status: z.enum(PURCHASE_ORDER_STATUSES),
    orderDate: timestamp,
    expectedDeliveryDate: z.iso.date().nullable(),
    notes: z.string().nullable(),
    lineCount: z.int().nonnegative(),
    totalAmount: amount,
    receivedAmount: amount,
    outstandingAmount: amount,
    hasReceipts: z.boolean(),
    ...auditFields,
})
export const purchaseOrderLineSchema = z.object({
    poLineId: id,
    poId: id,
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    itemType: z.enum(ITEM_TYPES),
    itemIsActive: z.boolean(),
    uomId: id,
    uomName: z.string(),
    uomClassId: id,
    primaryUomId: id,
    primaryUomName: z.string(),
    qtyOrdered: positiveDecimal,
    qtyReceived: decimal,
    qtyRemaining: decimal,
    unitPrice: decimal,
    lineTotal: amount,
    ...auditFields,
})
export const purchaseOrderDetailSchema = purchaseOrderSchema.extend({
    lines: z.array(purchaseOrderLineSchema),
})
export const purchaseOrderOptionsSchema = z.object({
    suppliers: z.array(z.object({ supplierId: id, name: z.string(), isActive: z.boolean() })),
    items: z.array(
        z.object({
            itemId: id,
            sku: z.string(),
            name: z.string(),
            itemType: z.enum(ITEM_TYPES),
            isActive: z.boolean(),
            primaryUomId: id,
            primaryUomName: z.string(),
            uomClassId: id,
        }),
    ),
    uoms: z.array(z.object({ uomId: id, name: z.string(), uomClassId: id })),
    supplierItems: z.array(
        z.object({
            supplierItemId: id,
            supplierId: id,
            itemId: id,
            supplierItemCode: z.string().nullable(),
            defaultUomId: id.nullable(),
            defaultPrice: decimal.nullable(),
            leadTimeDays: z.int().nonnegative().nullable(),
            isPreferred: z.boolean(),
            isActive: z.boolean(),
        }),
    ),
})
export const purchaseOrderLineInputSchema = z.strictObject({
    itemId: id,
    uomId: id,
    qtyOrdered: positiveDecimal,
    unitPrice: decimal,
})
export const purchaseOrderInputSchema = z
    .strictObject({
        poNumber: z.string().trim().min(1, "Enter a purchase order number.").max(30).toUpperCase(),
        supplierId: id,
        orderDate: timestamp,
        expectedDeliveryDate: z.iso.date().nullable().optional(),
        notes: z.string().trim().max(5000).nullable().optional(),
        lines: z
            .array(purchaseOrderLineInputSchema)
            .min(1, "Add at least one item.")
            .max(100, "Use at most 100 lines."),
    })
    .superRefine((input, context) => {
        if (
            input.expectedDeliveryDate &&
            timestamp.safeParse(input.orderDate).success &&
            input.expectedDeliveryDate < new Date(input.orderDate).toISOString().slice(0, 10)
        )
            context.addIssue({
                code: "custom",
                path: ["expectedDeliveryDate"],
                message: "Expected delivery cannot be before the order date.",
            })
        const pairs = new Set<string>()
        input.lines.forEach((line, index) => {
            const pair = `${line.itemId}:${line.uomId}`
            if (pairs.has(pair))
                context.addIssue({
                    code: "custom",
                    path: ["lines", index, "itemId"],
                    message: "This item and unit already appear on another line.",
                })
            pairs.add(pair)
        })
    })

export type PurchaseOrder = z.output<typeof purchaseOrderSchema>
export type PurchaseOrderLine = z.output<typeof purchaseOrderLineSchema>
export type PurchaseOrderDetail = z.output<typeof purchaseOrderDetailSchema>
export type PurchaseOrderOptions = z.output<typeof purchaseOrderOptionsSchema>
export type CreatePurchaseOrderInput = z.output<typeof purchaseOrderInputSchema>
export type UpdatePurchaseOrderInput = Partial<CreatePurchaseOrderInput>
export type PurchaseOrderLineFormValues = {
    itemId: number | null
    uomId: number | null
    qtyOrdered: string
    unitPrice: string
}
export type PurchaseOrderFormValues = {
    poNumber: string
    supplierId: number | null
    orderDate: string
    expectedDeliveryDate: string
    notes: string
    lines: PurchaseOrderLineFormValues[]
}
export type PurchaseOrderLineFormErrors = Partial<Record<keyof PurchaseOrderLineFormValues, string>>
export type PurchaseOrderFormErrors = Partial<
    Record<Exclude<keyof PurchaseOrderFormValues, "lines">, string>
> & {
    lines?: string
    lineErrors?: PurchaseOrderLineFormErrors[]
}
export const canEditPurchaseOrder = (order: PurchaseOrder) =>
    order.status === "Draft" && !order.hasReceipts
export const canSendPurchaseOrder = canEditPurchaseOrder
export const canCancelPurchaseOrder = (order: PurchaseOrder) =>
    (order.status === "Draft" || order.status === "Sent") && !order.hasReceipts
export const createEmptyPurchaseOrderLine = (): PurchaseOrderLineFormValues => ({
    itemId: null,
    uomId: null,
    qtyOrdered: "",
    unitPrice: "",
})
export function localTodayDate(now = new Date()): string {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}
export function toPurchaseOrderFormValues(order: PurchaseOrderDetail): PurchaseOrderFormValues {
    return {
        poNumber: order.poNumber,
        supplierId: order.supplierId,
        orderDate: timestamp.safeParse(order.orderDate).success
            ? new Date(order.orderDate).toISOString().slice(0, 10)
            : "",
        expectedDeliveryDate: order.expectedDeliveryDate ?? "",
        notes: order.notes ?? "",
        lines: order.lines.map((line) => ({
            itemId: line.itemId,
            uomId: line.uomId,
            qtyOrdered: line.qtyOrdered,
            unitPrice: line.unitPrice,
        })),
    }
}
function formInput(values: PurchaseOrderFormValues) {
    return {
        poNumber: values.poNumber,
        supplierId: values.supplierId,
        orderDate: z.iso.date().safeParse(values.orderDate).success
            ? `${values.orderDate}T00:00:00.000Z`
            : "",
        expectedDeliveryDate: values.expectedDeliveryDate.trim() || null,
        notes: values.notes.trim() || null,
        lines: values.lines.map((line) => ({
            itemId: line.itemId,
            uomId: line.uomId,
            qtyOrdered: line.qtyOrdered,
            unitPrice: line.unitPrice,
        })),
    }
}
export function toPurchaseOrderInput(values: PurchaseOrderFormValues): CreatePurchaseOrderInput {
    return purchaseOrderInputSchema.parse(formInput(values))
}
export function validatePurchaseOrder(
    values: PurchaseOrderFormValues,
    options: PurchaseOrderOptions,
    orders: PurchaseOrder[],
    order?: PurchaseOrder | null,
): PurchaseOrderFormErrors {
    const errors: PurchaseOrderFormErrors = {}
    const lineErrors: PurchaseOrderLineFormErrors[] = []
    const result = purchaseOrderInputSchema.safeParse(formInput(values))
    if (!result.success)
        for (const issue of result.error.issues) {
            if (
                issue.path[0] === "lines" &&
                typeof issue.path[1] === "number" &&
                typeof issue.path[2] === "string"
            ) {
                const fields = (lineErrors[issue.path[1]] ??= {})
                fields[issue.path[2] as keyof PurchaseOrderLineFormValues] ??= issue.message
            } else {
                errors[
                    issue.path[0] as Exclude<keyof PurchaseOrderFormValues, "lines"> | "lines"
                ] ??= issue.message
            }
        }
    if (!z.iso.date().safeParse(values.orderDate).success)
        errors.orderDate = "Enter a valid order date."
    if (
        !options.suppliers.some(
            (supplier) => supplier.supplierId === values.supplierId && supplier.isActive,
        )
    )
        errors.supplierId = "Select an active supplier."
    if (
        orders.some(
            (existing) =>
                existing.poId !== order?.poId &&
                existing.poNumber === values.poNumber.trim().toUpperCase(),
        )
    )
        errors.poNumber = "A purchase order with this number already exists."
    values.lines.forEach((line, index) => {
        const fields = lineErrors[index] ?? {}
        const item = options.items.find((candidate) => candidate.itemId === line.itemId)
        if (!item || !item.isActive || item.itemType === "Finished Good")
            fields.itemId = "Select an active raw material or packaging item."
        if (
            !options.uoms.some(
                (unit) => unit.uomId === line.uomId && unit.uomClassId === item?.uomClassId,
            )
        )
            fields.uomId = "Select a unit compatible with this item."
        if (Object.keys(fields).length) lineErrors[index] = fields
    })
    if (lineErrors.some((fields) => fields && Object.keys(fields).length))
        errors.lineErrors = lineErrors
    return errors
}

function scaledDecimal(value: string, places: number, wholeDigits: number): bigint | null {
    if (
        typeof value !== "string" ||
        !new RegExp(`^\\d{1,${wholeDigits}}(?:\\.\\d{1,${places}})?$`).test(value.trim())
    )
        return null
    const [whole, fraction = ""] = value.trim().split(".")
    return BigInt(whole + fraction.padEnd(places, "0"))
}
function fixedAmount(value: bigint): string {
    const digits = value.toString().padStart(9, "0")
    return `${digits.slice(0, -8)}.${digits.slice(-8)}`
}
export function calculatePurchaseOrderLineTotal(
    qtyOrdered: string,
    unitPrice: string,
): string | null {
    const quantity = scaledDecimal(qtyOrdered, 4, 10)
    const price = scaledDecimal(unitPrice, 4, 10)
    return quantity === null || quantity <= BigInt(0) || price === null
        ? null
        : fixedAmount(quantity * price)
}
export function calculatePurchaseOrderTotal(
    lines: Pick<PurchaseOrderLineFormValues, "qtyOrdered" | "unitPrice">[],
): string | null {
    return sumPurchaseOrderAmounts(
        lines.map((line) => calculatePurchaseOrderLineTotal(line.qtyOrdered, line.unitPrice) ?? ""),
    )
}
export function sumPurchaseOrderAmounts(values: string[]): string | null {
    let total = BigInt(0)
    for (const value of values) {
        const scaled = scaledDecimal(value, 8, 30)
        if (scaled === null) return null
        total += scaled
    }
    return fixedAmount(total)
}
export function formatPurchaseOrderDecimal(value: string): string {
    if (typeof value !== "string" || !/^\d{1,40}(?:\.\d{1,8})?$/.test(value)) return "—"
    const [whole, fraction = ""] = value.split(".")
    const digits = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    const trimmed = fraction.replace(/0+$/, "")
    return trimmed ? `${digits}.${trimmed}` : digits
}
export function comparePurchaseOrderDecimals(left: string, right: string): number {
    const a = scaledDecimal(left, 8, 40)
    const b = scaledDecimal(right, 8, 40)
    return a === null || b === null || a === b ? 0 : a < b ? -1 : 1
}
