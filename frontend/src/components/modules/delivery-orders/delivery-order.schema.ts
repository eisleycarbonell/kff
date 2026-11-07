import { z } from "zod"

export const DELIVERY_ORDER_STATUSES = ["Draft", "In Transit", "Completed", "Cancelled"] as const
const id = z.int().positive().max(2_147_483_647)
const timestamp = z.iso.datetime({ offset: true })
const quantity = z.string().regex(/^\d+\.\d{4}$/)
const signedQuantity = z.string().regex(/^-?\d+\.\d{4}$/)
export const deliveryOrderSchema = z.object({
    deliveryOrderId: id,
    deliveryOrderNumber: z.string(),
    salesOrderId: id,
    salesOrderNumber: z.string(),
    customerId: id,
    customerName: z.string(),
    sourceLocationId: id,
    sourceLocationName: z.string(),
    transitLocationId: id.nullable(),
    transitLocationName: z.string().nullable(),
    deliveryDate: z.iso.date(),
    notes: z.string().nullable(),
    status: z.enum(DELIVERY_ORDER_STATUSES),
    dispatchedAt: timestamp.nullable(),
    completedAt: timestamp.nullable(),
    createdBy: id.nullable(),
    updatedBy: id.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
    lines: z.array(
        z.object({
            deliveryOrderLineId: id,
            deliveryOrderId: id,
            salesOrderLineId: id,
            itemId: id,
            itemSku: z.string(),
            itemName: z.string(),
            lotId: id,
            lotNumber: z.string(),
            uomId: id,
            uomName: z.string(),
            qtyDelivered: quantity,
        }),
    ),
})
export const deliveryOrderOptionsSchema = z.object({
    salesOrders: z.array(
        z.object({
            salesOrderId: id,
            salesOrderNumber: z.string(),
            customerName: z.string(),
            orderDate: z.iso.date(),
            lines: z.array(
                z.object({
                    salesOrderLineId: id,
                    itemId: id,
                    itemSku: z.string(),
                    itemName: z.string(),
                    uomId: id,
                    uomName: z.string(),
                    qtyOrdered: quantity,
                    qtyDelivered: quantity,
                    qtyAllocated: quantity,
                    qtyRemaining: quantity,
                }),
            ),
        }),
    ),
    locations: z.array(
        z.object({
            locationId: id,
            name: z.string(),
            locationType: z.string(),
            isActive: z.boolean(),
        }),
    ),
    stock: z.array(
        z.object({
            stockId: id,
            itemId: id,
            itemSku: z.string(),
            itemName: z.string(),
            lotId: id,
            lotNumber: z.string(),
            locationId: id,
            qtyOnHand: quantity,
            qtyReserved: quantity,
            qtyAvailable: signedQuantity,
            uomId: id,
            uomName: z.string(),
            qcStatus: z.string(),
            expirationDate: z.iso.date().nullable(),
            packingOrderId: id.nullable(),
        }),
    ),
})
export type DeliveryOrder = z.output<typeof deliveryOrderSchema>
export type DeliveryOrderOptions = z.output<typeof deliveryOrderOptionsSchema>
export type DeliveryOrderFormValues = {
    deliveryOrderNumber: string
    salesOrderId: number | null
    sourceLocationId: number | null
    deliveryDate: string
    notes: string
    lines: { salesOrderLineId: number; lotId: number; qtyDelivered: string }[]
}
export type CreateDeliveryOrderInput = Omit<
    DeliveryOrderFormValues,
    "salesOrderId" | "sourceLocationId" | "notes"
> & {
    salesOrderId: number
    sourceLocationId: number
    notes: string | null
}
export type UpdateDeliveryOrderInput = Partial<CreateDeliveryOrderInput>
export type DeliveryOrderFormErrors = Partial<Record<keyof DeliveryOrderFormValues, string>>

