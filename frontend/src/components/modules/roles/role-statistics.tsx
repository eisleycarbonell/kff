import { memo } from "react"
import { ShieldCheck, UsersRound, UserCog } from "lucide-react"
import type { Role } from "@/components/modules/roles/role.schema"
import { Card, CardContent } from "@/components/ui/card"

export const RoleStatistics = memo(function RoleStatistics({ roles }: { roles: Role[] }) {
    const metrics = [
        {
            label: "Total roles",
            value: roles.length,
            description: "Configured access roles",
            icon: ShieldCheck,
        },
        {
            label: "Assigned users",
            value: roles.reduce((sum, role) => sum + role.activeUserCount, 0),
            description: "Active accounts across all roles",
            icon: UsersRound,
        },
        {
            label: "User managers",
            value: roles.reduce(
                (sum, role) => sum + (role.settings.canManageUsers ? role.activeUserCount : 0),
                0,
            ),
            description: "Active users who can manage access",
            icon: UserCog,
        },
    ]
    return (
        <div className="grid gap-3 @lg/main:grid-cols-2 @3xl/main:grid-cols-3">
            {metrics.map(({ label, value, description, icon: Icon }) => (
                <Card key={label} className="border py-3 ring-0">
                    <CardContent className="flex items-start gap-3 px-4">
                        <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">{label}</p>
                            <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
})
