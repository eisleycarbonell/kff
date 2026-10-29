import { z } from "zod"

const id = z.int().positive().max(2_147_483_647)
const decimal = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,4})?$/, "Use up to 10 whole digits and 4 decimal places.")
const positiveDecimal = decimal.refine(
    (value) => /[1-9]/.test(value),
    "Enter a quantity greater than zero.",
)
const factor = z
    .string()
    .regex(/^\d{1,10}\.\d{8}$/)
    .refine((value) => /[1-9]/.test(value))
const itemType = z.enum([
    "Raw Material - Bulk",
    "Packaging - Hardware",
    "Packaging - Label",
    "Finished Good",
])
const qcStatus = z.enum(["Quarantine", "Approved", "Rejected", "Expired"])
const locationType = z.enum([
    "Warehouse",
    "Packing",
    "Branch",
    "Store",
    "Quarantine",
    "Scrap",
    "In Transit",
])
const timestamp = z.iso.datetime({ offset: true })

export const receivingReceiptSchema = z.object({
    transactionId: id,
    lotId: id,
    lotNumber: z.string(),
    supplierLotNumber: z.string().nullable(),
    poId: id,
    poNumber: z.string(),
    poLineId: id,
    supplierId: id,
    supplierName: z.string(),
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    itemType,
    locationId: id,
    locationCode: z.string(),
    locationName: z.string(),
    purchaseUomId: id,
    purchaseUomName: z.string(),
    primaryUomId: id,
    primaryUomName: z.string(),
    qtyReceived: positiveDecimal.nullable(),
    qtyPrimary: positiveDecimal,
    unitPrice: decimal,
    unitCost: decimal.nullable(),
    qcStatus,
    manufactureDate: z.iso.date().nullable(),
    expirationDate: z.iso.date().nullable(),
    authorizedByUserId: id,
    createdAt: timestamp,
})
export const receivingOrderLineSchema = z.object({
    poLineId: id,
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    itemType,
    itemIsActive: z.boolean(),
    requiresQc: z.boolean(),
    uomId: id,
    uomName: z.string(),
    purchaseUomFactor: factor,
    primaryUomId: id,
    primaryUomName: z.string(),
    primaryUomFactor: factor,
    qtyOrdered: positiveDecimal,
    qtyReceived: decimal,
    qtyRemaining: decimal,
    unitPrice: decimal,
})
export const receivingOrderSchema = z.object({
    poId: id,
    poNumber: z.string(),
    supplierId: id,
    supplierName: z.string(),
    status: z.enum(["Sent", "Partially Received"]),
    lines: z.array(receivingOrderLineSchema),
})
export const receivingOptionsSchema = z.object({
    orders: z.array(receivingOrderSchema),
    locations: z.array(
        z.object({
            locationId: id,
            code: z.string(),
            name: z.string(),
            locationType,
            isActive: z.boolean(),
        }),
    ),
})
export const receivingResultSchema = z.object({
    receipts: z.array(receivingReceiptSchema),
    poId: id,
    poStatus: z.enum(["Partially Received", "Completed"]),
})
export const receivingLineInputSchema = z.strictObject({
    poLineId: id,
    qtyReceived: positiveDecimal,
    expectedQtyReceived: decimal,
    lotNumber: z.string().trim().min(1, "Enter a new lot number.").max(100).toUpperCase(),
    supplierLotNumber: z.string().trim().max(100).nullable().optional(),
    locationId: id,
    manufactureDate: z.iso.date().nullable().optional(),
    expirationDate: z.iso.date().nullable().optional(),
})
export const receivingInputSchema = z
    .strictObject({
        poId: id,
        lines: z
            .array(receivingLineInputSchema)
            .min(1, "Add at least one lot.")
            .max(100, "Use at most 100 lots."),
    })
    .superRefine((input, context) => {
        const lotNumbers = new Set<string>()
        const snapshots = new Map<number, bigint>()
        input.lines.forEach((line, index) => {
            if (lotNumbers.has(line.lotNumber))
                context.addIssue({
                    code: "custom",
                    path: ["lines", index, "lotNumber"],
                    message: "Each entry needs a distinct new lot number.",
                })
            lotNumbers.add(line.lotNumber)
            if (
                line.manufactureDate &&
                line.expirationDate &&
                line.expirationDate <= line.manufactureDate
            )
                context.addIssue({
                    code: "custom",
                    path: ["lines", index, "expirationDate"],
                    message: "Expiration must be after manufacture.",
                })
            const snapshot = scaled(line.expectedQtyReceived, 4)
            if (snapshot !== null) {
                if (snapshots.has(line.poLineId) && snapshots.get(line.poLineId) !== snapshot)
                    context.addIssue({
                        code: "custom",
                        path: ["lines", index, "expectedQtyReceived"],
                        message: "Split lots must use the same starting received quantity.",
                    })
                snapshots.set(line.poLineId, snapshot)
            }
        })
    })
