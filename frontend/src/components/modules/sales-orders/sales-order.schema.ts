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
    vatRatePercent: z.string().optional(),
    netAmount: amount.optional(),
    vatAmount: amount.optional(),
    lineTotal: amount,
})
export const salesOrderSchema = z.object({
    salesOrderId: id,
    salesOrderNumber: z.string(),
    customerPoNumber: z.string().max(100).nullable(),
    customerId: id,
    customerName: z.string(),
    customerIsActive: z.boolean(),
    orderDate: z.iso.date(),
    requestedDeliveryDate: z.iso.date().nullable(),
    notes: z.string().nullable(),
    status: z.enum(SALES_ORDER_STATUSES),
    netAmount: amount.optional(),
    vatAmount: amount.optional(),
    totalAmount: amount,
    lineCount: z.int().nonnegative(),
    lines: z.array(salesOrderLineSchema),
    createdBy: id.nullable(),
    updatedBy: id.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})
export const salesOrderOptionsSchema = z.object({
    sourceLocations: z.array(
        z.object({
            locationId: id,
            code: z.string(),
            name: z.string(),
            isActive: z.boolean(),
        }),
    ),
    customers: z.array(
        z.object({ customerId: id, name: z.string(), isActive: z.boolean() }),
    ),
    items: z.array(
        z.object({
            itemId: id,
            sku: z.string(),
            name: z.string(),
            primaryUomId: id,
            primaryUomName: z.string(),
            isVatable: z.boolean().optional(),
            isActive: z.boolean(),
            unitCost: decimal.optional(),
        }),
    ),
    defaultVatRatePercent: z.string().optional(),
})
const vatRate = z
    .string()
    .trim()
    .regex(
        /^(?:100(?:\.00?)?|\d{1,2}(?:\.\d{1,2})?)$/,
        "Enter a VAT percentage between 0 and 100 (up to 2 decimals).",
    )
