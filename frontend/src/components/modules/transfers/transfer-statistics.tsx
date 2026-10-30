import { ClipboardList, Truck, PackageCheck, XCircle } from "lucide-react"
import type { Transfer } from "@/components/modules/transfers/transfer.schema"
import { Card, CardContent } from "@/components/ui/card"

export function TransferStatistics({ transfers }: { transfers: Transfer[] }) {
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statistics.map(({ label, status, description, icon: Icon }) => (
                <Card key={status} className="border py-5 ring-0 sm:py-6">
                    <CardContent className="flex items-start gap-4 px-5 sm:px-6">
                        <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-muted-foreground">{label}</p>
                            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                                {transfers.filter((row) => row.status === status).length}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
