import { ClipboardList, Package, Truck, UserCheck } from "lucide-react"

import type { Supplier } from "@/components/modules/suppliers/supplier.schema"
import { Card, CardContent } from "@/components/ui/card"

export function SupplierStatistics({ suppliers }: { suppliers: Supplier[] }) {
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
            label: "Active item offers",
            value: suppliers.reduce((total, supplier) => total + supplier.activeItemCount, 0),
            description: "Materials offered by suppliers",
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statistics.map(({ label, value, description, icon: Icon }) => (
                <Card key={label} className="border py-5 ring-0 sm:py-6">
                    <CardContent className="flex items-start gap-4 px-5 sm:px-6">
                        <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-muted-foreground">{label}</p>
                            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                                {value}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
