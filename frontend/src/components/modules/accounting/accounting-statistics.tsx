"use client"

import { memo, useMemo } from "react"
import { Boxes, Coins, TrendingUp, Wallet } from "lucide-react"
import { computeSimpleAccountingSummary } from "@/components/modules/accounting/accounting-engine"
import {
    formatCurrency,
    type AccountingOverview,
} from "@/components/modules/accounting/accounting.schema"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export const AccountingStatistics = memo(function AccountingStatistics({
    overview,
}: {
    overview: AccountingOverview
}) {
    const currency = overview.currencyCode
    const summary = overview.summary
    const simple = useMemo(() => computeSimpleAccountingSummary(overview), [overview])

    const cards = [
        {
            title: "Total Sales",
            value: formatCurrency(simple.totalSales, currency),
            badge: `${simple.invoicedOrdersCount} billed`,
            helper: "Money earned from deliveries completed for customers.",
            detail:
                summary.totalOutputVat && Number.parseFloat(summary.totalOutputVat) > 0
                    ? `Pending orders: ${formatCurrency(simple.pendingSales, currency)} · VAT ${formatCurrency(summary.totalOutputVat, currency)}`
                    : `Pending orders not yet delivered: ${formatCurrency(simple.pendingSales, currency)}`,
            icon: Coins,
            color: "text-teal-600 dark:text-teal-400",
            bg: "bg-teal-500/10",
        },
        {
            title: "Total Expenses",
            value: formatCurrency(simple.totalExpenses, currency),
            badge: `Bills ${formatCurrency(simple.totalSupplierBills, currency)}`,
            helper: "Cost of sold products plus scrap and stock count losses.",
            detail: `Product cost ${formatCurrency(simple.costOfGoodsSold, currency)} · Scrap ${formatCurrency(simple.scrapLoss, currency)}`,
            icon: Wallet,
            color: "text-rose-600 dark:text-rose-400",
            bg: "bg-rose-500/10",
        },
        {
            title: "Net Profit",
            value: formatCurrency(simple.netProfit, currency),
            badge:
                simple.profitMarginPercent !== null
                    ? `${simple.profitMarginPercent}% margin`
                    : "No sales yet",
            helper: "Total Sales minus Total Expenses for the selected dates.",
            detail: `Gross profit before losses: ${formatCurrency(summary.grossProfit, currency)}`,
            icon: TrendingUp,
            color: "text-primary",
            bg: "bg-primary/10",
        },
        {
            title: "Stock Value",
            value: formatCurrency(summary.totalInventoryAssetValue, currency),
            badge: `${summary.costedLotsCount} costed batches`,
            helper: "Total worth of all spices, packaging, and finished goods on hand.",
            detail: `Raw ${formatCurrency(summary.rawMaterialAssetValue, currency)} · Finished ${formatCurrency(summary.finishedGoodsAssetValue, currency)}`,
            icon: Boxes,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10",
        },
    ]

    return (
        <div className="grid gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            {cards.map((card) => {
                const Icon = card.icon
                return (
                    <Card key={card.title} className="border py-0 shadow-xs">
                        <CardContent className="p-3.5">
                            <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 text-xs font-medium text-muted-foreground">
                                    {card.title}
                                </span>
                                <div
                                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${card.bg}`}
                                >
                                    <Icon className={`size-4 ${card.color}`} />
                                </div>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
                                <span className="min-w-0 break-words text-lg font-bold tracking-tight tabular-nums sm:text-xl">
                                    {card.value}
                                </span>
                                <Badge
                                    variant="secondary"
                                    className="h-auto max-w-full whitespace-normal break-words py-0.5 text-left text-[11px] leading-tight font-medium tabular-nums"
                                >
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
