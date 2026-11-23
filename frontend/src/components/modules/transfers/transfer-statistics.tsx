import { memo } from "react"
import { ClipboardList, Truck, PackageCheck, XCircle } from "lucide-react"
import type { Transfer } from "@/components/modules/transfers/transfer.schema"
import { Card, CardContent } from "@/components/ui/card"

export const TransferStatistics = memo(function TransferStatistics({ transfers }: { transfers: Transfer[] }) {
    const statistics = [
        {
            label: "Draft transfers",
            status: "Draft",
            description: "Awaiting dispatch",
            icon: ClipboardList,
        },
        {
            label: "In transit",
            status: "In Transit",
            description: "Awaiting confirmed receipt",
            icon: Truck,
        },
        {
            label: "Completed",
            status: "Completed",
            description: "All shipped goods received",
            icon: PackageCheck,
        },
        {
            label: "Cancelled",
            status: "Cancelled",
            description: "Drafts closed before dispatch",
            icon: XCircle,
        },
    ]
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statistics.map(({ label, status, description, icon: Icon }) => (
                <Card key={status} className="border py-3 ring-0">
                    <CardContent className="flex items-start gap-3 px-4">
                        <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">{label}</p>
                            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                                {transfers.filter((row) => row.status === status).length}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
})
