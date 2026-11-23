"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Check, CheckCheck, ExternalLink } from "lucide-react"
import { useNotifications } from "@/hooks/modules/notifications/use-notifications"
import { useSession } from "@/hooks/use-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "cn"

function formatRelativeTime(iso: string): string {
    const timestamp = Date.parse(iso)
    if (!Number.isFinite(timestamp)) return ""
    const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
    if (diffSeconds < 60) return "Just now"
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return new Date(timestamp).toLocaleDateString()
}

export function RoleNotificationsSheet({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const session = useSession()
    const { roles, items, unreadCount, isLoadingInbox, markRead, markAllRead } = useNotifications()
    const [unreadOnly, setUnreadOnly] = useState(false)

    const currentRoleName = useMemo(() => {
        const roleId = session.data?.roleId
        if (!roleId) return ""
        return roles.find((r) => r.roleId === roleId)?.name ?? ""
    }, [roles, session.data?.roleId])

    const visibleItems = useMemo(
        () => (unreadOnly ? items.filter((item) => !item.isRead) : items),
        [items, unreadOnly],
    )

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex w-full flex-col sm:max-w-md">
                <SheetHeader>
                    <div className="flex items-center justify-between gap-2 pr-8">
                        <SheetTitle>Notifications</SheetTitle>
                        {currentRoleName && (
                            <Badge variant="outline" className="text-[11px]">
                                {currentRoleName}
                            </Badge>
                        )}
                    </div>
                    <SheetDescription>
                        Alerts routed to your role. Operational data syncs automatically across all users.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-xs">
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                size="xs"
                                variant={!unreadOnly ? "secondary" : "ghost"}
                                onClick={() => setUnreadOnly(false)}
                            >
                                All
                            </Button>
                            <Button
                                type="button"
                                size="xs"
                                variant={unreadOnly ? "secondary" : "ghost"}
                                onClick={() => setUnreadOnly(true)}
                            >
                                Unread ({unreadCount})
                            </Button>
                        </div>
                        <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            disabled={unreadCount === 0 || markAllRead.isPending}
                            onClick={() => markAllRead.mutate()}
                        >
                            <CheckCheck className="mr-1 size-3.5" />
                            Mark all read
                        </Button>
                    </div>

                    <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                        {isLoadingInbox && (
                            <p className="py-8 text-center text-xs text-muted-foreground">
                                Loading notifications...
                            </p>
                        )}
                        {!isLoadingInbox && visibleItems.length === 0 && (
                            <p className="py-8 text-center text-xs text-muted-foreground">
                                {unreadOnly
                                    ? "All caught up! No unread notifications."
                                    : "No notifications yet. Updates will appear here in real time."}
                            </p>
                        )}
                        {visibleItems.map((item) => (
                            <div
                                key={item.notificationId}
                                className={cn(
                                    "space-y-2 rounded-lg border p-3 text-xs transition-colors",
                                    item.isRead
                                        ? "bg-card text-muted-foreground"
                                        : "border-primary/40 bg-primary/5 text-foreground",
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            {!item.isRead && (
                                                <span className="size-2 shrink-0 rounded-full bg-primary" />
                                            )}
                                            <p className="truncate font-semibold text-foreground">
                                                {item.title}
                                            </p>
                                        </div>
                                        <p className="mt-1 leading-relaxed">{item.message}</p>
                                    </div>
                                    <span className="shrink-0 text-[10px] text-muted-foreground">
                                        {formatRelativeTime(item.createdAt)}
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                    <div className="flex flex-wrap items-center gap-1">
                                        {item.targetRoleNames.map((roleName) => (
                                            <Badge
                                                key={roleName}
                                                variant="secondary"
                                                className="text-[10px]"
                                            >
                                                {roleName}
                                            </Badge>
                                        ))}
                                        <span className="text-[10px] text-muted-foreground">
                                            by {item.actorName}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {item.route && (
                                            <Button
                                                type="button"
                                                size="xs"
                                                variant="ghost"
                                                render={
                                                    <Link
                                                        href={item.route}
                                                        onClick={() => onOpenChange(false)}
                                                    />
                                                }
                                                nativeButton={false}
                                            >
                                                Open
                                                <ExternalLink className="ml-1 size-3" />
                                            </Button>
                                        )}
                                        {!item.isRead && (
                                            <Button
                                                type="button"
                                                size="xs"
                                                variant="outline"
                                                onClick={() =>
                                                    markRead.mutate(item.notificationId)
                                                }
                                            >
                                                <Check className="mr-1 size-3" />
                                                Read
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
