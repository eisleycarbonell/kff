import { CheckCircle2, ShieldCheck, UsersRound } from "lucide-react"

import type { User } from "@/components/modules/users/user.schema"
import { Card, CardContent } from "@/components/ui/card"

export function UserStatistics({ users }: { users: User[] }) {
    const statistics = [
        {
            label: "Total users",
            value: users.length,
            description: "People in your workspace",
            icon: UsersRound,
        },
        {
            label: "Verified emails",
            value: users.filter((user) => user.isEmailVerified).length,
            description: "Users with a verified email",
            icon: CheckCircle2,
        },
        {
            label: "Administrators",
            value: users.filter((user) => user.roleId === 1).length,
            description: "Users with administrator access",
            icon: ShieldCheck,
        },
    ]

    return (
        <div className="grid gap-4 sm:grid-cols-3">
            {statistics.map(({ label, value, description, icon: Icon }) => (
                <Card key={label}>
                    <CardContent>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{label}</span>
                            <Icon className="size-4" />
                        </div>
                        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                            {value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {description}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
