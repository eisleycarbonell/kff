import { ClipboardList, Truck, PackageCheck } from "lucide-react"
import type { DeliveryOrder } from "@/components/modules/delivery-orders/delivery-order.schema"
import { Card, CardContent } from "@/components/ui/card"

export function DeliveryOrderStatistics({ orders }: { orders: DeliveryOrder[] }) {
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
        <div className="grid gap-4 sm:grid-cols-3">
            {statistics.map(({ label, value, description, icon: Icon }) => (
                <Card key={label} className="border py-5 ring-0 sm:py-6">
                    <CardContent className="flex items-start gap-4 px-5 sm:px-6">
                        <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
                        <div>
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
