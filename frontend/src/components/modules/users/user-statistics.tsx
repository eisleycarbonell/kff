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
