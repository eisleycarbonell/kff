import { z } from "zod"
export const REPORT_TYPES = [
    "stock-by-location",
    "stock-by-lot",
    "low-stock",
    "near-expiry",
    "movement",
] as const
export type ReportType = (typeof REPORT_TYPES)[number]
export const REPORT_LABELS: Record<ReportType, string> = {
    "stock-by-location": "Stock by Location",
    "stock-by-lot": "Stock by Lot",
    "low-stock": "Low Stock",
    "near-expiry": "Near Expiry",
    movement: "Inventory Movement",
}
export const ITEM_TYPES = [
    "Raw Material - Bulk",
    "Packaging - Hardware",
    "Packaging - Label",
    "Finished Good",
] as const
export const MOVEMENT_TYPES = [
    "Receive",
    "Consume",
    "Produce",
    "Transfer",
    "Scrap",
    "Adjustment",
    "Sale",
] as const
export const QC_STATUSES = ["Quarantine", "Approved", "Rejected", "Expired"] as const
const id = z.int().positive().max(2147483647)
const decimal = z.string().regex(/^-?\d+(?:\.\d{1,4})?$/)
export type ReportFilters = {
    report: ReportType
    itemId?: number
    locationId?: number
    brandId?: number
    itemType?: (typeof ITEM_TYPES)[number]
    qcStatus?: (typeof QC_STATUSES)[number]
    q?: string
    threshold?: string
    expiryDays?: number
    includeExpired?: boolean
    fromDate?: string
    toDate?: string
    transactionType?: (typeof MOVEMENT_TYPES)[number]
}
export const reportRowSchema = z.object({
    rowId: z.string(),
    reorderLevel: z.string().optional(),
    itemId: id,
    sku: z.string(),
    itemName: z.string(),
    itemType: z.enum(ITEM_TYPES),
    brandId: id.nullable(),
    brandName: z.string().nullable(),
    primaryUomId: id,
    primaryUomName: z.string(),
    isActive: z.boolean(),
    locationId: id.nullable(),
    locationCode: z.string().nullable(),
    locationName: z.string().nullable(),
    locationType: z.string().nullable(),
    lotId: id.nullable(),
    lotNumber: z.string().nullable(),
    lotCount: z.int().nonnegative(),
    qcStatus: z.string().nullable(),
    expirationDate: z.iso.date().nullable(),
    daysToExpiry: z.int().nullable(),
    qtyOnHand: decimal.nullable(),
    qtyReserved: decimal.nullable(),
    qtyAvailable: decimal.nullable(),
    transactionId: id.nullable(),
    transactionType: z.enum(MOVEMENT_TYPES).nullable(),
    qtyChange: decimal.nullable(),
    occurredAt: z.iso.datetime({ offset: true }).nullable(),
    sourceReference: z.string().nullable(),
    referenceId: z.string().nullable(),
    actorName: z.string().nullable(),
    reasonCode: z.string().nullable(),
})
export const reportSchema = z.object({
    report: z.enum(REPORT_TYPES),
    generatedAt: z.iso.datetime({ offset: true }),
    asOfDate: z.iso.date(),
    filters: z.object({
        report: z.enum(REPORT_TYPES),
        itemId: id.optional(),
        locationId: id.optional(),
        brandId: id.optional(),
        itemType: z.enum(ITEM_TYPES).optional(),
        qcStatus: z.enum(QC_STATUSES).optional(),
        q: z.string().optional(),
        threshold: decimal,
        expiryDays: z.int().min(0).max(3650),
        includeExpired: z.boolean(),
        fromDate: z.iso.date().optional(),
        toDate: z.iso.date().optional(),
        transactionType: z.enum(MOVEMENT_TYPES).optional(),
    }),
    rows: z.array(reportRowSchema),
    summary: z.object({
        rowCount: z.int().nonnegative(),
        itemCount: z.int().nonnegative(),
        lotCount: z.int().nonnegative(),
        locationCount: z.int().nonnegative(),
    }),
    totals: z.array(
        z.object({
            primaryUomId: id,
            primaryUomName: z.string(),
            qtyOnHand: decimal,
            qtyReserved: decimal,
            qtyAvailable: decimal,
            qtyIn: decimal,
            qtyOut: decimal,
            netChange: decimal,
        }),
    ),
})
export const reportOptionsSchema = z.object({
    items: z.array(z.object({ itemId: id, sku: z.string(), name: z.string() })),
    locations: z.array(z.object({ locationId: id, code: z.string(), name: z.string() })),
    brands: z.array(z.object({ brandId: id, name: z.string() })),
})
export type InventoryReport = z.output<typeof reportSchema>
export type InventoryReportRow = z.output<typeof reportRowSchema>
export type ReportOptions = z.output<typeof reportOptionsSchema>
export function reportQuery(filters: ReportFilters) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters))
        if (value !== undefined && value !== "") params.set(key, String(value))
    return params.toString()
}
export function decimalUnits(value: string): bigint {
    const negative = value.startsWith("-")
    const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".")
    const result = BigInt(whole) * BigInt(10000) + BigInt(fraction.padEnd(4, "0"))
    return negative ? -result : result
}
export function reportCsv(report: InventoryReport, rows: InventoryReportRow[]) {
    return [
        ["Report", REPORT_LABELS[report.report]],
        ["Generated at (UTC)", report.generatedAt],
        ["Filters", reportQuery(report.filters)],
        [],
        [
            "SKU",
            "Item",
            "Type",
            "Brand",
            "Primary UOM",
            "Location code",
            "Location",
            "Lot",
            "Lot count",
            "QC",
            "Expiration date",
            "Days to expiry",
            "On hand",
            "Reserved",
            "Available",
            "Transaction ID",
            "Movement type",
            "Quantity change",
            "Occurred at (UTC)",
            "Source document",
            "Reference",
            "Recorded by",
            "Reason",
            "Effective reorder level",
        ],
        ...rows.map((row) => [
            row.sku,
            row.itemName,
            row.itemType,
            row.brandName ?? "",
            row.primaryUomName,
            row.locationCode ?? "",
            row.locationName ?? "",
            row.lotNumber ?? "",
            String(row.lotCount),
            row.qcStatus ?? "",
            row.expirationDate ?? "",
            row.daysToExpiry === null ? "" : String(row.daysToExpiry),
            row.qtyOnHand ?? "",
            row.qtyReserved ?? "",
            row.qtyAvailable ?? "",
            row.transactionId === null ? "" : String(row.transactionId),
            row.transactionType ?? "",
            row.qtyChange ?? "",
            row.occurredAt ?? "",
            row.sourceReference ?? "",
            row.referenceId ?? "",
            row.actorName ?? "",
            row.reasonCode ?? "",
            row.reorderLevel ?? "",
        ]),
    ]
}
