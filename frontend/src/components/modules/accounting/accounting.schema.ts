import { z } from "zod"
import {
    ITEM_TYPES,
    formatCurrency,
    formatDate,
    formatQuantity,
} from "@/components/modules/dashboard/dashboard.schema"

export { ITEM_TYPES, formatCurrency, formatDate, formatQuantity }

const id = z.int().positive().max(2_147_483_647)
const decimal = z.string().trim().regex(/^-?\d+(?:\.\d+)?$/)
const timestamp = z.iso.datetime({ offset: true })

export const COST_BASES = [
    "Purchase Actual",
    "Packing Roll-Up",
    "Catalog Reference",
] as const

export const accountingFilterSchema = z
    .object({
        fromDate: z.string().default(""),
        toDate: z.string().default(""),
    })
    .superRefine((value, ctx) => {
        if (value.fromDate && value.toDate && value.fromDate > value.toDate) {
            ctx.addIssue({
                code: "custom",
                path: ["toDate"],
                message: "End date must follow start date.",
            })
        }
    })

export type AccountingFilters = z.output<typeof accountingFilterSchema>

export const accountingSummarySchema = z.object({
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    totalInventoryAssetValue: decimal,
    rawMaterialAssetValue: decimal,
    packagingAssetValue: decimal,
    finishedGoodsAssetValue: decimal,
    purchaseCommittedNetValue: decimal.optional(),
    purchaseCommittedVatValue: decimal.optional(),
    purchaseCommittedValue: decimal,
    purchaseReceivedNetValue: decimal.optional(),
    totalInputVat: decimal.optional(),
    purchaseReceivedValue: decimal,
    purchaseOutstandingValue: decimal,
    totalProductionCost: decimal,
    totalBookedRevenue: decimal,
    totalBookedOutputVat: decimal.optional(),
    totalBookedBilling: decimal.optional(),
    totalDeliveredRevenue: decimal,
    totalOutputVat: decimal.optional(),
    totalDeliveredBilling: decimal.optional(),
    netVatPayable: decimal.optional(),
    totalDeliveredCogs: decimal,
    grossProfit: decimal,
    grossMarginPercent: decimal.nullable(),
    scrapLossValue: decimal,
    adjustmentNetValue: decimal,
    costedLotsCount: z.number().int().nonnegative(),
    uncostedLotsCount: z.number().int().nonnegative(),
    vatRatePercent: z.string().optional(),
})

export const accountingCategoryValuationSchema = z.object({
    itemType: z.enum(ITEM_TYPES),
    itemCount: z.number().int().nonnegative(),
    lotCount: z.number().int().nonnegative(),
    assetValue: decimal,
    sharePercent: decimal.nullable(),
})

export const accountingLocationValuationSchema = z.object({
    locationId: id,
    locationCode: z.string(),
    locationName: z.string(),
    locationType: z.string(),
    itemCount: z.number().int().nonnegative(),
    lotCount: z.number().int().nonnegative(),
    assetValue: decimal,
})

export const accountingLotCostingSchema = z.object({
    lotId: id,
    lotNumber: z.string(),
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    itemType: z.enum(ITEM_TYPES),
    primaryUomName: z.string(),
    sourceType: z.enum(["Purchase", "Packing", "Opening"]),
    sourceReference: z.string(),
    supplierName: z.string().nullable(),
    purchaseUnitPrice: decimal.nullable(),
    purchaseUomName: z.string().nullable(),
    catalogUnitCost: decimal,
    lotUnitCost: decimal.nullable(),
    effectiveUnitCost: decimal,
    costBasis: z.enum(COST_BASES),
    unitVariance: decimal,
    qtyOnHand: decimal,
    assetValue: decimal,
    qcStatus: z.string(),
    createdAt: timestamp,
})

export const accountingPackingComponentSchema = z.object({
    componentSku: z.string(),
    componentName: z.string(),
    qtyConsumed: decimal,
    uomName: z.string(),
    unitCost: decimal,
    totalCost: decimal,
})

