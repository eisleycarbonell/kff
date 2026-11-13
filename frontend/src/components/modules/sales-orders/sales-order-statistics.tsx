import { memo } from "react"
import { CircleCheck, ClipboardList, PackageCheck } from "lucide-react"
import type { SalesOrder } from "@/components/modules/sales-orders/sales-order.schema"
import { Card, CardContent } from "@/components/ui/card"
export const SalesOrderStatistics = memo(function SalesOrderStatistics({ orders }: { orders: SalesOrder[] }) {
    const cards = [
        {
            label: "Draft orders",
            value: orders.filter((order) => order.status === "Draft").length,
            description: "Awaiting confirmation",
            icon: ClipboardList,
        },
        {
            label: "Open orders",
            value: orders.filter(
                (order) => order.status === "Confirmed" || order.status === "Partially Delivered",
            ).length,
            description: "Customer orders awaiting fulfillment",
            icon: PackageCheck,
        },
        {
            label: "Completed orders",
            value: orders.filter((order) => order.status === "Completed").length,
            description: "All ordered quantities delivered",
            icon: CircleCheck,
        },
    ]
    return (
        <div className="grid gap-4 sm:grid-cols-3">
            {cards.map(({ label, value, description, icon: Icon }) => (
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
})
