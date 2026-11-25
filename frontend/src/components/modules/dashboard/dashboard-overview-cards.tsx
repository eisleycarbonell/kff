"use client"

import { AlertCircle, ClipboardCheck, Coins, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
    formatCurrency,
    type DashboardSummary,
} from "@/components/modules/dashboard/dashboard.schema"

export function DashboardOverviewCards({ summary }: { summary: DashboardSummary | null }) {
    if (!summary) return null

    const openOrdersTotal =
        summary.activePackingOrdersCount +
        summary.pendingPurchaseOrdersCount +
        (summary.openSalesOrdersCount ?? 0)
    const logisticsTotal =
        summary.activeTransfersCount + (summary.activeDeliveriesCount ?? 0)
    const inTransitTotal =
        summary.activeTransfersCount + (summary.inTransitDeliveriesCount ?? 0)
    const alertsTotal = summary.lowStockItemsCount + summary.expiringLotsCount

    const cards = [
        {
            title: "Total Inventory Value",
            value: formatCurrency(summary.totalInventoryValue, summary.currencyCode),
            badge: `${summary.totalItemsCount} items`,
            badgeVariant: "secondary" as const,
            icon: Coins,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "hover:border-emerald-500/30",
            detail: `Raw ${formatCurrency(summary.rawMaterialValue, summary.currencyCode)} · Finished ${formatCurrency(summary.finishedGoodsValue, summary.currencyCode)}`,
        },
        {
            title: "Open Orders",
            value: String(openOrdersTotal),
            badge: "Packing · POs · Sales",
            badgeVariant: openOrdersTotal > 0 ? ("secondary" as const) : ("outline" as const),
            icon: ClipboardCheck,
            color: "text-sky-600 dark:text-sky-400",
            bg: "bg-sky-500/10",
            border: "hover:border-sky-500/30",
            detail: `${summary.activePackingOrdersCount} packing · ${summary.pendingPurchaseOrdersCount} POs · ${summary.openSalesOrdersCount ?? 0} sales`,
        },
        {
            title: "Deliveries & Transfers",
            value: String(logisticsTotal),
            badge: `${inTransitTotal} in transit`,
            badgeVariant: inTransitTotal > 0 ? ("default" as const) : ("outline" as const),
            icon: Truck,
            color: "text-teal-600 dark:text-teal-400",
            bg: "bg-teal-500/10",
            border: "hover:border-teal-500/30",
            detail: `${summary.activeTransfersCount} transfers · ${summary.activeDeliveriesCount ?? 0} deliveries`,
        },
        {
            title: "Stock Alerts",
            value: String(alertsTotal),
            badge: alertsTotal > 0 ? "Needs Attention" : "All Healthy",
            badgeVariant: alertsTotal > 0 ? ("destructive" as const) : ("outline" as const),
            icon: AlertCircle,
            color:
                alertsTotal > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400",
            bg: alertsTotal > 0 ? "bg-rose-500/10" : "bg-emerald-500/10",
            border: alertsTotal > 0 ? "border-rose-500/30" : "hover:border-emerald-500/30",
            detail: `${summary.lowStockItemsCount} low stock · ${summary.expiringLotsCount} expiring soon`,
        },
    ]

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 @5xl/main:grid-cols-4">
            {cards.map((card) => {
                const Icon = card.icon
                return (
                    <Card
                        key={card.title}
                        className={`flex flex-col overflow-hidden border py-0 shadow-xs transition-all duration-200 hover:shadow-md ${card.border}`}
                    >
                        <CardContent className="flex flex-1 flex-col p-3.5">
                            <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 text-xs font-medium leading-tight text-muted-foreground">
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
                                    variant={card.badgeVariant}
                                    className="h-auto max-w-full whitespace-normal break-words py-0.5 text-left text-[11px] leading-tight font-medium tabular-nums"
                                >
                                    {card.badge}
                                </Badge>
                            </div>

                            <p className="mt-auto border-t border-border/50 pt-2 text-[11px] font-medium text-muted-foreground tabular-nums">
                                {card.detail}
                            </p>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
