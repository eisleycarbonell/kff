import { z } from "zod"

export const TRANSFER_STATUSES = ["Draft", "In Transit", "Completed", "Cancelled"] as const
const id = z.int().positive().max(2_147_483_647)
const timestamp = z.iso.datetime({ offset: true })
const quantity = z.string().regex(/^\d+\.\d{4}$/)
const quality = z.enum(["Quarantine", "Approved", "Rejected", "Expired"])
export const transferSchema = z.object({
    transferId: id,
    transferNumber: z.string(),
    sourceLocationId: id,
    sourceLocationCode: z.string(),
    sourceLocationName: z.string(),
    destinationLocationId: id,
    destinationLocationCode: z.string(),
    destinationLocationName: z.string(),
    status: z.enum(TRANSFER_STATUSES),
    requestedAt: timestamp,
    dispatchedAt: timestamp.nullable(),
    receivedAt: timestamp.nullable(),
    notes: z.string().nullable(),
    createdBy: id.nullable(),
    createdAt: timestamp,
    updatedBy: id.nullable(),
    updatedAt: timestamp,
    lineCount: z.int().nonnegative(),
    transitLocationId: id.nullable(),
})
export const transferDetailSchema = transferSchema.extend({
    lines: z.array(
        z.object({
            transferLineId: id,
            itemId: id,
            itemSku: z.string(),
            itemName: z.string(),
            lotId: id,
            lotNumber: z.string(),
            packingOrderId: id.nullable(),
            primaryUomId: id,
            primaryUomName: z.string(),
            qtyRequested: quantity,
            qtyShipped: quantity,
            qtyReceived: quantity,
            qtyOutstanding: quantity,
            expirationDate: z.iso.date().nullable(),
            qcStatus: quality,
        }),
    ),
})
export const transferOptionsSchema = z.object({
    locations: z.array(
        z.object({
            locationId: id,
            code: z.string(),
            name: z.string(),
            locationType: z.enum(["Warehouse", "Branch", "Store", "In Transit"]),
        }),
    ),
    stock: z.array(
        z.object({
            itemId: id,
            itemSku: z.string(),
            itemName: z.string(),
            lotId: id,
            lotNumber: z.string(),
            packingOrderId: id.nullable(),
            locationId: id,
            primaryUomId: id,
            primaryUomName: z.string(),
            qtyOnHand: quantity,
            qtyReserved: quantity,
            qtyAvailable: z.string().regex(/^-?\d+\.\d{4}$/),
            expirationDate: z.iso.date().nullable(),
            qcStatus: quality,
        }),
    ),
})
export type Transfer = z.output<typeof transferSchema>
export type TransferDetail = z.output<typeof transferDetailSchema>
export type TransferOptions = z.output<typeof transferOptionsSchema>
export type TransferFormValues = {
    transferNumber: string
    sourceLocationId: number | null
    destinationLocationId: number | null
    notes: string
    lines: { itemId: number; lotId: number; qtyRequested: string }[]
}
export type CreateTransferInput = Omit<
    TransferFormValues,
    "sourceLocationId" | "destinationLocationId" | "notes"
> & {
    sourceLocationId: number
    destinationLocationId: number
    notes: string | null
}
export type UpdateTransferInput = Partial<CreateTransferInput>
export type DispatchTransferInput = {
    transitLocationId: number
    lines: { transferLineId: number; qtyShipped: string }[]
}
export type ReceiveTransferInput = { lines: { transferLineId: number; qtyReceived: string }[] }
export type TransferFormErrors = Partial<Record<keyof TransferFormValues, string>>

export function decimalUnits(value: string): bigint | null {
    if (!/^\d{1,10}(?:\.\d{1,4})?$/.test(value)) return null
    const [whole, fraction = ""] = value.split(".")
    return BigInt(whole + fraction.padEnd(4, "0"))
}
export function compareTransferDecimals(left: string, right: string): number {
    function scaled(value: string) {
        const negative = value.startsWith("-")
        const [whole, fraction = ""] = value.replace(/^-/, "").split(".")
        const result = BigInt(whole + fraction.padEnd(4, "0"))
        return negative ? -result : result
    }
    const a = scaled(left),
        b = scaled(right)
    return a === b ? 0 : a < b ? -1 : 1
}
export function formatTransferDecimal(value: string): string {
    const [whole, fraction = ""] = value.split(".")
    const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    const trimmed = fraction.replace(/0+$/, "")
    return trimmed ? `${formatted}.${trimmed}` : formatted
}
export function validateTransfer(
    values: TransferFormValues,
    options: TransferOptions,
    existingTransfer?: TransferDetail | null,
): TransferFormErrors {
    const errors: TransferFormErrors = {}
    if (!values.transferNumber.trim() || values.transferNumber.trim().length > 30)
        errors.transferNumber = "Enter a transfer number of up to 30 characters."
    if (
        !options.locations.some(
            (row) => row.locationId === values.sourceLocationId && row.locationType === "Warehouse",
        )
    )
        errors.sourceLocationId = "Select an active source warehouse."
    if (
        !options.locations.some(
            (row) =>
                row.locationId === values.destinationLocationId &&
                row.locationType !== "In Transit",
        )
    )
        errors.destinationLocationId = "Select an active destination warehouse, branch or store."
    if (
        values.sourceLocationId !== null &&
        values.sourceLocationId === values.destinationLocationId
    )
        errors.destinationLocationId = "Choose a different destination location."
    if (values.notes.length > 5000) errors.notes = "Use up to 5,000 characters."
    if (values.lines.length < 1 || values.lines.length > 100)
        errors.lines = "Add between 1 and 100 finished-product lots."
    else if (new Set(values.lines.map((line) => line.lotId)).size !== values.lines.length)
        errors.lines = "Select each lot once."
    else if (
        values.lines.some(
            (line) => (decimalUnits(line.qtyRequested.trim()) ?? BigInt(0)) <= BigInt(0),
        )
    )
        errors.lines =
            "Enter a positive requested quantity with up to four decimal places for every lot."
    else if (
        values.lines.some(
            (line) =>
                !options.stock.some(
                    (row) =>
                        row.itemId === line.itemId &&
                        row.lotId === line.lotId &&
                        row.locationId === values.sourceLocationId,
                ) &&
                !(
                    existingTransfer?.sourceLocationId === values.sourceLocationId &&
                    existingTransfer.lines.some(
                        (row) => row.itemId === line.itemId && row.lotId === line.lotId,
                    )
                ),
        )
    )
        errors.lines = "Select available finished-product lots from the source warehouse."
    return errors
}
