import { memo } from "react"
import { Mail, ShieldCheck, UsersRound } from "lucide-react"

import type { User, UserRole } from "@/components/modules/users/user.schema"
import { Card, CardContent } from "@/components/ui/card"

export const UserStatistics = memo(function UserStatistics({ users, roles }: { users: User[]; roles: UserRole[] }) {
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
            icon: Mail,
        },
        {
            label: "User managers",
            value: users.filter((user) =>
                roles.some((role) => role.roleId === user.roleId && role.settings.canManageUsers),
            ).length,
            description: "Users who can manage accounts and roles",
            icon: ShieldCheck,
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
})