export const accountingPackingCostingSchema = z.object({
    packingOrderId: id,
    packingOrderNumber: z.string(),
    status: z.string(),
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    primaryUomName: z.string(),
    targetQty: decimal,
    actualQty: decimal,
    consumedMaterialCost: decimal,
    finishedLotNumber: z.string().nullable(),
    recordedLotUnitCost: decimal.nullable(),
    computedUnitCost: decimal.nullable(),
    catalogUnitCost: decimal,
    unitVariance: decimal,
    scheduledDate: z.string().nullable(),
    completedAt: timestamp.nullable(),
    components: z.array(accountingPackingComponentSchema),
})

export const accountingSalesCostingSchema = z.object({
    salesOrderId: id,
    salesOrderNumber: z.string(),
    customerPoNumber: z.string().nullable(),
    customerName: z.string(),
    status: z.string(),
    orderDate: z.string(),
    bookedRevenue: decimal,
    bookedVatAmount: decimal.optional(),
    bookedBilling: decimal.optional(),
    deliveredRevenue: decimal,
    deliveredVatAmount: decimal.optional(),
    deliveredBilling: decimal.optional(),
    deliveredCogs: decimal,
    grossProfit: decimal,
    grossMarginPercent: decimal.nullable(),
    deliveryCount: z.number().int().nonnegative(),
    completedDeliveryCount: z.number().int().nonnegative(),
})

export const accountingPurchasingCostingSchema = z.object({
    poId: id,
    poNumber: z.string(),
    supplierName: z.string(),
    status: z.string(),
    orderDate: timestamp,
    expectedDeliveryDate: z.string().nullable(),
    lineCount: z.number().int().nonnegative(),
    netAmount: decimal.optional(),
    vatAmount: decimal.optional(),
    totalAmount: decimal,
    receivedNetAmount: decimal.optional(),
    receivedVatAmount: decimal.optional(),
    receivedAmount: decimal,
    outstandingAmount: decimal,
})

export const accountingCostLedgerSchema = z.object({
    transactionId: id,
    createdAt: timestamp,
    transactionType: z.string(),
    referenceId: z.string().nullable(),
    itemSku: z.string(),
    itemName: z.string(),
    lotNumber: z.string(),
    locationName: z.string(),
    primaryUomName: z.string(),
    qtyChange: decimal,
    effectiveUnitCost: decimal,
    costBasis: z.string(),
    totalCostImpact: decimal,
    authorizedByName: z.string(),
})

export const accountingOverviewSchema = z.object({
    generatedAt: timestamp,
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    summary: accountingSummarySchema,
    valuationByCategory: z.array(accountingCategoryValuationSchema),
    valuationByLocation: z.array(accountingLocationValuationSchema),
    lotCosting: z.array(accountingLotCostingSchema),
    packingCosting: z.array(accountingPackingCostingSchema),
    salesCosting: z.array(accountingSalesCostingSchema),
    purchasingCosting: z.array(accountingPurchasingCostingSchema),
    costLedger: z.array(accountingCostLedgerSchema),
})

export type AccountingOverview = z.output<typeof accountingOverviewSchema>
export type AccountingLotCosting = z.output<typeof accountingLotCostingSchema>
export type AccountingPackingCosting = z.output<typeof accountingPackingCostingSchema>
export type AccountingSalesCosting = z.output<typeof accountingSalesCostingSchema>
export type AccountingPurchasingCosting = z.output<typeof accountingPurchasingCostingSchema>
export type AccountingCostLedger = z.output<typeof accountingCostLedgerSchema>

export function formatSignedCurrency(
    value: string,
    currencyCode = "PHP",
): string {
    const trimmed = value.trim()
    const num = Number.parseFloat(trimmed)
    if (!Number.isFinite(num) || num === 0) return formatCurrency("0", currencyCode)
    return num > 0
        ? `+${formatCurrency(trimmed, currencyCode)}`
        : formatCurrency(trimmed, currencyCode)
}

export function buildAccountingQueryString(filters: AccountingFilters): string {
    const params = new URLSearchParams()
    if (filters.fromDate.trim()) params.set("fromDate", filters.fromDate.trim())
    if (filters.toDate.trim()) params.set("toDate", filters.toDate.trim())
    const text = params.toString()
    return text ? `?${text}` : ""
}
