import { z } from "zod"

export const QC_STATUSES = ["Quarantine", "Approved", "Rejected", "Expired"] as const
export const LOT_SOURCE_TYPES = ["Purchased", "Packed", "Opening Balance"] as const
const id = z.int().positive().max(2_147_483_647)
const timestamp = z.iso.datetime({ offset: true })
const decimal = z.string().regex(/^\d{1,10}(?:\.\d{1,4})?$/)
const quantity = z.string().regex(/^-?\d+\.\d{4}$/)
const locationType = z.enum([
    "Warehouse",
    "Packing",
    "Branch",
    "Store",
    "Quarantine",
    "Scrap",
    "In Transit",
])
export const lotSchema = z.object({
    lotId: id,
    lotNumber: z.string(),
    supplierLotNumber: z.string().nullable(),
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    itemType: z.enum([
        "Raw Material - Bulk",
        "Packaging - Hardware",
        "Packaging - Label",
        "Finished Good",
    ]),
    primaryUomId: id,
    primaryUomName: z.string(),
    manufactureDate: z.iso.date().nullable(),
    expirationDate: z.iso.date().nullable(),
    qcStatus: z.enum(QC_STATUSES),
    unitCost: decimal.nullable(),
    poLineId: id.nullable(),
    poId: id.nullable(),
    poNumber: z.string().nullable(),
    supplierId: id.nullable(),
    supplierName: z.string().nullable(),
    packingOrderId: id.nullable(),
    packingOrderNumber: z.string().nullable(),
    sourceType: z.enum(LOT_SOURCE_TYPES),
    qtyOnHand: quantity,
    qtyReserved: quantity,
    qtyAvailable: quantity,
    locationCount: z.int().nonnegative(),
    createdBy: id.nullable(),
    createdAt: timestamp,
    updatedBy: id.nullable(),
    updatedAt: timestamp,
})
export const lotDetailSchema = lotSchema.extend({
    stocks: z.array(
        z.object({
            stockId: id,
            locationId: id,
            locationCode: z.string(),
            locationName: z.string(),
            locationType,
            locationIsActive: z.boolean(),
            qtyOnHand: quantity,
            qtyReserved: quantity,
            qtyAvailable: quantity,
            lastUpdated: timestamp,
        }),
    ),
    transactions: z.array(
        z.object({
            transactionId: id,
            locationId: id,
            locationCode: z.string(),
            locationName: z.string(),
            qtyChange: quantity,
            transactionType: z.enum([
                "Receive",
                "Consume",
                "Produce",
                "Transfer",
                "Scrap",
                "Adjustment",
            ]),
            poLineId: id.nullable(),
            packingOrderId: id.nullable(),
            transferLineId: id.nullable(),
            referenceId: id.nullable(),
            authorizedByUserId: id,
            createdAt: timestamp,
        }),
    ),
})
export const lotUpdateSchema = z
    .strictObject({
        supplierLotNumber: z.string().trim().max(100).nullable().optional(),
        manufactureDate: z.iso.date().nullable().optional(),
        expirationDate: z.iso.date().nullable().optional(),
        qcStatus: z.enum(QC_STATUSES).optional(),
    })
    .superRefine((input, context) => {
        if (
            input.manufactureDate &&
            input.expirationDate &&
            input.expirationDate <= input.manufactureDate
        )
            context.addIssue({
                code: "custom",
                path: ["expirationDate"],
                message: "Expiration must be after manufacture.",
            })
    })
export type Lot = z.output<typeof lotSchema>
export type LotDetail = z.output<typeof lotDetailSchema>
export type UpdateLotInput = z.output<typeof lotUpdateSchema>
export type LotFormValues = {
    supplierLotNumber: string
    manufactureDate: string
    expirationDate: string
    qcStatus: (typeof QC_STATUSES)[number]
}
export type LotFormErrors = Partial<Record<keyof LotFormValues, string>>
export function toLotInput(values: LotFormValues, lot?: Lot | null): UpdateLotInput {
    const input = lotUpdateSchema.parse({
        supplierLotNumber: values.supplierLotNumber.trim() || null,
        manufactureDate: values.manufactureDate.trim() || null,
        expirationDate: values.expirationDate.trim() || null,
        qcStatus: values.qcStatus,
    })
    if (!lot) return input
    const changes: UpdateLotInput = {}
    if (input.supplierLotNumber !== lot.supplierLotNumber)
        changes.supplierLotNumber = input.supplierLotNumber
    if (input.manufactureDate !== lot.manufactureDate)
        changes.manufactureDate = input.manufactureDate
    if (input.expirationDate !== lot.expirationDate) changes.expirationDate = input.expirationDate
    if (input.qcStatus !== lot.qcStatus) changes.qcStatus = input.qcStatus
    return changes
}
export function lotHasReservations(lot: Lot): boolean {
    return (scaledQuantity(lot.qtyReserved) ?? BigInt(0)) > BigInt(0)
}
export function validateLot(values: LotFormValues, lot?: Lot | null): LotFormErrors {
    const errors: LotFormErrors = {}
    const input = {
        supplierLotNumber: values.supplierLotNumber.trim() || null,
        manufactureDate: values.manufactureDate.trim() || null,
        expirationDate: values.expirationDate.trim() || null,
        qcStatus: values.qcStatus,
    }
    const result = lotUpdateSchema.safeParse(input)
    if (!result.success)
        for (const issue of result.error.issues)
            errors[issue.path[0] as keyof LotFormValues] ??= issue.message
    if (
        input.manufactureDate &&
        input.expirationDate &&
        input.expirationDate <= input.manufactureDate
    )
        errors.expirationDate = "Expiration must be after manufacture."
    if (lot && lotHasReservations(lot)) {
        if (input.manufactureDate !== lot.manufactureDate)
            errors.manufactureDate = "Release active reservations before changing lot dates."
        if (input.expirationDate !== lot.expirationDate)
            errors.expirationDate = "Release active reservations before changing lot dates."
        if (input.qcStatus !== lot.qcStatus)
            errors.qcStatus = "Release active reservations before changing quality status."
    }
    return errors
}
function scaledQuantity(value: string): bigint | null {
    if (typeof value !== "string" || !/^-?\d+(?:\.\d{1,4})?$/.test(value)) return null
    const [whole, fraction = ""] = value.split(".")
    return BigInt(whole + fraction.padEnd(4, "0"))
}
export function compareLotDecimals(left: string, right: string): number {
    const a = scaledQuantity(left),
        b = scaledQuantity(right)
    return a === null || b === null || a === b ? 0 : a < b ? -1 : 1
}
export function formatLotDecimal(value: string): string {
    if (typeof value !== "string" || !/^-?\d+(?:\.\d{1,4})?$/.test(value)) return "—"
    const [whole, fraction = ""] = value.split(".")
    const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    const trimmed = fraction.replace(/0+$/, "")
    return trimmed ? `${formatted}.${trimmed}` : formatted
}
export function sumLotQuantities(values: string[]): string | null {
    let total = BigInt(0)
    for (const value of values) {
        const quantity = scaledQuantity(value)
        if (quantity === null) return null
        total += quantity
    }
    const negative = total < BigInt(0)
    const digits = (negative ? -total : total).toString().padStart(5, "0")
    return `${negative ? "-" : ""}${digits.slice(0, -4)}.${digits.slice(-4)}`
}
