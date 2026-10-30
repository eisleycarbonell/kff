"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Boxes, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    formatCurrency,
    formatQuantity,
    type DashboardStockByLocation,
    type DashboardStockByType,
} from "@/components/modules/dashboard/dashboard.schema"

export function DashboardStockDistribution({
    stockByType,
    stockByLocation,
}: {
    stockByType: DashboardStockByType[]
    stockByLocation: DashboardStockByLocation[]
}) {
    const [view, setView] = useState<"type" | "location">("type")

    // Calculate total value to derive percentages
    const totalVal = stockByType.reduce((acc, row) => acc + (parseFloat(row.totalValue) || 0), 0)

    return (
        <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="space-y-0.5">
                    <CardTitle className="text-base font-semibold">Stock Distribution</CardTitle>
                    <CardDescription className="text-xs">
                        Breakdown of inventory balances across spice categories and physical facilities
                    </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1">
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

            <CardContent>
                {view === "type" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {stockByType.map((item) => {
                            const val = parseFloat(item.totalValue) || 0
                            const percentage = totalVal > 0 ? Math.min(100, Math.round((val / totalVal) * 100)) : 0

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
                                    className="rounded-xl border border-border/60 bg-card/60 p-4 transition-colors hover:bg-muted/30"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-semibold tracking-tight">{item.itemType}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {item.itemCount} distinct SKU{item.itemCount !== 1 ? "s" : ""} in stock
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="text-xs font-semibold tabular-nums">
                                            {formatCurrency(item.totalValue)}
                                        </Badge>
                                    </div>

                                    {/* Progress indicator */}
                                    <div className="mt-3.5">
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                            <span>Share of total value</span>
                                            <span className="font-medium text-foreground tabular-nums">{percentage}%</span>
                                        </div>
                                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                            <div
                                                className={`h-full transition-all duration-500 ${typeColor}`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Metrics row */}
                                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-2.5 text-center">
                                        <div>
                                            <p className="text-[11px] text-muted-foreground">On Hand</p>
                                            <p className="mt-0.5 text-xs font-semibold tabular-nums">
                                                {formatQuantity(item.totalOnHand)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] text-muted-foreground">Reserved</p>
                                            <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                                                {formatQuantity(item.totalReserved)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] text-muted-foreground">Available</p>
                                            <p className="mt-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                {formatQuantity(item.totalAvailable)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                        <table className="w-full text-left text-xs">
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
                                            <span className="font-semibold text-foreground">{loc.locationName}</span>
                                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                                                {loc.locationCode}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <Badge variant="secondary" className="text-[10px]">
                                                {loc.locationType}
                                            </Badge>
                                        </td>
                                        <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                                            {loc.itemCount}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-medium tabular-nums">
                                            {formatQuantity(loc.totalOnHand)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                                            {formatQuantity(loc.totalReserved)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                            {formatQuantity(loc.totalAvailable)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="mt-3 flex justify-end">
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
