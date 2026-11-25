"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLogout, useSession, type Session } from "@/hooks/use-session"
import { useNotifications } from "@/hooks/modules/notifications/use-notifications"

import { BadgeCheck, Bell, ChevronsUpDown, LogOut, RefreshCw, ShieldCheck } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { RoleNotificationsSheet } from "@/components/layout/role-notifications-sheet"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"

const PERMISSION_LABELS: ReadonlyArray<{
    key: keyof Pick<
        Session["permissions"],
        | "canManageInventory"
        | "canManagePurchasing"
        | "canManagePacking"
        | "canManageTransfers"
        | "canManageAccounting"
        | "canManageUsers"
    >
    label: string
}> = [
    { key: "canManageInventory", label: "Inventory & Sales" },
    { key: "canManagePurchasing", label: "Purchasing" },
    { key: "canManagePacking", label: "Packing & Formulas" },
    { key: "canManageTransfers", label: "Transfers & Deliveries" },
    { key: "canManageAccounting", label: "Accounting" },
    { key: "canManageUsers", label: "Users & Settings" },
]

function getInitials(name: string): string {
    const letters = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    return letters || "?"
}

export function NavUser({
    user: fallbackUser,
}: {
    user?: {
        name: string
        email: string
        avatar: string
    }
}) {
    const { isMobile } = useSidebar()
    const session = useSession()
    const logout = useLogout()
    const router = useRouter()
    const [notificationsOpen, setNotificationsOpen] = useState(false)
    const [notificationsMounted, setNotificationsMounted] = useState(false)
    const [accountOpen, setAccountOpen] = useState(false)
    const { roles, unreadCount } = useNotifications({
        fetchRoles: accountOpen || notificationsOpen,
    })

    const currentRoleName = useMemo(() => {
        const roleId = session.data?.roleId
        if (!roleId) return null
        return roles.find((role) => role.roleId === roleId)?.name ?? null
    }, [roles, session.data?.roleId])

    const displayUser = useMemo(() => {
        if (session.data) {
            const fullName = `${session.data.firstName} ${session.data.lastName}`.trim()
            return {
                name: fullName || session.data.email,
                email: session.data.email,
                avatar: fallbackUser?.avatar ?? "",
                initials: getInitials(fullName || session.data.email),
            }
        }
        if (session.isPending) {
            return {
                name: "Checking session...",
                email: "Verifying credentials...",
                avatar: "",
                initials: "...",
            }
        }
        return {
            name: "Not signed in",
            email: "Sign in required",
            avatar: "",
            initials: "?",
        }
    }, [fallbackUser?.avatar, session.data, session.isPending])

    const badgeText = unreadCount > 99 ? "99+" : String(unreadCount)

    async function handleSignOut() {
        if (!session.data) {
            setAccountOpen(false)
            router.push("/")
            return
        }
        try {
            await logout.mutateAsync()
            setAccountOpen(false)
            router.push("/")
        } catch {
            // If session became unauthenticated concurrently, still send the user to sign in.
            if (!session.data) {
                setAccountOpen(false)
                router.push("/")
            }
        }
    }

    const sessionStatusLabel = session.data
        ? "Active"
        : session.isPending
          ? "Checking..."
          : session.isError
            ? "Session check failed"
            : "Signed out"

    const sessionStatusVariant = session.data
        ? "default"
        : session.isError
          ? "destructive"
          : "secondary"

    return (
        <>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                                />
                            }
                        >
                            <Avatar className="h-8 w-8 rounded-lg">
                                {displayUser.avatar && (
                                    <AvatarImage src={displayUser.avatar} alt={displayUser.name} />
                                )}
                                <AvatarFallback className="rounded-lg">
                                    {displayUser.initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{displayUser.name}</span>
                                <span className="truncate text-xs">{displayUser.email}</span>
                            </div>
                            {unreadCount > 0 && (
                                <span
                                    aria-label={`${unreadCount} unread notifications`}
                                    className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums"
                                >
                                    {badgeText}
                                </span>
                            )}
                            <ChevronsUpDown className="ml-auto size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            className="w-(--anchor-width) min-w-56 max-w-[calc(100vw-1rem)] rounded-lg"
                            side={isMobile ? "bottom" : "right"}
                            align="end"
                            sideOffset={4}
                        >
                            <DropdownMenuGroup>
                                <DropdownMenuLabel className="p-0 font-normal">
                                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                        <Avatar className="h-8 w-8 rounded-lg">
                                            {displayUser.avatar && (
                                                <AvatarImage
                                                    src={displayUser.avatar}
                                                    alt={displayUser.name}
                                                />
                                            )}
                                            <AvatarFallback className="rounded-lg">
                                                {displayUser.initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-medium">
                                                {displayUser.name}
                                            </span>
                                            <span className="truncate text-xs">
                                                {displayUser.email}
                                            </span>
                                        </div>
                                    </div>
                                </DropdownMenuLabel>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => setAccountOpen(true)}>
                                    <BadgeCheck />
                                    Account
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setNotificationsMounted(true)
                                        setNotificationsOpen(true)
                                    }}
                                >
                                    <Bell />
                                    <span className="flex-1">Notifications</span>
                                    {unreadCount > 0 && (
                                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums">
                                            {badgeText}
                                        </span>
                                    )}
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem
                                    disabled={logout.isPending}
                                    onClick={() => void handleSignOut()}
                                >
                                    <LogOut />
                                    {logout.isPending
                                        ? "Signing out..."
                                        : session.data
                                          ? "Log out"
                                          : "Sign in"}
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>
            <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
                            <DialogTitle>Account &amp; Session</DialogTitle>
                            <Badge variant={sessionStatusVariant}>{sessionStatusLabel}</Badge>
                        </div>
                        <DialogDescription>
                            Live session identity and role permissions verified against the server.
                        </DialogDescription>
                    </DialogHeader>

                    {session.data ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-2">
                                <div className="min-w-0">
                                    <p className="text-muted-foreground">Name</p>
                                    <p className="truncate font-medium text-foreground">
                                        {displayUser.name}
                                    </p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-muted-foreground">Email</p>
                                    <p className="truncate font-medium text-foreground">
                                        {session.data.email}
                                    </p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-muted-foreground">User ID</p>
                                    <p className="font-mono font-medium text-foreground">
                                        #{session.data.userId}
                                    </p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-muted-foreground">Role</p>
                                    <p className="truncate font-medium text-foreground">
                                        {currentRoleName
                                            ? `${currentRoleName} (#${session.data.roleId})`
                                            : `Role #${session.data.roleId}`}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                    <ShieldCheck className="size-3.5 text-muted-foreground" />
                                    <span>Role permissions</span>
                                </div>
                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                    {PERMISSION_LABELS.map(({ key, label }) => {
                                        const granted = session.data?.permissions[key] === true
                                        return (
                                            <div
                                                key={key}
                                                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                                            >
                                                <span className="truncate text-foreground">
                                                    {label}
                                                </span>
                                                <Badge
                                                    variant={granted ? "default" : "outline"}
                                                    className="shrink-0 text-[10px]"
                                                >
                                                    {granted ? "Granted" : "No access"}
                                                </Badge>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                            {session.isPending
                                ? "Checking current session with the server..."
                                : session.isError
                                  ? `Unable to verify session: ${session.error.message}`
                                  : "Your session is signed out or has expired. Sign in again to continue."}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={session.isFetching}
                            onClick={() => void session.refetch()}
                        >
                            <RefreshCw
                                className={session.isFetching ? "animate-spin" : undefined}
                            />
                            {session.isFetching ? "Verifying..." : "Verify Session"}
                        </Button>
                        <Button
                            type="button"
                            variant={session.data ? "destructive" : "default"}
                            size="sm"
                            disabled={logout.isPending}
                            onClick={() => void handleSignOut()}
                        >
                            <LogOut />
                            {logout.isPending
                                ? "Signing out..."
                                : session.data
                                  ? "Log out"
                                  : "Sign in"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {notificationsMounted ? (
                <RoleNotificationsSheet
                    open={notificationsOpen}
                    onOpenChange={setNotificationsOpen}
                />
            ) : null}
        </>
    )
}
