import { z } from "zod"

const id = z.int().positive().max(2_147_483_647)
const signedQuantity = z.string().regex(/^-?\d{1,10}(?:\.\d{1,4})?$/)

export const MOVEMENT_TYPES = [
    "Receive",
    "Consume",
    "Produce",
    "Transfer",
    "Scrap",
    "Adjustment",
    "Sale",
] as const

export const inventoryMovementSchema = z.object({
    transactionId: id,
    transactionType: z.enum(MOVEMENT_TYPES),
    qtyChange: signedQuantity,
    createdAt: z.iso.datetime({ offset: true }),
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    primaryUomName: z.string(),
    lotId: id,
    lotNumber: z.string(),
    locationId: id,
    locationCode: z.string(),
    locationName: z.string(),
    reasonCode: z.string().nullable(),
    referenceId: z.string().nullable(),
    poLineId: id.nullable(),
    poNumber: z.string().nullable(),
    packingOrderId: id.nullable(),
    packingOrderNumber: z.string().nullable(),
    transferLineId: id.nullable(),
    transferNumber: z.string().nullable(),
    authorizedByUserId: id,
    actorFirstName: z.string(),
    actorLastName: z.string(),
})

export type InventoryMovement = z.output<typeof inventoryMovementSchema>
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export function movementSource(row: InventoryMovement): string {
    return row.poNumber ?? row.packingOrderNumber ?? row.transferNumber ?? row.referenceId ?? "—"
}

export function movementQuantityUnits(value: string): bigint {
    const negative = value.startsWith("-")
    const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".")
    const units = BigInt(whole) * BigInt(10_000) + BigInt(fraction.padEnd(4, "0"))
    return negative ? -units : units
}
