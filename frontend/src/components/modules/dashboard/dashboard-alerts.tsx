"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    formatDate,
    formatQuantity,
    type DashboardExpiringLot,
    type DashboardLowStockItem,
} from "@/components/modules/dashboard/dashboard.schema"

export function DashboardAlerts({
    expiringLots,
    lowStockItems,
}: {
    expiringLots: DashboardExpiringLot[]
    lowStockItems: DashboardLowStockItem[]
}) {
    const [tab, setTab] = useState<"expiry" | "low-stock">("expiry")

    const totalAlerts = expiringLots.length + lowStockItems.length

    return (
        <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold">Inventory Alerts</CardTitle>
                        {totalAlerts > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                {totalAlerts} Alert{totalAlerts !== 1 ? "s" : ""}
                            </Badge>
                        )}
                    </div>
                    <CardDescription className="text-xs">
                        Critical attention needed for material shelf life and replenishment
                    </CardDescription>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1">
                    <Button
                        size="sm"
                        variant={tab === "expiry" ? "secondary" : "ghost"}
                        className="h-7 px-2.5 text-xs font-medium"
                        onClick={() => setTab("expiry")}
                    >
                        <Clock className="mr-1.5 size-3.5" />
                        Expiry ({expiringLots.length})
                    </Button>
                    <Button
                        size="sm"
                        variant={tab === "low-stock" ? "secondary" : "ghost"}
                        className="h-7 px-2.5 text-xs font-medium"
                        onClick={() => setTab("low-stock")}
                    >
                        <AlertCircle className="mr-1.5 size-3.5" />
                        Low Stock ({lowStockItems.length})
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {tab === "expiry" ? (
                    expiringLots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                            <CheckCircle2 className="size-8 text-emerald-500/80" />
                            <p className="mt-2 text-sm font-medium text-foreground">No expiring lots</p>
                            <p className="text-xs text-muted-foreground">
                                All inventory lots have adequate shelf life beyond 30 days.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {expiringLots.map((lot) => {
                                const isExpired = lot.daysUntilExpiry <= 0
                                return (
                                    <div
                                        key={lot.lotId}
                                        className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-semibold text-foreground">
                                                    {lot.lotNumber}
                                                </span>
                                                <Badge
                                                    variant={isExpired ? "destructive" : "secondary"}
                                                    className="text-[10px]"
                                                >
                                                    {isExpired
                                                        ? "Expired"
                                                        : lot.daysUntilExpiry === 1
                                                          ? "Expires tomorrow"
                                                          : `${lot.daysUntilExpiry} days left`}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {lot.qcStatus}
                                                </Badge>
                                            </div>
                                            <p className="text-xs font-medium text-foreground">
                                                {lot.itemName}{" "}
                                                <span className="text-[10px] text-muted-foreground">({lot.itemSku})</span>
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                Location: {lot.locationName} • Expires {formatDate(lot.expirationDate)}
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-xs font-semibold tabular-nums text-foreground">
                                                {formatQuantity(lot.qtyOnHand)} {lot.primaryUomName}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">On Hand Stock</p>
                                        </div>
                                    </div>
                                )
                            })}
                            <div className="flex justify-end pt-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                    render={<Link href="/lots" />}
                                    nativeButton={false}
                                >
                                    Manage Lots
                                    <ArrowUpRight className="size-3.5" />
                                </Button>
                            </div>
                        </div>
                    )
                ) : lowStockItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                        <CheckCircle2 className="size-8 text-emerald-500/80" />
                        <p className="mt-2 text-sm font-medium text-foreground">Stock levels healthy</p>
                        <p className="text-xs text-muted-foreground">
                            All raw materials and packaging materials have sufficient available balances.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {lowStockItems.map((item) => {
                            const available = parseFloat(item.qtyAvailable) || 0
                            const isCriticallyLow = available <= 0

                            return (
                                <div
                                    key={item.itemId}
                                    className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-primary">
                                                {item.itemSku}
                                            </span>
                                            <Badge
                                                variant={isCriticallyLow ? "destructive" : "secondary"}
                                                className="text-[10px]"
                                            >
                                                {isCriticallyLow ? "Out of Stock" : "Low Available"}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground">
                                                {item.itemType}
                                            </span>
                                        </div>
                                        <p className="text-xs font-medium text-foreground">{item.itemName}</p>
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                            <span>On hand: {formatQuantity(item.qtyOnHand)} {item.primaryUomName}</span>
                                            <span>•</span>
                                            <span>Reserved: {formatQuantity(item.qtyReserved)} {item.primaryUomName}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                                        <div className="text-right">
                                            <p
                                                className={`text-xs font-bold tabular-nums ${
                                                    isCriticallyLow
                                                        ? "text-destructive"
                                                        : "text-amber-600 dark:text-amber-400"
                                                }`}
                                            >
                                                {formatQuantity(item.qtyAvailable)} {item.primaryUomName}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">Available to Pack</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6.5 gap-1 px-2 text-[11px]"
                                            render={<Link href="/purchase-orders" />}
                                            nativeButton={false}
                                        >
                                            <Plus className="size-3" />
                                            Reorder
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                        <div className="flex justify-end pt-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                render={<Link href="/purchase-orders" />}
                                nativeButton={false}
                            >
                                Create Purchase Order
                                <ArrowUpRight className="size-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
