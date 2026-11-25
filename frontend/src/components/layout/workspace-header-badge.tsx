"use client"

import { Landmark } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useSession } from "@/hooks/use-session"
import { isAccountingOnlySession } from "@/lib/workspace-access"

/** Display an environment indicator in the header bar for standalone Accounting Portal sessions. */
export function WorkspaceHeaderBadge() {
    const session = useSession()
    if (!isAccountingOnlySession(session.data)) return null

    return (
        <Badge
            variant="outline"
            className="shrink-0 gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        >
            <Landmark className="size-3" />
            <span className="hidden min-[380px]:inline">Accounting Portal</span>
            <span className="min-[380px]:hidden">Accounting</span>
        </Badge>
    )
}
