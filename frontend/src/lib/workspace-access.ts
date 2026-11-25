export type WorkspaceSession = {
    permissions?: Record<string, boolean | undefined>
} | null | undefined

/** Return true only for Accounting-focused roles with no operational/admin management flags. */
export function isAccountingOnlySession(session: WorkspaceSession): boolean {
    const permissions = session?.permissions
    if (!permissions) return false
    return (
        permissions.canManageAccounting === true &&
        permissions.canManageInventory !== true &&
        permissions.canManagePurchasing !== true &&
        permissions.canManagePacking !== true &&
        permissions.canManageTransfers !== true &&
        permissions.canManageUsers !== true
    )
}

/** Return true when the path belongs to the standalone Accounting Portal (`/accounting` or `/accounting/*`). */
export function isAccountingRoute(pathname: string): boolean {
    const normalized = pathname.replace(/\/+$/, "") || "/"
    return normalized === "/accounting" || normalized.startsWith("/accounting/")
}

/** Default landing route after sign-in based on workspace role boundaries. */
export function getHomeRouteForSession(
    session: WorkspaceSession,
): "/accounting" | "/dashboard" {
    return isAccountingOnlySession(session) ? "/accounting" : "/dashboard"
}

/** Return redirect target if the signed-in user landed in the wrong workspace, or null when allowed. */
export function getWorkspaceRedirect(
    session: WorkspaceSession,
    pathname: string,
): "/accounting" | "/dashboard" | null {
    if (!session) return null
    const accountingOnly = isAccountingOnlySession(session)
    const onAccountingRoute = isAccountingRoute(pathname)
    if (accountingOnly && !onAccountingRoute) return "/accounting"
    if (!accountingOnly && onAccountingRoute) return "/dashboard"
    return null
}

/** Return true when a target route is reachable from the signed-in user's workspace. */
export function canNavigateToRoute(
    session: WorkspaceSession,
    route: string | null | undefined,
): boolean {
    if (!session || !route) return false
    return isAccountingOnlySession(session)
        ? isAccountingRoute(route)
        : !isAccountingRoute(route)
}
