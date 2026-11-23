import { memo } from "react"
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

export const PackingOrderStatistics = memo(function PackingOrderStatistics({ orders }: { orders: PackingOrder[] }) {
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
export const ReservationStatistics = memo(function ReservationStatistics({ reservations }: { reservations: Reservation[] }) {
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
