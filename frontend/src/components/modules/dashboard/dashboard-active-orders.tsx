"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Calendar, Factory, ShoppingCart } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    formatCurrency,
    formatDate,
    formatQuantity,
    type DashboardActivePackingOrder,
    type DashboardPendingPurchaseOrder,
} from "@/components/modules/dashboard/dashboard.schema"

export function DashboardActiveOrders({
    packingOrders,
    purchaseOrders,
}: {
    packingOrders: DashboardActivePackingOrder[]
    purchaseOrders: DashboardPendingPurchaseOrder[]
}) {
    const [tab, setTab] = useState<"packing" | "purchasing">("packing")

    return (
        <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="space-y-0.5">
                    <CardTitle className="text-base font-semibold">Active Operations</CardTitle>
                    <CardDescription className="text-xs">
                        Production schedules and open supplier procurement tracking
                    </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1">
                    <Button
                        size="sm"
                        variant={tab === "packing" ? "secondary" : "ghost"}
                        className="h-7 px-2.5 text-xs font-medium"
                        onClick={() => setTab("packing")}
                    >
                        <Factory className="mr-1.5 size-3.5" />
                        Packing ({packingOrders.length})
                    </Button>
                    <Button
                        size="sm"
                        variant={tab === "purchasing" ? "secondary" : "ghost"}
                        className="h-7 px-2.5 text-xs font-medium"
                        onClick={() => setTab("purchasing")}
                    >
                        <ShoppingCart className="mr-1.5 size-3.5" />
                        Purchasing ({purchaseOrders.length})
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {tab === "packing" ? (
                    packingOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                            <Factory className="size-8 text-muted-foreground/60" />
                            <p className="mt-2 text-sm font-medium text-foreground">No active packing orders</p>
                            <p className="text-xs text-muted-foreground">All scheduled packing orders are complete or cancelled.</p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-3 h-8 text-xs"
                                render={<Link href="/packing-orders" />}
                                nativeButton={false}
                            >
                                Plan Packing Order
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {packingOrders.map((order) => {
                                const target = parseFloat(order.targetQty) || 0
                                const actual = parseFloat(order.actualQty) || 0
                                const progress = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0

                                return (
                                    <div
                                        key={order.packingOrderId}
                                        className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-semibold text-primary">
                                                    {order.packingOrderNumber}
                                                </span>
                                                <Badge
                                                    variant={order.status === "In Progress" ? "default" : "secondary"}
                                                    className="text-[10px]"
                                                >
                                                    {order.status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs font-medium text-foreground">
                                                {order.itemName}{" "}
                                                <span className="text-[10px] text-muted-foreground">({order.itemSku})</span>
                                            </p>
                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                <span>{order.sourceLocationName} → {order.destinationLocationName}</span>
                                                {order.scheduledDate && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="size-3" />
                                                            {formatDate(order.scheduledDate)}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
                                            <div className="text-right">
                                                <p className="text-xs font-medium tabular-nums">
                                                    {formatQuantity(order.actualQty)} / {formatQuantity(order.targetQty)} {order.primaryUomName}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground tabular-nums">
                                                    {progress}% packed
                                                </p>
                                            </div>
                                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full bg-primary transition-all duration-300"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            <div className="flex justify-end pt-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                    render={<Link href="/packing-orders" />}
                                    nativeButton={false}
                                >
                                    Manage Packing Orders
                                    <ArrowUpRight className="size-3.5" />
                                </Button>
                            </div>
                        </div>
                    )
                ) : purchaseOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                        <ShoppingCart className="size-8 text-muted-foreground/60" />
                        <p className="mt-2 text-sm font-medium text-foreground">No pending purchase orders</p>
                        <p className="text-xs text-muted-foreground">All supplier purchase orders are received or complete.</p>
                        <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 h-8 text-xs"
                            render={<Link href="/purchase-orders" />}
                            nativeButton={false}
                        >
                            Create Purchase Order
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {purchaseOrders.map((po) => (
                            <div
                                key={po.poId}
                                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-semibold text-primary">
                                            {po.poNumber}
                                        </span>
                                        <Badge
                                            variant={
                                                po.status === "Partially Received"
                                                    ? "default"
                                                    : po.status === "Sent"
                                                      ? "secondary"
                                                      : "outline"
                                            }
                                            className="text-[10px]"
                                        >
                                            {po.status}
                                        </Badge>
                                    </div>
                                    <p className="text-xs font-medium text-foreground">{po.supplierName}</p>
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                        <span>{po.lineCount} item line{po.lineCount !== 1 ? "s" : ""}</span>
                                        <span>•</span>
                                        <span>Ordered {formatDate(po.orderDate)}</span>
                                        {po.expectedDeliveryDate && (
                                            <>
                                                <span>•</span>
                                                <span className="text-foreground">
                                                    Due {formatDate(po.expectedDeliveryDate)}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-xs font-bold tracking-tight tabular-nums text-foreground">
                                        {formatCurrency(po.totalAmount)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground tabular-nums">
                                        Remaining: {formatCurrency(po.outstandingAmount)}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <div className="flex justify-end pt-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                render={<Link href="/purchase-orders" />}
                                nativeButton={false}
                            >
                                View All Purchase Orders
                                <ArrowUpRight className="size-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
