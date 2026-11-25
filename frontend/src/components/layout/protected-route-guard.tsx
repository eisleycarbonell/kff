"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"
import { useSession } from "@/hooks/use-session"
import { shouldRedirectToLogin } from "@/lib/load-status"
import { getWorkspaceRedirect } from "@/lib/workspace-access"

/** Redirect unauthenticated visitors to login and enforce workspace route isolation by role. */
export function ProtectedRouteGuard({ children }: { children: ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const session = useSession()
    const redirectingToLogin = shouldRedirectToLogin(session)
    const workspaceRedirect =
        !session.isPending && session.data
            ? getWorkspaceRedirect(session.data, pathname)
            : null

    useEffect(() => {
        if (redirectingToLogin) {
            router.replace("/")
            return
        }
        if (workspaceRedirect) {
            router.replace(workspaceRedirect)
        }
    }, [redirectingToLogin, workspaceRedirect, router])

    if (session.isPending || redirectingToLogin || workspaceRedirect) {
        let statusMessage = "Checking session..."
        if (redirectingToLogin) {
            statusMessage = "Redirecting to sign in..."
        } else if (workspaceRedirect === "/accounting") {
            statusMessage = "Opening Accounting Portal..."
        } else if (workspaceRedirect) {
            statusMessage = "Opening workspace..."
        }

        return (
            <div
                className="flex min-h-svh w-full items-center justify-center bg-muted/30 p-4"
                role="status"
                aria-live="polite"
            >
                <div className="flex items-center gap-2.5 rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground shadow-xs">
                    <LoaderCircle className="size-4 shrink-0 animate-spin" />
                    <span>{statusMessage}</span>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
