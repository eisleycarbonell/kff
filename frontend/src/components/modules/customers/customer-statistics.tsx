import { UserCheck, UserRoundX, UsersRound } from "lucide-react"

import type { Customer } from "@/components/modules/customers/customer.schema"
import { Card, CardContent } from "@/components/ui/card"

export function CustomerStatistics({ customers }: { customers: Customer[] }) {
    const activeCount = customers.filter((customer) => customer.isActive).length
    const statistics = [
        {
            label: "Total customers",
            value: customers.length,
            description: "Customer records in your directory",
            icon: UsersRound,
        },
        {
            label: "Active customers",
            value: activeCount,
            description: "Current customer relationships",
            icon: UserCheck,
        },
        {
            label: "Inactive customers",
            value: customers.length - activeCount,
            description: "Retained for reference",
            icon: UserRoundX,
        },
    ]

    return (
        <div className="grid gap-4 sm:grid-cols-3">
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
