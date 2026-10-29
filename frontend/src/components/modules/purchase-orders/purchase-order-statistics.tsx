import { ClipboardList, FilePenLine, PackageOpen, Wallet } from "lucide-react"

import {
    formatPurchaseOrderDecimal,
    sumPurchaseOrderAmounts,
    type PurchaseOrder,
} from "@/components/modules/purchase-orders/purchase-order.schema"
import { Card, CardContent } from "@/components/ui/card"

export function PurchaseOrderStatistics({ orders }: { orders: PurchaseOrder[] }) {
    const openOrders = orders.filter(
        (order) => order.status !== "Completed" && order.status !== "Cancelled",
    )
    const statistics = [
        {
            label: "Total orders",
            value: String(orders.length),
            description: "Purchase orders on record",
            icon: ClipboardList,
        },
        {
            label: "Draft orders",
            value: String(orders.filter((order) => order.status === "Draft").length),
            description: "Purchases being prepared",
            icon: FilePenLine,
        },
        {
            label: "Awaiting delivery",
            value: String(
                orders.filter(
                    (order) => order.status === "Sent" || order.status === "Partially Received",
                ).length,
            ),
            description: "Sent or partially received orders",
            icon: PackageOpen,
        },
        {
            label: "Outstanding value",
            value: formatPurchaseOrderDecimal(
                sumPurchaseOrderAmounts(openOrders.map((order) => order.outstandingAmount)) ?? "0",
            ),
            description: "Open-order materials not yet received",
            icon: Wallet,
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
                            <p className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums">
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