export type ReceivingReceipt = z.output<typeof receivingReceiptSchema>
export type ReceivingOrder = z.output<typeof receivingOrderSchema>
export type ReceivingOrderLine = z.output<typeof receivingOrderLineSchema>
export type ReceivingOptions = z.output<typeof receivingOptionsSchema>
export type ReceivingResult = z.output<typeof receivingResultSchema>
export type ReceivingInput = z.output<typeof receivingInputSchema>
export type ReceivingLineFormValues = {
    poLineId: number | null
    qtyReceived: string
    expectedQtyReceived: string
    lotNumber: string
    supplierLotNumber: string
    locationId: number | null
    manufactureDate: string
    expirationDate: string
}
export type ReceivingFormValues = { poId: number | null; lines: ReceivingLineFormValues[] }
export type ReceivingLineFormErrors = Partial<Record<keyof ReceivingLineFormValues, string>>
export type ReceivingFormErrors = {
    poId?: string
    lines?: string
    lineErrors?: ReceivingLineFormErrors[]
}
export const createEmptyReceivingLine = (): ReceivingLineFormValues => ({
    poLineId: null,
    qtyReceived: "",
    expectedQtyReceived: "",
    lotNumber: "",
    supplierLotNumber: "",
    locationId: null,
    manufactureDate: "",
    expirationDate: "",
})

function formInput(values: ReceivingFormValues) {
    return {
        poId: values.poId,
        lines: values.lines.map((line) => ({
            poLineId: line.poLineId,
            qtyReceived: line.qtyReceived,
            expectedQtyReceived: line.expectedQtyReceived,
            lotNumber: line.lotNumber,
            supplierLotNumber: line.supplierLotNumber.trim() || null,
            locationId: line.locationId,
            manufactureDate: line.manufactureDate.trim() || null,
            expirationDate: line.expirationDate.trim() || null,
        })),
    }
}
export function toReceivingInput(values: ReceivingFormValues): ReceivingInput {
    return receivingInputSchema.parse(formInput(values))
}
export function validateReceipt(
    values: ReceivingFormValues,
    options: ReceivingOptions,
): ReceivingFormErrors {
    const errors: ReceivingFormErrors = {}
    const lineErrors: ReceivingLineFormErrors[] = []
    const result = receivingInputSchema.safeParse(formInput(values))
    if (!result.success)
        for (const issue of result.error.issues) {
            if (
                issue.path[0] === "lines" &&
                typeof issue.path[1] === "number" &&
                typeof issue.path[2] === "string"
            ) {
                const fields = (lineErrors[issue.path[1]] ??= {})
                fields[issue.path[2] as keyof ReceivingLineFormValues] ??= issue.message
            } else errors[issue.path[0] as "poId" | "lines"] ??= issue.message
        }
    const order = options.orders.find((candidate) => candidate.poId === values.poId)
    if (!order) errors.poId = "Select a sent or partially received purchase order."
    const totals = new Map<number, bigint>()
    values.lines.forEach((line) => {
        const quantity = scaled(line.qtyReceived, 4)
        if (line.poLineId !== null && quantity !== null)
            totals.set(line.poLineId, (totals.get(line.poLineId) ?? BigInt(0)) + quantity)
    })
    values.lines.forEach((line, index) => {
        const fields = lineErrors[index] ?? {}
        const source = order?.lines.find((candidate) => candidate.poLineId === line.poLineId)
        if (!source || !source.itemIsActive || source.itemType === "Finished Good")
            fields.poLineId = "Select an active material from this purchase order."
        if (source) {
            if (scaled(line.expectedQtyReceived, 4) !== scaled(source.qtyReceived, 4))
                fields.expectedQtyReceived =
                    "Received quantities changed. Review and use the latest purchase order balances."
            const remaining = scaled(source.qtyRemaining, 4)
            if (remaining !== null && (totals.get(source.poLineId) ?? BigInt(0)) > remaining)
                fields.qtyReceived =
                    "The total across these lots exceeds the purchase order's remaining quantity."
            if (
                calculateReceiptPrimaryQuantity(
                    line.qtyReceived,
                    source.purchaseUomFactor,
                    source.primaryUomFactor,
                ) === null &&
                !fields.qtyReceived
            )
                fields.qtyReceived =
                    "Use a quantity that converts exactly to four decimal places within the inventory range."
            if (
                calculateReceiptUnitCost(
                    source.unitPrice,
                    source.purchaseUomFactor,
                    source.primaryUomFactor,
                ) === null
            )
                fields.poLineId = "The converted unit cost exceeds the inventory cost range."
        }
        if (
            !options.locations.some(
                (location) =>
                    location.locationId === line.locationId &&
                    location.isActive &&
                    (location.locationType === "Warehouse" ||
                        location.locationType === "Quarantine"),
            )
        )
            fields.locationId = "Select an active warehouse or quarantine location."
        if (Object.keys(fields).length) lineErrors[index] = fields
    })
    if (lineErrors.some((fields) => fields && Object.keys(fields).length))
        errors.lineErrors = lineErrors
    return errors
}