export const salesOrderInputSchema = z
    .strictObject({
        salesOrderNumber: z
            .string()
            .trim()
            .min(1, "Enter a sales order number.")
            .max(30)
            .toUpperCase(),
        customerPoNumber: z.string().trim().max(100).nullable().optional(),
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
                    vatRatePercent: vatRate.optional(),
                }),
            )
            .min(1, "Add at least one item.")
            .max(100),
    })
    .superRefine((input, context) => {
        if (
            input.requestedDeliveryDate &&
            input.requestedDeliveryDate < input.orderDate
        )
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
    customerPoNumber: string
    customerId: number | null
    orderDate: string
    requestedDeliveryDate: string
    notes: string
    lines: {
        itemId: number | null
        uomId: number | null
        qtyOrdered: string
        unitPrice: string
        vatRatePercent?: string
    }[]
}
export type SalesOrderFormErrors = Record<string, string>
export function toSalesOrderInput(
    values: SalesOrderFormValues,
): CreateSalesOrderInput {
    return salesOrderInputSchema.parse(formInput(values))
}
export function validateSalesOrder(
    values: SalesOrderFormValues,
    options: SalesOrderOptions,
): SalesOrderFormErrors {
    const errors: SalesOrderFormErrors = {}
    const result = salesOrderInputSchema.safeParse(formInput(values))
    if (!result.success)
        for (const issue of result.error.issues)
            errors[issue.path.join(".")] ??= issue.message
    if (
        !options.customers.some(
            (customer) =>
                customer.customerId === values.customerId && customer.isActive,
        )
    )
        errors.customerId = "Select an active customer."
    values.lines.forEach((line, index) => {
        const item = options.items.find(
            (candidate) =>
                candidate.itemId === line.itemId && candidate.isActive,
        )
        if (!item)
            errors[`lines.${index}.itemId`] =
                "Select an active finished product."
        if (item && item.primaryUomId !== line.uomId)
            errors[`lines.${index}.itemId`] =
                "Reselect this item to use its primary unit."
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
export function previewSalesTaxSummary(
    lines: SalesOrderFormValues["lines"],
): { netAmount: string; vatAmount: string; totalAmount: string } | null {
    if (
        lines.some(
            (line) =>
                !positive.safeParse(line.qtyOrdered).success ||
                !decimal.safeParse(line.unitPrice).success,
        )
    )
        return null
    let netTotal = BigInt(0)
    let vatTotal = BigInt(0)
    for (const line of lines) {
        const net =
            (scaled(line.qtyOrdered, 4) * scaled(line.unitPrice, 4) +
                BigInt(5000)) /
            BigInt(10000)
        const rate = (line.vatRatePercent ?? "0.00").trim()
        const bps = /^\d{1,3}(?:\.\d{1,2})?$/.test(rate)
            ? scaled(rate, 2)
            : BigInt(0)
        const clampedBps = bps > BigInt(10000) ? BigInt(10000) : bps
        const vat =
            (net * clampedBps + BigInt(5000)) / BigInt(10000)
        netTotal += net
        vatTotal += vat
    }
    return {
        netAmount: formatSalesUnits4(netTotal),
        vatAmount: formatSalesUnits4(vatTotal),
        totalAmount: formatSalesUnits4(netTotal + vatTotal),
    }
}
export function previewSalesTotal(
    lines: SalesOrderFormValues["lines"],
): string | null {
    return previewSalesTaxSummary(lines)?.totalAmount ?? null
}

export type LineStockCoverage = {
    available: string
    onHand: string
    reserved: string
    fromStock: string | null
    toPack: string | null
    isCovered: boolean | null
}

export function formatSalesUnits4(units: bigint): string {
    const negative = units < BigInt(0)
    const abs = negative ? -units : units
    const digits = abs.toString().padStart(5, "0")
    return `${negative ? "-" : ""}${digits.slice(0, -4)}.${digits.slice(-4)}`
}

export function parseStockUnits4(value: string): bigint {
    const trimmed = value.trim()
    if (!/^-?\d+(?:\.\d{1,4})?$/.test(trimmed)) return BigInt(0)
    const negative = trimmed.startsWith("-")
    const unsigned = negative ? trimmed.slice(1) : trimmed
    const units = scaled(unsigned, 4)
    return negative ? -units : units
}

export function summarizeLineStockCoverage(
    qtyOrdered: string,
    availableUnits: bigint,
    onHandUnits: bigint,
    reservedUnits: bigint,
): LineStockCoverage {
    const clampedAvailable = availableUnits < BigInt(0) ? BigInt(0) : availableUnits
    const orderedUnits = positive.safeParse(qtyOrdered.trim()).success
        ? scaled(qtyOrdered.trim(), 4)
        : null
    if (orderedUnits === null) {
        return {
            available: formatSalesDecimal(formatSalesUnits4(clampedAvailable)),
            onHand: formatSalesDecimal(formatSalesUnits4(onHandUnits)),
            reserved: formatSalesDecimal(formatSalesUnits4(reservedUnits)),
            fromStock: null,
            toPack: null,
            isCovered: null,
        }
    }
    const fromStockUnits =
        clampedAvailable < orderedUnits ? clampedAvailable : orderedUnits
    const toPackUnits = orderedUnits - fromStockUnits
    return {
        available: formatSalesDecimal(formatSalesUnits4(clampedAvailable)),
        onHand: formatSalesDecimal(formatSalesUnits4(onHandUnits)),
        reserved: formatSalesDecimal(formatSalesUnits4(reservedUnits)),
        fromStock: formatSalesDecimal(formatSalesUnits4(fromStockUnits)),
        toPack: formatSalesDecimal(formatSalesUnits4(toPackUnits)),
        isCovered: toPackUnits === BigInt(0),
    }
}

function formInput(values: SalesOrderFormValues) {
    return {
        ...values,
        customerPoNumber: values.customerPoNumber.trim() || null,
        requestedDeliveryDate: values.requestedDeliveryDate.trim() || null,
        notes: values.notes.trim() || null,
        lines: values.lines.map(({ itemId, uomId, qtyOrdered, unitPrice, vatRatePercent }) => ({
            itemId,
            uomId,
            qtyOrdered: qtyOrdered.trim(),
            unitPrice: unitPrice.trim(),
            ...(vatRatePercent !== undefined && vatRatePercent.trim() !== ""
                ? { vatRatePercent: vatRatePercent.trim() }
                : {}),
        })),
    }
}

const planQuantity = z.string().regex(/^\d+(?:\.\d{1,8})?$/)
export const salesMaterialPlanSchema = z.object({
    salesOrderId: id,
    salesOrderNumber: z.string(),
    customerPoNumber: z.string().nullable(),
    sourceLocationId: id,
    sourceLocationName: z.string(),
    advisory: z.literal(true),
    products: z.array(
        z.object({
            salesOrderLineId: id,
            itemId: id,
            itemSku: z.string(),
            itemName: z.string(),
            uomName: z.string(),
            qtyDemand: planQuantity,
            qtyFinishedAvailable: planQuantity,
            qtyFromStock: planQuantity,
            qtyToPack: planQuantity,
            issue: z.string().nullable(),
        }),
    ),
    materials: z.array(
        z.object({
            itemId: id,
            itemSku: z.string(),
            itemName: z.string(),
            uomName: z.string(),
            qtyRequired: planQuantity,
            qtyAvailable: planQuantity,
            qtyShortage: planQuantity,
            suppliers: z.array(z.object({ supplierId: id, name: z.string() })),
        }),
    ),
    canPack: z.boolean(),
})
export type SalesMaterialPlan = z.output<typeof salesMaterialPlanSchema>
