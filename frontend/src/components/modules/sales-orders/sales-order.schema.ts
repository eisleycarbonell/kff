import { z } from "zod"

export const SALES_ORDER_STATUSES = [
    "Draft",
    "Confirmed",
    "Partially Delivered",
    "Completed",
    "Cancelled",
] as const
const id = z.int().positive().max(2_147_483_647)
const decimal = z.string().regex(/^\d{1,10}(?:\.\d{1,4})?$/)
const positive = decimal.refine(
    (value) => /[1-9]/.test(value),
    "Enter a quantity greater than zero.",
)
const amount = z.string().regex(/^\d{1,30}\.\d{4}$/)
const timestamp = z.iso.datetime({ offset: true })
export const salesOrderLineSchema = z.object({
    salesOrderLineId: id,
    salesOrderId: id,
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    uomId: id,
    uomName: z.string(),
    qtyOrdered: positive,
    qtyDelivered: decimal,
    qtyRemaining: decimal,
    qtyAllocated: decimal,
    unitPrice: decimal,
    lineTotal: amount,
})
export const salesOrderSchema = z.object({
    salesOrderId: id,
    salesOrderNumber: z.string(),
    customerId: id,
    customerName: z.string(),
    customerIsActive: z.boolean(),
    orderDate: z.iso.date(),
    requestedDeliveryDate: z.iso.date().nullable(),
    notes: z.string().nullable(),
    status: z.enum(SALES_ORDER_STATUSES),
    totalAmount: amount,
    lineCount: z.int().nonnegative(),
    lines: z.array(salesOrderLineSchema),
    createdBy: id.nullable(),
    updatedBy: id.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})
export const salesOrderOptionsSchema = z.object({
    customers: z.array(z.object({ customerId: id, name: z.string(), isActive: z.boolean() })),
    items: z.array(
        z.object({
            itemId: id,
            sku: z.string(),
            name: z.string(),
            primaryUomId: id,
            primaryUomName: z.string(),
            isActive: z.boolean(),
        }),
    ),
})
export const salesOrderInputSchema = z
    .strictObject({
        salesOrderNumber: z
            .string()
            .trim()
            .min(1, "Enter a sales order number.")
            .max(30)
            .toUpperCase(),
        customerId: id,
        orderDate: z.iso.date(),
        requestedDeliveryDate: z.iso.date().nullable().optional(),
        notes: z.string().trim().max(5000).nullable().optional(),
        lines: z
            .array(
                z.strictObject({
                    itemId: id,
                    uomId: id,
                    qtyOrdered: positive,
                    unitPrice: decimal,
                }),
            )
            .min(1, "Add at least one item.")
            .max(100),
    })
    .superRefine((input, context) => {
        if (input.requestedDeliveryDate && input.requestedDeliveryDate < input.orderDate)
            context.addIssue({
                code: "custom",
                path: ["requestedDeliveryDate"],
                message: "Requested delivery cannot be before the order date.",
            })
        const seen = new Set<number>()
        input.lines.forEach((line, index) => {
            if (seen.has(line.itemId))
                context.addIssue({
                    code: "custom",
                    path: ["lines", index, "itemId"],
                    message: "This item already appears on another line.",
                })
            seen.add(line.itemId)
        })
    })
export type SalesOrder = z.output<typeof salesOrderSchema>
export type SalesOrderOptions = z.output<typeof salesOrderOptionsSchema>
export type CreateSalesOrderInput = z.output<typeof salesOrderInputSchema>
export type UpdateSalesOrderInput = Partial<CreateSalesOrderInput>
export type SalesOrderFormValues = {
    salesOrderNumber: string
    customerId: number | null
    orderDate: string
    requestedDeliveryDate: string
    notes: string
    lines: {
        itemId: number | null
        uomId: number | null
        qtyOrdered: string
        unitPrice: string
    }[]
}
export type SalesOrderFormErrors = Record<string, string>
export function toSalesOrderInput(values: SalesOrderFormValues): CreateSalesOrderInput {
    return salesOrderInputSchema.parse(formInput(values))
}
export function validateSalesOrder(
    values: SalesOrderFormValues,
    options: SalesOrderOptions,
): SalesOrderFormErrors {
    const errors: SalesOrderFormErrors = {}
    const result = salesOrderInputSchema.safeParse(formInput(values))
    if (!result.success)
        for (const issue of result.error.issues) errors[issue.path.join(".")] ??= issue.message
    if (
        !options.customers.some(
            (customer) => customer.customerId === values.customerId && customer.isActive,
        )
    )
        errors.customerId = "Select an active customer."
    values.lines.forEach((line, index) => {
        const item = options.items.find(
            (candidate) => candidate.itemId === line.itemId && candidate.isActive,
        )
        if (!item) errors[`lines.${index}.itemId`] = "Select an active finished product."
        if (item && item.primaryUomId !== line.uomId)
            errors[`lines.${index}.itemId`] = "Reselect this item to use its primary unit."
    })
    return errors
}
export function formatSalesDecimal(value: string): string {
    const [whole, fraction = ""] = value.trim().split(".")
    const digits = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    const trimmed = fraction.replace(/0+$/, "")
    return trimmed ? `${digits}.${trimmed}` : digits
}
function scaled(value: string, places = 8): bigint {
    const [whole, fraction = ""] = value.trim().split(".")
    return BigInt(whole + fraction.padEnd(places, "0"))
}
export function compareSalesDecimals(left: string, right: string): number {
    const a = scaled(left),
        b = scaled(right)
    return a === b ? 0 : a < b ? -1 : 1
}
export function previewSalesTotal(lines: SalesOrderFormValues["lines"]): string | null {
    if (
        lines.some(
            (line) =>
                !positive.safeParse(line.qtyOrdered).success ||
                !decimal.safeParse(line.unitPrice).success,
        )
    )
        return null
    const total = lines.reduce(
        (sum, line) =>
            sum +
            (scaled(line.qtyOrdered, 4) * scaled(line.unitPrice, 4) + BigInt(5000)) / BigInt(10000),
        BigInt(0),
    )
    const digits = total.toString().padStart(5, "0")
    return `${digits.slice(0, -4)}.${digits.slice(-4)}`
}

function formInput(values: SalesOrderFormValues) {
    return {
        ...values,
        requestedDeliveryDate: values.requestedDeliveryDate.trim() || null,
        notes: values.notes.trim() || null,
        lines: values.lines.map(({ itemId, uomId, qtyOrdered, unitPrice }) => ({
            itemId,
            uomId,
            qtyOrdered: qtyOrdered.trim(),
            unitPrice: unitPrice.trim(),
        })),
    }
}