function scaled(value: string, places: number): bigint | null {
    if (
        typeof value !== "string" ||
        !new RegExp(`^\\d{1,10}(?:\\.\\d{1,${places}})?$`).test(value.trim())
    )
        return null
    const [whole, fraction = ""] = value.trim().split(".")
    return BigInt(whole + fraction.padEnd(places, "0"))
}
function fixed4(value: bigint): string {
    const negative = value < BigInt(0)
    const digits = (negative ? -value : value).toString().padStart(5, "0")
    return `${negative ? "-" : ""}${digits.slice(0, -4)}.${digits.slice(-4)}`
}
const maxDecimal = BigInt("99999999999999")
export function calculateReceiptPrimaryQuantity(
    qtyReceived: string,
    purchaseFactor: string,
    primaryFactor: string,
): string | null {
    const quantity = scaled(qtyReceived, 4),
        purchase = scaled(purchaseFactor, 8),
        primary = scaled(primaryFactor, 8)
    if (
        quantity === null ||
        quantity <= BigInt(0) ||
        purchase === null ||
        purchase <= BigInt(0) ||
        primary === null ||
        primary <= BigInt(0)
    )
        return null
    const numerator = quantity * purchase
    if (numerator % primary !== BigInt(0)) return null
    const result = numerator / primary
    return result <= BigInt(0) || result > maxDecimal ? null : fixed4(result)
}
export function calculateReceiptUnitCost(
    unitPrice: string,
    purchaseFactor: string,
    primaryFactor: string,
): string | null {
    const price = scaled(unitPrice, 4),
        purchase = scaled(purchaseFactor, 8),
        primary = scaled(primaryFactor, 8)
    if (
        price === null ||
        purchase === null ||
        purchase <= BigInt(0) ||
        primary === null ||
        primary <= BigInt(0)
    )
        return null
    const result = (price * primary * BigInt(2) + purchase) / (purchase * BigInt(2))
    return result > maxDecimal ? null : fixed4(result)
}
export function formatReceivingDecimal(value: string): string {
    if (typeof value !== "string" || !/^-?\d+(?:\.\d{1,8})?$/.test(value)) return "—"
    const [whole, fraction = ""] = value.split(".")
    const digits = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    const trimmed = fraction.replace(/0+$/, "")
    return trimmed ? `${digits}.${trimmed}` : digits
}
function aggregateQuantity(value: string): bigint | null {
    if (typeof value !== "string" || !/^-?\d+(?:\.\d{1,4})?$/.test(value)) return null
    const [whole, fraction = ""] = value.split(".")
    return BigInt(whole + fraction.padEnd(4, "0"))
}
export function compareReceivingDecimals(left: string, right: string): number {
    const a = aggregateQuantity(left),
        b = aggregateQuantity(right)
    return a === null || b === null || a === b ? 0 : a < b ? -1 : 1
}
export function sumReceivingQuantities(values: string[]): string | null {
    let total = BigInt(0)
    for (const value of values) {
        const quantity = aggregateQuantity(value)
        if (quantity === null) return null
        total += quantity
    }
    return fixed4(total)
}
