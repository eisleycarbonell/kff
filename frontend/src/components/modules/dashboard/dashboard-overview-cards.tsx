"use client"

import {
    AlertCircle,
    ArrowLeftRight,
    Boxes,
    Clock,
    Coins,
    Factory,
    PackageCheck,
    ShoppingCart,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    formatCurrency,
    formatQuantity,
    type DashboardSummary,
} from "@/components/modules/dashboard/dashboard.schema"

export function DashboardOverviewCards({ summary }: { summary: DashboardSummary | null }) {
    if (!summary) return null

    const cards = [
        {
            title: "Total Inventory Value",
            value: formatCurrency(summary.totalInventoryValue),
            badge: `${summary.totalItemsCount} catalog items`,
            badgeVariant: "secondary" as const,
            icon: Coins,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "hover:border-emerald-500/30",
            details: [
                { label: "Raw Materials", value: formatCurrency(summary.rawMaterialValue) },
                { label: "Finished Goods", value: formatCurrency(summary.finishedGoodsValue) },
            ],
        },
        {
            title: "Raw Material Stock",
            value: `${formatQuantity(summary.rawMaterialsOnHand)} units`,
            badge: `${formatQuantity(summary.rawMaterialsAvailable)} available`,
            badgeVariant: "outline" as const,
            icon: Boxes,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10",
            border: "hover:border-amber-500/30",
            details: [
                { label: "Reserved", value: `${formatQuantity(summary.rawMaterialsReserved)}` },
                { label: "Available", value: `${formatQuantity(summary.rawMaterialsAvailable)}` },
            ],
        },
        {
            title: "Finished Goods Stock",
            value: `${formatQuantity(summary.finishedGoodsOnHand)} units`,
            badge: `${formatQuantity(summary.finishedGoodsAvailable)} available`,
            badgeVariant: "outline" as const,
            icon: PackageCheck,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-500/10",
            border: "hover:border-blue-500/30",
            details: [
                { label: "Reserved", value: `${formatQuantity(summary.finishedGoodsReserved)}` },
                { label: "Value", value: formatCurrency(summary.finishedGoodsValue) },
            ],
        },
        {
            title: "Active Packing Orders",
            value: summary.activePackingOrdersCount,
            badge: summary.activePackingOrdersCount > 0 ? "In Production" : "Idle",
            badgeVariant: summary.activePackingOrdersCount > 0 ? ("default" as const) : ("secondary" as const),
            icon: Factory,
            color: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-500/10",
            border: "hover:border-purple-500/30",
            details: [
                { label: "Status", value: "Planned & In Progress" },
                { label: "Material Snapshot", value: "Locked" },
            ],
        },
        {
            title: "Pending Purchase Orders",
            value: summary.pendingPurchaseOrdersCount,
            badge: summary.pendingPurchaseOrdersCount > 0 ? "Open Orders" : "Up to date",
            badgeVariant: summary.pendingPurchaseOrdersCount > 0 ? ("secondary" as const) : ("outline" as const),
            icon: ShoppingCart,
            color: "text-sky-600 dark:text-sky-400",
            bg: "bg-sky-500/10",
            border: "hover:border-sky-500/30",
            details: [
                { label: "Lifecycle", value: "Draft / Sent / Partial" },
                { label: "Receiving", value: "Awaiting Delivery" },
            ],
        },
        {
            title: "Transfers In Transit",
            value: summary.activeTransfersCount,
            badge: summary.activeTransfersCount > 0 ? "Moving" : "Clear",
            badgeVariant: summary.activeTransfersCount > 0 ? ("default" as const) : ("outline" as const),
            icon: ArrowLeftRight,
            color: "text-teal-600 dark:text-teal-400",
            bg: "bg-teal-500/10",
            border: "hover:border-teal-500/30",
            details: [
                { label: "Status", value: "Dispatched to Branches" },
                { label: "Company Stock", value: "In Transit Location" },
            ],
        },
        {
            title: "Items Nearing Expiration",
            value: summary.expiringLotsCount,
            badge: summary.expiringLotsCount > 0 ? "Action Required" : "All Fresh",
            badgeVariant: summary.expiringLotsCount > 0 ? ("destructive" as const) : ("outline" as const),
            icon: Clock,
            color: summary.expiringLotsCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
            bg: summary.expiringLotsCount > 0 ? "bg-amber-500/10" : "bg-muted",
            border: summary.expiringLotsCount > 0 ? "border-amber-500/30" : "",
            details: [
                { label: "Window", value: "Within 30 Days" },
                { label: "Tracking", value: "Traceable Lots" },
            ],
        },
        {
            title: "Low Stock Materials",
            value: summary.lowStockItemsCount,
            badge: summary.lowStockItemsCount > 0 ? "Reorder Needed" : "Sufficient",
            badgeVariant: summary.lowStockItemsCount > 0 ? ("destructive" as const) : ("outline" as const),
            icon: AlertCircle,
            color: summary.lowStockItemsCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
            bg: summary.lowStockItemsCount > 0 ? "bg-rose-500/10" : "bg-muted",
            border: summary.lowStockItemsCount > 0 ? "border-rose-500/30" : "",
            details: [
                { label: "Threshold", value: "≤ 10 Units Available" },
                { label: "Impact", value: "Packing Risk" },
            ],
        },
    ]

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => {
                const Icon = card.icon
                return (
                    <Card
                        key={card.title}
                        className={`group relative overflow-hidden border transition-all duration-200 hover:shadow-md ${card.border}`}
                    >
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                    {card.title}
                                </span>
                                <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${card.bg}`}>
                                    <Icon className={`size-4.5 ${card.color}`} />
                                </div>
                            </div>

                            <div className="mt-3 flex items-baseline justify-between gap-2">
                                <span className="text-2xl font-bold tracking-tight tabular-nums">
                                    {card.value}
                                </span>
                                <Badge variant={card.badgeVariant} className="text-[10px] font-medium">
                                    {card.badge}
                                </Badge>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
                                {card.details.map((detail, index) => (
                                    <span key={index} className="truncate">
                                        <span className="font-normal">{detail.label}: </span>
                                        <span className="font-medium text-foreground tabular-nums">
                                            {detail.value}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
