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
        <div className="grid gap-3 @lg/main:grid-cols-2 @3xl/main:grid-cols-3">
            {cards.map(({ label, value, description, icon: Icon }) => (
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
