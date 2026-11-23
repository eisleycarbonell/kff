import type {
    DashboardActivePackingOrder,
    DashboardPendingPurchaseOrder,
    DashboardRecentActivity,
    DashboardStockByLocation,
    DashboardStockByType,
} from "./dashboard.schema.ts"

export type CategoryChartKey = "raw" | "hardware" | "labels" | "finished"

export const STOCK_CATEGORY_META: Record<
    DashboardStockByType["itemType"],
    { key: CategoryChartKey; label: string }
> = {
    "Raw Material - Bulk": { key: "raw", label: "Raw Materials" },
    "Packaging - Hardware": { key: "hardware", label: "Hardware" },
    "Packaging - Label": { key: "labels", label: "Labels" },
    "Finished Good": { key: "finished", label: "Finished Goods" },
}

export type CategoryDistributionDatum = {
    category: CategoryChartKey
    label: string
    itemType: DashboardStockByType["itemType"]
    value: number
    totalValueRaw: string
    itemCount: number
    fill: string
}

export type LocationChartDatum = {
    locationId: number
    code: string
    name: string
    shortName: string
    locationType: string
    itemCount: number
}

export type PurchaseOrderChartDatum = {
    poId: number
    poNumber: string
    supplierName: string
    status: string
    receivedAmount: number
    outstandingAmount: number
    receivedRaw: string
    outstandingRaw: string
    totalRaw: string
}

export type LedgerActivityChartDatum = {
    transactionType: string
    count: number
}

export type PackingProgressChartDatum = {
    packingOrderNumber: string
    itemName: string
    actualQty: number
    remainingQty: number
}

function toChartNumber(value: string): number {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function buildCategoryDistributionChart(
    stockByType: readonly DashboardStockByType[],
): CategoryDistributionDatum[] {
    const byType = new Map(stockByType.map((entry) => [entry.itemType, entry]))
    const orderedTypes: DashboardStockByType["itemType"][] = [
        "Raw Material - Bulk",
        "Packaging - Hardware",
        "Packaging - Label",
        "Finished Good",
    ]

    return orderedTypes.map((itemType) => {
        const meta = STOCK_CATEGORY_META[itemType]
        const row = byType.get(itemType)
        return {
            category: meta.key,
            label: meta.label,
            itemType,
            value: row ? toChartNumber(row.totalValue) : 0,
            totalValueRaw: row?.totalValue ?? "0",
            itemCount: row?.itemCount ?? 0,
            fill: `var(--color-${meta.key})`,
        }
    })
}

export function buildLocationChart(
    stockByLocation: readonly DashboardStockByLocation[],
    limit = 6,
): LocationChartDatum[] {
    return [...stockByLocation]
        .sort((a, b) => b.itemCount - a.itemCount || a.locationName.localeCompare(b.locationName))
        .slice(0, limit)
        .map((loc) => ({
            locationId: loc.locationId,
            code: loc.locationCode,
            name: loc.locationName,
            shortName:
                loc.locationName.length > 16
                    ? `${loc.locationName.slice(0, 15)}…`
                    : loc.locationName,
            locationType: loc.locationType,
            itemCount: loc.itemCount,
        }))
}

export function buildPurchaseOrderChart(
    pendingPurchaseOrders: readonly DashboardPendingPurchaseOrder[],
    limit = 6,
): PurchaseOrderChartDatum[] {
    return pendingPurchaseOrders.slice(0, limit).map((po) => ({
        poId: po.poId,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        status: po.status,
        receivedAmount: toChartNumber(po.receivedAmount),
        outstandingAmount: toChartNumber(po.outstandingAmount),
        receivedRaw: po.receivedAmount,
        outstandingRaw: po.outstandingAmount,
        totalRaw: po.totalAmount,
    }))
}

export function buildLedgerActivityChart(
    recentActivity: readonly DashboardRecentActivity[],
): LedgerActivityChartDatum[] {
    const counts = new Map<string, number>()
    for (const entry of recentActivity) {
        counts.set(
            entry.transactionType,
            (counts.get(entry.transactionType) ?? 0) + 1,
        )
    }

    return Array.from(counts.entries())
        .map(([transactionType, count]) => ({ transactionType, count }))
        .sort((a, b) => b.count - a.count || a.transactionType.localeCompare(b.transactionType))
}

export function buildPackingProgressChart(
    packingOrders: readonly DashboardActivePackingOrder[],
    limit = 6,
): PackingProgressChartDatum[] {
    return packingOrders.slice(0, limit).map((order) => {
        const target = toChartNumber(order.targetQty)
        const actual = toChartNumber(order.actualQty)
        return {
            packingOrderNumber: order.packingOrderNumber,
            itemName: order.itemName,
            actualQty: actual,
            remainingQty: Math.max(0, target - actual),
        }
    })
}
