import {
    CalendarCheck,
    ClipboardList,
    PackageCheck,
    Layers,
    LockKeyhole,
    Boxes,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
    reservationStatus,
    type PackingOrder,
    type Reservation,
} from "@/components/modules/packing-orders/packing-order.schema"

export function PackingOrderStatistics({ orders }: { orders: PackingOrder[] }) {
    const statistics = [
        {
            label: "Packing orders",
            value: orders.length,
            description: "All recorded orders",
            icon: ClipboardList,
        },
        {
            label: "Active orders",
            value: orders.filter((row) => ["Planned", "In Progress"].includes(row.status)).length,
            description: "Planned or in progress",
            icon: CalendarCheck,
        },
        {
            label: "Completed",
            value: orders.filter((row) => row.status === "Completed").length,
            description: "Finished goods recorded",
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
export function ReservationStatistics({ reservations }: { reservations: Reservation[] }) {
    const active = reservations.filter((row) => reservationStatus(row) === "Active")
    const statistics = [
        {
            label: "Active reservations",
            value: active.length,
            description: "Stock protected for packing",
            icon: LockKeyhole,
        },
        {
            label: "Packing orders",
            value: new Set(active.map((row) => row.packingOrderId)).size,
            description: "Orders holding materials",
            icon: Layers,
        },
        {
            label: "Reserved materials",
            value: new Set(active.map((row) => row.itemId)).size,
            description: "Distinct materials reserved",
            icon: Boxes,
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
