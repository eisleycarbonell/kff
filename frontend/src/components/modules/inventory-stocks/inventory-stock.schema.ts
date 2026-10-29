import { z } from "zod"

export const QC_STATUSES = ["Quarantine", "Approved", "Rejected", "Expired"] as const
export const LOCATION_TYPES = [
    "Warehouse",
    "Packing",
    "Branch",
    "Store",
    "Quarantine",
    "Scrap",
    "In Transit",
] as const
const id = z.int().positive().max(2_147_483_647)
const quantity = z.string().regex(/^\d+(?:\.\d{1,4})?$/)
const signedQuantity = z.string().regex(/^-?\d+(?:\.\d{1,4})?$/)
const countedQuantity = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,4})?$/, "Enter a non-negative quantity with up to 4 decimal places.")
export const stockSchema = z.object({
    stockId: id,
    itemId: id,
    sku: z.string(),
    itemName: z.string(),
    itemType: z.enum([
        "Raw Material - Bulk",
        "Packaging - Hardware",
        "Packaging - Label",
        "Finished Good",
    ]),
    primaryUomId: id,
    primaryUomName: z.string(),
    lotId: id,
    lotNumber: z.string(),
    supplierLotNumber: z.string().nullable(),
    manufactureDate: z.iso.date().nullable(),
    expirationDate: z.iso.date().nullable(),
    qcStatus: z.enum(QC_STATUSES),
    lotUnitCost: countedQuantity.nullable(),
    locationId: id,
    locationCode: z.string(),
    locationName: z.string(),
    locationType: z.enum(LOCATION_TYPES),
    qtyOnHand: countedQuantity,
    qtyReserved: quantity,
    qtyAvailable: signedQuantity,
    lastUpdated: z.iso.datetime({ offset: true }),
})
export const stockOptionsSchema = z.object({
    lots: z.array(
        z.object({
            lotId: id,
            lotNumber: z.string(),
            itemId: id,
            itemName: z.string(),
            sku: z.string(),
            primaryUomName: z.string(),
        }),
    ),
    locations: z.array(
        z.object({
            locationId: id,
            name: z.string(),
            code: z.string(),
            locationType: z.enum(LOCATION_TYPES),
            isActive: z.boolean(),
        }),
    ),
    reasons: z.array(
        z.object({ reasonId: id, codeName: z.string(), description: z.string().nullable() }),
    ),
})
export const adjustmentInputSchema = z.strictObject({
    lotId: id,
    locationId: id,
    reasonId: id,
    expectedQtyOnHand: countedQuantity,
    qtyOnHand: countedQuantity,
    referenceId: z.string().trim().min(1).max(60).nullable(),
})
export const adjustmentResultSchema = z.object({
    stock: stockSchema,
    transactionId: id,
    qtyChange: signedQuantity,
})
export type Stock = z.output<typeof stockSchema>
export type StockOptions = z.output<typeof stockOptionsSchema>
export type StockAdjustmentInput = z.output<typeof adjustmentInputSchema>
export type AdjustmentFormValues = Omit<
    StockAdjustmentInput,
    "lotId" | "locationId" | "reasonId" | "referenceId"
> & {
    lotId: number | null
    locationId: number | null
    reasonId: number | null
    referenceId: string
}
export type AdjustmentFormErrors = Partial<Record<keyof AdjustmentFormValues, string>>
const SCALE = BigInt(10_000)
export function quantityUnits(value: string): bigint {
    const negative = value.startsWith("-")
    const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".")
    const units = BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, "0"))
    return negative ? -units : units
}
function quantityString(units: bigint): string {
    const absolute = units < BigInt(0) ? -units : units
    return `${units < BigInt(0) ? "-" : ""}${absolute / SCALE}.${(absolute % SCALE).toString().padStart(4, "0")}`
}
const integerFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 0 })
export function formatStockQuantity(value: string): string {
    const units = quantityUnits(value)
    const absolute = units < BigInt(0) ? -units : units
    const fraction = (absolute % SCALE).toString().padStart(4, "0").replace(/0+$/, "")
    return `${units < BigInt(0) ? "-" : ""}${integerFormat.format(absolute / SCALE)}${fraction ? `.${fraction}` : ""}`
}
export function compareStockQuantities(left: string, right: string): number {
    const a = quantityUnits(left),
        b = quantityUnits(right)
    return a < b ? -1 : a > b ? 1 : 0
}
export function stockTotalsByUom(stocks: Stock[]) {
    const groups = new Map<
        number,
        {
            uomId: number
            uomName: string
            qtyOnHand: bigint
            qtyReserved: bigint
            qtyAvailable: bigint
        }
    >()
    for (const stock of stocks) {
        const group = groups.get(stock.primaryUomId) ?? {
            uomId: stock.primaryUomId,
            uomName: stock.primaryUomName,
            qtyOnHand: BigInt(0),
            qtyReserved: BigInt(0),
            qtyAvailable: BigInt(0),
        }
        group.qtyOnHand += quantityUnits(stock.qtyOnHand)
        group.qtyReserved += quantityUnits(stock.qtyReserved)
        group.qtyAvailable += quantityUnits(stock.qtyAvailable)
        groups.set(group.uomId, group)
    }
    return [...groups.values()]
        .sort((a, b) => a.uomName.localeCompare(b.uomName))
        .map((group) => ({
            uomId: group.uomId,
            uomName: group.uomName,
            qtyOnHand: quantityString(group.qtyOnHand),
            qtyReserved: quantityString(group.qtyReserved),
            qtyAvailable: quantityString(group.qtyAvailable),
        }))
}
export function toStockAdjustment(values: AdjustmentFormValues): StockAdjustmentInput {
    return adjustmentInputSchema.parse({
        ...values,
        referenceId: values.referenceId.trim() || null,
    })
}
export function validateStockAdjustment(
    values: AdjustmentFormValues,
    options: StockOptions,
    reserved: string,
): AdjustmentFormErrors {
    const result = adjustmentInputSchema.safeParse({
        ...values,
        referenceId: values.referenceId.trim() || null,
    })
    const errors: AdjustmentFormErrors = {}
    if (!result.success)
        for (const issue of result.error.issues)
            errors[issue.path[0] as keyof AdjustmentFormValues] ??= issue.message
    if (!options.lots.some((lot) => lot.lotId === values.lotId))
        errors.lotId = "Select an existing lot."
    if (
        !options.locations.some(
            (location) => location.locationId === values.locationId && location.isActive,
        )
    )
        errors.locationId = "Select an active location."
    if (!options.reasons.some((reason) => reason.reasonId === values.reasonId))
        errors.reasonId = "Select an adjustment reason."
    if (result.success) {
        if (compareStockQuantities(result.data.qtyOnHand, reserved) < 0)
            errors.qtyOnHand = "Counted quantity cannot be below active reservations."
        else if (compareStockQuantities(result.data.qtyOnHand, result.data.expectedQtyOnHand) === 0)
            errors.qtyOnHand = "Enter a count that differs from the current balance."
    }
    return errors
}
