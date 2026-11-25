import { memo } from "react"
import { ClipboardList, Package, Truck, UserCheck } from "lucide-react"

import type { Supplier } from "@/components/modules/suppliers/supplier.schema"
import { Card, CardContent } from "@/components/ui/card"

export const SupplierStatistics = memo(function SupplierStatistics({ suppliers }: { suppliers: Supplier[] }) {
    const statistics = [
        {
            label: "Total suppliers",
            value: suppliers.length,
            description: "Supplier records in your catalog",
            icon: Truck,
        },
        {
            label: "Active suppliers",
            value: suppliers.filter((supplier) => supplier.isActive).length,
            description: "Available for purchasing",
            icon: UserCheck,
        },
        {
            label: "Linked items",
            value: suppliers.reduce((total, supplier) => total + supplier.activeItemCount, 0),
            description: "Current links across all suppliers",
            icon: Package,
        },
        {
            label: "With open orders",
            value: suppliers.filter((supplier) => supplier.hasOpenPurchaseOrders).length,
            description: "Suppliers with pending purchases",
            icon: ClipboardList,
        },
    ]

    return (
        <div className="grid gap-3 @lg/main:grid-cols-2 @5xl/main:grid-cols-4">
            {statistics.map(({ label, value, description, icon: Icon }) => (
                <Card key={label} className="border py-3 ring-0">
                    <CardContent className="flex items-start gap-3 px-4">
                        <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">{label}</p>
                            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                                {value}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
})
