"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Boxes, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    formatCurrency,
    formatUnitTotals,
    type DashboardStockByLocation,
    type DashboardStockByType,
} from "@/components/modules/dashboard/dashboard.schema"

export function DashboardStockDistribution({
    stockByType,
    stockByLocation,
    currencyCode,
}: {
    currencyCode: string
    stockByType: DashboardStockByType[]
    stockByLocation: DashboardStockByLocation[]
}) {
    const [view, setView] = useState<"type" | "location">("type")

    // Calculate total value to derive percentages
    const totalVal = stockByType.reduce((acc, row) => acc + (parseFloat(row.totalValue) || 0), 0)

    return (
        <Card className="@container/card flex flex-col border shadow-xs">
            <CardHeader className="flex flex-col gap-3 pb-3 @lg/card:flex-row @lg/card:items-center @lg/card:justify-between">
                <div className="min-w-0 flex-1 space-y-0.5">
                    <CardTitle className="text-base font-semibold">Stock Distribution</CardTitle>
                    <CardDescription className="text-xs">
                        Breakdown of inventory balances across spice categories and physical
                        facilities
                    </CardDescription>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1 self-start rounded-lg border bg-muted/40 p-1 @lg/card:self-auto">
                    <Button
                        size="sm"
                        variant={view === "type" ? "secondary" : "ghost"}
                        className="h-7 px-2.5 text-xs font-medium"
                        onClick={() => setView("type")}
                    >
                        <Boxes className="mr-1.5 size-3.5" />
                        By Item Type
                    </Button>
                    <Button
                        size="sm"
                        variant={view === "location" ? "secondary" : "ghost"}
                        className="h-7 px-2.5 text-xs font-medium"
                        onClick={() => setView("location")}
                    >
                        <MapPin className="mr-1.5 size-3.5" />
                        By Location
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="@container/stock-dist flex min-w-0 flex-1 flex-col">
                {view === "type" ? (
                    <div className="grid gap-3 @[430px]/stock-dist:grid-cols-2">
                        {stockByType.map((item) => {
                            const val = parseFloat(item.totalValue) || 0
                            const percentage =
                                totalVal > 0 ? Math.min(100, Math.round((val / totalVal) * 100)) : 0

                            const typeColor =
                                item.itemType === "Raw Material - Bulk"
                                    ? "bg-amber-500"
                                    : item.itemType === "Packaging - Hardware"
                                      ? "bg-blue-500"
                                      : item.itemType === "Packaging - Label"
                                        ? "bg-teal-500"
                                        : "bg-emerald-500"

                            return (
                                <div
                                    key={item.itemType}
                                    className="@container/type-tile flex min-w-0 flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-3 transition-colors hover:bg-muted/30 sm:p-3.5"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-semibold leading-snug tracking-tight">
                                                {item.itemType}
                                            </p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {item.itemCount} distinct SKU
                                                {item.itemCount !== 1 ? "s" : ""} in stock
                                            </p>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="shrink-0 text-[11px] font-semibold tabular-nums"
                                        >
                                            {formatCurrency(item.totalValue, currencyCode)}
                                        </Badge>
                                    </div>

                                    <div>
                                        {/* Progress indicator */}
                                        <div className="mt-3.5">
                                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                <span>Share of total value</span>
                                                <span className="font-medium text-foreground tabular-nums">
                                                    {percentage}%
                                                </span>
                                            </div>
                                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className={`h-full transition-all duration-500 ${typeColor}`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Metrics row */}
                                        <div className="mt-3.5 grid grid-cols-1 gap-2 border-t border-border/50 pt-2.5 text-left @[190px]/type-tile:grid-cols-3 @[190px]/type-tile:gap-1.5 @[190px]/type-tile:text-center">
                                            <div className="min-w-0">
                                                <p className="text-[10px] text-muted-foreground">
                                                    On Hand
                                                </p>
                                                <p className="mt-0.5 break-words text-[11px] font-semibold tabular-nums">
                                                    {formatUnitTotals(item.quantities, "onHand")}
                                                </p>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] text-muted-foreground">
                                                    Reserved
                                                </p>
                                                <p className="mt-0.5 break-words text-[11px] font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                                                    {formatUnitTotals(item.quantities, "reserved")}
                                                </p>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] text-muted-foreground">
                                                    Available
                                                </p>
                                                <p className="mt-0.5 break-words text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                    {formatUnitTotals(item.quantities, "available")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <>
                        <div className="space-y-2.5 @[480px]/stock-dist:hidden">
                            {stockByLocation.map((loc) => (
                                <div
                                    key={loc.locationId}
                                    className="min-w-0 rounded-xl border border-border/60 bg-card/60 p-3"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="break-words text-xs font-semibold text-foreground">
                                                {loc.locationName}
                                            </p>
                                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                                                {loc.locationCode} · {loc.itemCount} distinct SKU
                                                {loc.itemCount !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                                            {loc.locationType}
                                        </Badge>
                                    </div>
                                    <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-border/50 pt-2 text-center">
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-muted-foreground">
                                                On Hand
                                            </p>
                                            <p className="mt-0.5 break-words text-[11px] font-semibold tabular-nums">
                                                {formatUnitTotals(loc.quantities, "onHand")}
                                            </p>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-muted-foreground">
                                                Reserved
                                            </p>
                                            <p className="mt-0.5 break-words text-[11px] font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                                                {formatUnitTotals(loc.quantities, "reserved")}
                                            </p>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-muted-foreground">
                                                Available
                                            </p>
                                            <p className="mt-0.5 break-words text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                {formatUnitTotals(loc.quantities, "available")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto rounded-lg border border-border/60 @[480px]/stock-dist:block">
                            <table className="w-full min-w-[480px] text-left text-xs">
                                <thead className="border-b bg-muted/40 font-medium text-muted-foreground">
                                    <tr>
                                        <th className="py-2.5 px-3">Location</th>
                                        <th className="py-2.5 px-3">Type</th>
                                        <th className="py-2.5 px-3 text-right">Items</th>
                                        <th className="py-2.5 px-3 text-right">On Hand</th>
                                        <th className="py-2.5 px-3 text-right">Reserved</th>
                                        <th className="py-2.5 px-3 text-right">Available</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {stockByLocation.map((loc) => (
                                        <tr key={loc.locationId} className="hover:bg-muted/20">
                                            <td className="py-2.5 px-3 font-medium">
                                                <span className="font-semibold text-foreground">
                                                    {loc.locationName}
                                                </span>
                                                <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                                                    {loc.locationCode}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <Badge variant="secondary" className="text-[10px]">
                                                    {loc.locationType}
                                                </Badge>
                                            </td>
                                            <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                                                {loc.itemCount}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-medium whitespace-nowrap tabular-nums">
                                                {formatUnitTotals(loc.quantities, "onHand")}
                                            </td>
                                            <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-amber-600 dark:text-amber-400">
                                                {formatUnitTotals(loc.quantities, "reserved")}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap tabular-nums text-emerald-600 dark:text-emerald-400">
                                                {formatUnitTotals(loc.quantities, "available")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                <div className="mt-auto flex justify-end pt-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        render={<Link href="/inventory" />}
                        nativeButton={false}
                    >
                        View Full Stock Ledger
                        <ArrowUpRight className="size-3.5" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
