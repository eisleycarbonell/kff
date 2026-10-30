import { z } from "zod"

export const PACKING_STATUSES = [
    "Draft",
    "Planned",
    "In Progress",
    "Completed",
    "Cancelled",
] as const
const id = z.int().positive().max(2_147_483_647)
const timestamp = z.iso.datetime({ offset: true })
const quantity = z.string().regex(/^\d+\.\d{4}$/)
const signedQuantity = z.string().regex(/^-?\d+\.\d{4}$/)
export const packingOrderSchema = z.object({
    packingOrderId: id,
    packingOrderNumber: z.string(),
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    primaryUomId: id,
    primaryUomName: z.string(),
    targetQty: quantity,
    actualQty: quantity,
    status: z.enum(PACKING_STATUSES),
    sourceLocationId: id,
    sourceLocationCode: z.string(),
    sourceLocationName: z.string(),
    destinationLocationId: id,
    destinationLocationCode: z.string(),
    destinationLocationName: z.string(),
    scheduledDate: z.iso.date().nullable(),
    startedAt: timestamp.nullable(),
    completedAt: timestamp.nullable(),
    notes: z.string().nullable(),
    createdBy: id.nullable(),
    createdAt: timestamp,
    updatedBy: id.nullable(),
    updatedAt: timestamp,
    materialCount: z.int().nonnegative(),
})
export const reservationSchema = z.object({
    reservationId: id,
    packingOrderMaterialId: id,
    packingOrderId: id,
    packingOrderNumber: z.string(),
    orderStatus: z.enum(PACKING_STATUSES),
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    primaryUomId: id,
    primaryUomName: z.string(),
    lotId: id,
    lotNumber: z.string(),
    locationId: id,
    locationCode: z.string(),
    locationName: z.string(),
    qtyReserved: quantity,
    qtyConsumed: quantity,
    qtyOutstanding: quantity,
    releasedAt: timestamp.nullable(),
    expirationDate: z.iso.date().nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
})
export const packingDetailSchema = packingOrderSchema.extend({
    materials: z.array(
        z.object({
            packingOrderMaterialId: id,
            itemId: id,
            itemSku: z.string(),
            itemName: z.string(),
            uomId: id,
            uomName: z.string(),
            requiredQty: quantity,
            consumedQty: quantity,
            qtyReserved: quantity,
        }),
    ),
    reservations: reservationSchema.array(),
    finishedLots: z.array(
        z.object({
            lotId: id,
            lotNumber: z.string(),
            qcStatus: z.enum(["Quarantine", "Approved", "Rejected", "Expired"]),
            manufactureDate: z.iso.date().nullable(),
            expirationDate: z.iso.date().nullable(),
        }),
    ),
})
export const packingOptionsSchema = z.object({
    items: z.array(
        z.object({
            itemId: id,
            sku: z.string(),
            name: z.string(),
            primaryUomId: id,
            primaryUomName: z.string(),
            hasBom: z.boolean(),
        }),
    ),
    locations: z.array(
        z.object({
            locationId: id,
            code: z.string(),
            name: z.string(),
            locationType: z.enum(["Warehouse", "Packing"]),
        }),
    ),
})
export const packingPreviewSchema = z.object({
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    primaryUomId: id,
    primaryUomName: z.string(),
    targetQty: quantity,
    sourceLocationId: id,
    maxProducible: quantity,
    canPlan: z.boolean(),
    materials: z.array(
        z.object({
            itemId: id,
            itemSku: z.string(),
            itemName: z.string(),
            uomId: id,
            uomName: z.string(),
            requiredQty: quantity,
            qtyOnHand: quantity,
            qtyReserved: quantity,
            qtyAvailable: signedQuantity,
            maxProducible: quantity,
            shortageQty: quantity,
        }),
    ),
})
export type PackingOrder = z.output<typeof packingOrderSchema>
export type PackingDetail = z.output<typeof packingDetailSchema>
export type Reservation = z.output<typeof reservationSchema>
export type PackingOptions = z.output<typeof packingOptionsSchema>
export type PackingPreview = z.output<typeof packingPreviewSchema>
export type PackingFormValues = {
    packingOrderNumber: string
    itemId: number | null
    targetQty: string
    sourceLocationId: number | null
    destinationLocationId: number | null
    scheduledDate: string
    notes: string
}
export type CreatePackingInput = {
    packingOrderNumber: string
    itemId: number
    targetQty: string
    sourceLocationId: number
    destinationLocationId: number
    scheduledDate: string | null
    notes: string | null
}
export type UpdatePackingInput = Pick<
    CreatePackingInput,
    "packingOrderNumber" | "destinationLocationId" | "scheduledDate" | "notes"
>
export type CompletePackingInput = {
    actualQty: string
    lotNumber: string
    manufactureDate: string | null
    expirationDate: string | null
}
export type PreviewPackingInput = Pick<
    CreatePackingInput,
    "itemId" | "sourceLocationId" | "targetQty"
>
export type PackingFormErrors = Partial<Record<keyof PackingFormValues, string>>
export function decimalUnits(value: string): bigint | null {
    if (!/^\d{1,10}(?:\.\d{1,4})?$/.test(value)) return null
    const [whole, fraction = ""] = value.split(".")
    return BigInt(whole + fraction.padEnd(4, "0"))
}
function quantityUnits(value: string): bigint | null {
    if (!/^-?\d+(?:\.\d{1,4})?$/.test(value)) return null
    const negative = value.startsWith("-")
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".")
    const result = BigInt(whole + fraction.padEnd(4, "0"))
    return negative ? -result : result
}
export function comparePackingDecimals(a: string, b: string): number {
    const left = quantityUnits(a),
        right = quantityUnits(b)
    return left === null || right === null || left === right ? 0 : left < right ? -1 : 1
}
export function formatPackingDecimal(value: string): string {
    const [whole, fraction = ""] = value.split(".")
    const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    const trimmed = fraction.replace(/0+$/, "")
    return trimmed ? `${formatted}.${trimmed}` : formatted
}
export function validatePacking(
    values: PackingFormValues,
    options: PackingOptions,
    editing = false,
): PackingFormErrors {
    const errors: PackingFormErrors = {}
    if (!values.packingOrderNumber.trim() || values.packingOrderNumber.trim().length > 30)
        errors.packingOrderNumber = "Enter an order number of up to 30 characters."
    if (!editing) {
        const item = options.items.find((row) => row.itemId === values.itemId)
        if (!item?.hasBom) errors.itemId = "Select a finished product with a valid packing formula."
        if ((decimalUnits(values.targetQty.trim()) ?? BigInt(0)) <= BigInt(0))
            errors.targetQty = "Enter a positive quantity with up to 4 decimal places."
        if (!options.locations.some((row) => row.locationId === values.sourceLocationId))
            errors.sourceLocationId = "Select an active source location."
    }
    if (!options.locations.some((row) => row.locationId === values.destinationLocationId))
        errors.destinationLocationId = "Select an active destination location."
    if (
        values.sourceLocationId !== null &&
        values.sourceLocationId === values.destinationLocationId
    )
        errors.destinationLocationId = "Choose a different destination location."
    if (values.scheduledDate && !z.iso.date().safeParse(values.scheduledDate).success)
        errors.scheduledDate = "Enter a valid scheduled date."
    if (values.notes.length > 5000) errors.notes = "Use up to 5,000 characters."
    return errors
}
export function reservationStatus(row: Reservation): string {
    if (comparePackingDecimals(row.qtyConsumed, row.qtyReserved) === 0) return "Consumed"
    return row.releasedAt ? "Released" : "Active"
}
