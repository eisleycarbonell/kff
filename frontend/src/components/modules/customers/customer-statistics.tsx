import { memo } from "react"
import { UserCheck, UserRoundX, UsersRound } from "lucide-react"

import type { Customer } from "@/components/modules/customers/customer.schema"
import { Card, CardContent } from "@/components/ui/card"

export const CustomerStatistics = memo(function CustomerStatistics({ customers }: { customers: Customer[] }) {
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
        <div className="grid gap-3 @lg/main:grid-cols-2 @3xl/main:grid-cols-3">
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
