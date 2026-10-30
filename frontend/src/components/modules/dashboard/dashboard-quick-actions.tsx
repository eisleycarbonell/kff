"use client"

import Link from "next/link"
import {
    ArrowLeftRight,
    Boxes,
    PackagePlus,
    ShoppingCart,
    TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useSession } from "@/hooks/use-session"

export function DashboardQuickActions() {
    const session = useSession()
    const permissions = session.data?.permissions

    const canPurchasing = permissions?.canManagePurchasing === true
    const canPacking = permissions?.canManagePacking === true
    const canTransfers = permissions?.canManageTransfers === true
    const canInventory = permissions?.canManageInventory === true

    return (
        <Card className="border bg-gradient-to-r from-card via-card to-primary/5 shadow-xs">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <TrendingUp className="size-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold tracking-tight">Quick Operations</h2>
                        <p className="text-xs text-muted-foreground">
                            Fast access to frequent operations across trading and packing
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {canPurchasing && (
                        <Button
                            size="sm"
                            className="h-8.5 gap-1.5 text-xs shadow-xs"
                            render={<Link href="/purchase-orders" />}
                            nativeButton={false}
                        >
                            <ShoppingCart className="size-3.5" />
                            Purchase Order
                        </Button>
                    )}
                    {canPacking && (
                        <Button
                            size="sm"
                            variant="secondary"
                            className="h-8.5 gap-1.5 text-xs shadow-xs hover:bg-secondary/80"
                            render={<Link href="/packing-orders" />}
                            nativeButton={false}
                        >
                            <PackagePlus className="size-3.5 text-primary" />
                            Packing Order
                        </Button>
                    )}
                    {canTransfers && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8.5 gap-1.5 text-xs"
                            render={<Link href="/transfers" />}
                            nativeButton={false}
                        >
                            <ArrowLeftRight className="size-3.5" />
                            Stock Transfer
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        render={<Link href="/inventory" />}
                        nativeButton={false}
                    >
                        <Boxes className="size-3.5" />
                        {canInventory ? "Inventory Stock" : "All Stock"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