export function quantityUnits(value: string): bigint | null {
    if (!/^-?\d{1,10}(?:\.\d{1,4})?$/.test(value)) return null
    const negative = value.startsWith("-")
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".")
    const units = BigInt(whole + fraction.padEnd(4, "0"))
    return negative ? -units : units
}
export function formatDeliveryQuantity(value: string) {
    const [whole, fraction = ""] = value.split(".")
    const digits = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    const decimals = fraction.replace(/0+$/, "")
    return decimals ? `${digits}.${decimals}` : digits
}
export function remainingAllocation(
    line: DeliveryOrderOptions["salesOrders"][number]["lines"][number],
    existing: DeliveryOrder | null,
) {
    const own =
        existing?.lines
            .filter((row) => row.salesOrderLineId === line.salesOrderLineId)
            .reduce(
                (sum, row) => sum + (quantityUnits(row.qtyDelivered) ?? BigInt(0)),
                BigInt(0),
            ) ?? BigInt(0)
    return (
        (quantityUnits(line.qtyRemaining) ?? BigInt(0)) -
        (quantityUnits(line.qtyAllocated) ?? BigInt(0)) +
        own
    )
}
export function unitsToQuantity(value: bigint) {
    const negative = value < BigInt(0)
    const digits = (negative ? -value : value).toString().padStart(5, "0")
    return `${negative ? "-" : ""}${digits.slice(0, -4)}.${digits.slice(-4)}`
}
export function validateDeliveryOrder(
    values: DeliveryOrderFormValues,
    options: DeliveryOrderOptions,
    existing: DeliveryOrder | null,
): DeliveryOrderFormErrors {
    const errors: DeliveryOrderFormErrors = {}
    if (!values.deliveryOrderNumber.trim() || values.deliveryOrderNumber.trim().length > 30)
        errors.deliveryOrderNumber = "Enter a delivery number of up to 30 characters."
    const order = options.salesOrders.find((row) => row.salesOrderId === values.salesOrderId)
    if (!order) errors.salesOrderId = "Select a confirmed sales order."
    if (
        !options.locations.some(
            (row) =>
                row.locationId === values.sourceLocationId &&
                row.isActive &&
                ["Warehouse", "Branch", "Store"].includes(row.locationType),
        )
    )
        errors.sourceLocationId = "Select an active warehouse, branch or store."
    if (!z.iso.date().safeParse(values.deliveryDate).success)
        errors.deliveryDate = "Enter a valid delivery date."
    else if (order && values.deliveryDate < order.orderDate)
        errors.deliveryDate = "Delivery date cannot precede the sales order date."
    if (values.notes.length > 5000) errors.notes = "Use up to 5,000 characters."
    if (values.lines.length < 1 || values.lines.length > 100)
        errors.lines = "Add between 1 and 100 lot allocations."
    else if (new Set(values.lines.map((line) => line.lotId)).size !== values.lines.length)
        errors.lines = "Select each finished-product lot only once."
    else {
        const totals = new Map<number, bigint>()
        for (const line of values.lines) {
            const amount = quantityUnits(line.qtyDelivered.trim())
            const orderLine = order?.lines.find(
                (row) => row.salesOrderLineId === line.salesOrderLineId,
            )
            const stock = options.stock.find(
                (row) =>
                    row.lotId === line.lotId &&
                    row.locationId === values.sourceLocationId &&
                    row.itemId === orderLine?.itemId &&
                    row.qcStatus === "Approved" &&
                    row.packingOrderId !== null &&
                    (quantityUnits(row.qtyOnHand) ?? BigInt(0)) > BigInt(0) &&
                    (row.expirationDate === null ||
                        row.expirationDate > new Date().toISOString().slice(0, 10)),
            )
            if (amount === null || amount <= BigInt(0))
                errors.lines = "Enter positive quantities with up to four decimal places."
            else if (!orderLine || !stock)
                errors.lines = "Select a matching finished-product lot at the source location."
            else {
                totals.set(
                    line.salesOrderLineId,
                    (totals.get(line.salesOrderLineId) ?? BigInt(0)) + amount,
                )
                if (totals.get(line.salesOrderLineId)! > remainingAllocation(orderLine, existing))
                    errors.lines =
                        "Allocated quantities exceed the sales order's remaining unallocated quantity."
            }
        }
    }
    return errors
}
