import { memo } from "react"
import { ClipboardList, Truck, PackageCheck } from "lucide-react"
import type { DeliveryOrder } from "@/components/modules/delivery-orders/delivery-order.schema"
import { Card, CardContent } from "@/components/ui/card"

export const DeliveryOrderStatistics = memo(function DeliveryOrderStatistics({ orders }: { orders: DeliveryOrder[] }) {
    const statistics = [
        {
            label: "Draft deliveries",
            value: orders.filter((row) => row.status === "Draft").length,
            description: "Awaiting dispatch",
            icon: ClipboardList,
        },
        {
            label: "In transit",
            value: orders.filter((row) => row.status === "In Transit").length,
            description: "Company stock on the way to customers",
            icon: Truck,
        },
        {
            label: "Completed deliveries",
            value: orders.filter((row) => row.status === "Completed").length,
            description: "Customer receipt confirmed",
            icon: PackageCheck,
        },
    ]
    return (
        <div className="grid gap-3 sm:grid-cols-3">
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
