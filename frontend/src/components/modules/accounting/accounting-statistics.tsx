"use client"

import { memo } from "react"
import {
    AlertTriangle,
    Boxes,
    Coins,
    Factory,
    ShoppingCart,
    TrendingUp,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
    formatCurrency,
    formatSignedCurrency,
    type AccountingOverview,
} from "@/components/modules/accounting/accounting.schema"

export const AccountingStatistics = memo(function AccountingStatistics({
    summary,
}: {
    summary: AccountingOverview["summary"]
}) {
    const currency = summary.currencyCode

    const cards = [
        {
            title: "Inventory Asset Value",
            value: formatCurrency(summary.totalInventoryAssetValue, currency),
            badge: `${summary.costedLotsCount} costed batches`,
            helper: "What all current stock is worth at batch or reference cost.",
            detail: `Raw ${formatCurrency(summary.rawMaterialAssetValue, currency)} · Finished ${formatCurrency(summary.finishedGoodsAssetValue, currency)}`,
            icon: Boxes,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10",
        },
        {
            title: "PO Commitments",
            value: formatCurrency(summary.purchaseCommittedValue, currency),
            badge: `Open ${formatCurrency(summary.purchaseOutstandingValue, currency)}`,
            helper: "Total agreed spending on active supplier orders.",
            detail: `Received so far: ${formatCurrency(summary.purchaseReceivedValue, currency)}${summary.totalInputVat && Number.parseFloat(summary.totalInputVat) > 0 ? ` (incl. Input VAT ${formatCurrency(summary.totalInputVat, currency)})` : ""}`,
            icon: ShoppingCart,
            color: "text-sky-600 dark:text-sky-400",
            bg: "bg-sky-500/10",
        },
        {
            title: "Production Material Cost",
            value: formatCurrency(summary.totalProductionCost, currency),
            badge: "Packing Roll-Up",
            helper: "Bulk spice, packaging, and label cost absorbed into packed goods.",
            detail: `${summary.uncostedLotsCount} lot(s) using reference cost`,
            icon: Factory,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10",
        },
        {
            title: "Delivered Sales Revenue",
            value: formatCurrency(summary.totalDeliveredRevenue, currency),
            badge: `Booked ${formatCurrency(summary.totalBookedRevenue, currency)}`,
            helper: "Sales earned from completed customer deliveries.",
            detail:
                summary.totalOutputVat && Number.parseFloat(summary.totalOutputVat) > 0
                    ? `Ex-VAT Net · + Output VAT ${formatCurrency(summary.totalOutputVat, currency)}`
                    : "Booked includes open & in-transit orders",
            icon: Coins,
            color: "text-teal-600 dark:text-teal-400",
            bg: "bg-teal-500/10",
        },
        {
            title: "COGS & Gross Profit",
            value: formatCurrency(summary.grossProfit, currency),
            badge:
                summary.grossMarginPercent !== null
                    ? `${summary.grossMarginPercent}% margin`
                    : "No deliveries yet",
            helper: "Delivered Sales minus batch Cost of Goods Sold (COGS).",
            detail: `Delivered COGS: ${formatCurrency(summary.totalDeliveredCogs, currency)}`,
            icon: TrendingUp,
            color: "text-primary",
            bg: "bg-primary/10",
        },
        {
            title: "Scrap & Count Variances",
            value: formatCurrency(summary.scrapLossValue, currency),
            badge: `Adj ${formatSignedCurrency(summary.adjustmentNetValue, currency)}`,
            helper: "Stock value lost to scrap/spoilage plus net count corrections.",
            detail: "Negative adjustments reduce asset value",
            icon: AlertTriangle,
            color: "text-rose-600 dark:text-rose-400",
            bg: "bg-rose-500/10",
        },
    ]

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
                const Icon = card.icon
                return (
                    <Card key={card.title} className="border py-0 shadow-xs">
                        <CardContent className="p-3.5">
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                    {card.title}
                                </span>
                                <div
                                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${card.bg}`}
                                >
                                    <Icon className={`size-4 ${card.color}`} />
                                </div>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
                                <span className="text-lg font-bold tracking-tight tabular-nums sm:text-xl">
                                    {card.value}
                                </span>
                                <Badge variant="secondary" className="text-[10px] font-medium tabular-nums">
                                    {card.badge}
                                </Badge>
                            </div>
                            <p className="mt-1.5 text-xs text-muted-foreground">{card.helper}</p>
                            <p className="mt-1.5 border-t border-border/50 pt-1.5 text-[11px] font-medium text-foreground tabular-nums">
                                {card.detail}
                            </p>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
})
