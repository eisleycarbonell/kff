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
        <div className="grid gap-4 sm:grid-cols-3">
            {metrics.map(({ label, value, description, icon: Icon }) => (
                <Card key={label} className="border py-5 ring-0 sm:py-6">
                    <CardContent className="flex items-start gap-4 px-5 sm:px-6">
                        <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">{label}</p>
                            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
})
