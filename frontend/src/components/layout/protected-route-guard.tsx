"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"
import { useSession } from "@/hooks/use-session"
import { shouldRedirectToLogin } from "@/lib/load-status"

/** Redirect unauthenticated visitors from protected routes back to login. */
export function ProtectedRouteGuard({ children }: { children: ReactNode }) {
    const router = useRouter()
    const session = useSession()
    const redirecting = shouldRedirectToLogin(session)

    useEffect(() => {
        if (redirecting) {
            router.replace("/")
        }
    }, [redirecting, router])

    if (session.isPending || redirecting) {
        return (
            <div
                className="flex min-h-svh w-full items-center justify-center bg-muted/30 p-4"
                role="status"
                aria-live="polite"
            >
                <div className="flex items-center gap-2.5 rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground shadow-xs">
                    <LoaderCircle className="size-4 shrink-0 animate-spin" />
                    <span>
                        {redirecting ? "Redirecting to sign in..." : "Checking session..."}
                    </span>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
