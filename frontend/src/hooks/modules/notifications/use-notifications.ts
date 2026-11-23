"use client"

import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest } from "@/lib/api-request"
import { useSession } from "@/hooks/use-session"

const positiveInt = z.int().positive().max(2_147_483_647)

export const notificationRoleSchema = z.object({
    roleId: positiveInt,
    name: z.string(),
    description: z.string().nullable(),
    settings: z.record(z.string(), z.boolean().optional()).default({}),
})

export const roleNotificationSchema = z.object({
    notificationId: positiveInt,
    title: z.string(),
    message: z.string(),
    module: z.string(),
    action: z.string(),
    entityId: z.string().nullable(),
    route: z.string().nullable(),
    targetRoleIds: z.array(positiveInt),
    targetRoleNames: z.array(z.string()),
    selectionMode: z.enum(["auto", "custom", "manual"]),
    actorUserId: positiveInt.nullable(),
    actorName: z.string(),
    actorRoleId: positiveInt.nullable(),
    actorRoleName: z.string().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    isRead: z.boolean(),
})

export const notificationListResponseSchema = z.object({
    items: z.array(roleNotificationSchema),
    unreadCount: z.number().int().nonnegative(),
})

export const sendNotificationSchema = z.object({
    title: z.string().trim().min(1, "Enter a notification title.").max(120),
    message: z.string().trim().min(1, "Enter a message.").max(500),
    targetRoleIds: z.array(positiveInt).min(1, "Select at least one target role."),
    route: z.string().trim().max(200).optional(),
})

export type NotificationRole = z.output<typeof notificationRoleSchema>
export type RoleNotification = z.output<typeof roleNotificationSchema>
export type NotificationListResponse = z.output<typeof notificationListResponseSchema>
export type SendNotificationInput = z.output<typeof sendNotificationSchema>

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const
export const NOTIFICATION_ROLES_QUERY_KEY = ["notification-roles"] as const
const EMPTY_ROLES: NotificationRole[] = []
const EMPTY_ITEMS: RoleNotification[] = []

export async function getNotificationRoles(signal?: AbortSignal): Promise<NotificationRole[]> {
    const raw = await apiRequest("/notifications/roles", { signal })
    const parsed = notificationRoleSchema.array().safeParse(raw)
    if (!parsed.success) throw new Error("Invalid notification roles payload.")
    return parsed.data
}

export async function getRoleNotifications(
    signal?: AbortSignal,
): Promise<NotificationListResponse> {
    const raw = await apiRequest("/notifications?limit=40", { signal })
    const parsed = notificationListResponseSchema.safeParse(raw)
    if (!parsed.success) throw new Error("Invalid notifications payload.")
    return parsed.data
}

export async function sendManualNotification(
    input: SendNotificationInput,
): Promise<RoleNotification> {
    const raw = await apiRequest("/notifications", {
        method: "POST",
        body: JSON.stringify(input),
    })
    const parsed = roleNotificationSchema.safeParse(raw)
    if (!parsed.success) throw new Error("Invalid created notification payload.")
    return parsed.data
}

export async function markNotificationRead(notificationId: number): Promise<void> {
    await apiRequest(`/notifications/${notificationId}/read`, { method: "PATCH" }, true)
}

export async function markAllNotificationsRead(): Promise<void> {
    await apiRequest("/notifications/read-all", { method: "POST" }, true)
}

export async function getSocketToken(signal?: AbortSignal): Promise<string> {
    const raw = await apiRequest("/auth/socket-token", { signal })
    const parsed = z.object({ token: z.string().min(1) }).safeParse(raw)
    if (!parsed.success) throw new Error("Invalid socket authentication response.")
    return parsed.data.token
}

export function useNotifications(options?: { fetchRoles?: boolean }) {
    const session = useSession()
    const queryClient = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const userId = session.data?.userId
    const enabled = Boolean(userId)
    const fetchRoles = options?.fetchRoles ?? true

    const rolesQuery = useQuery({
        queryKey: [...NOTIFICATION_ROLES_QUERY_KEY, userId],
        queryFn: ({ signal }) => getNotificationRoles(signal),
        enabled: enabled && fetchRoles,
        staleTime: 5 * 60_000,
    })

    const inboxQuery = useQuery({
        queryKey: [...NOTIFICATIONS_QUERY_KEY, userId],
        queryFn: ({ signal }) => getRoleNotifications(signal),
        enabled,
        staleTime: 60_000,
    })

    const markRead = useMutation({
        mutationFn: (notificationId: number) => markNotificationRead(notificationId),
        onMutate: async (notificationId) => {
            const inboxKey = [...NOTIFICATIONS_QUERY_KEY, userId]
            await queryClient.cancelQueries({ queryKey: inboxKey })
            const previous = queryClient.getQueryData<NotificationListResponse>(inboxKey)
            queryClient.setQueryData<NotificationListResponse>(inboxKey, (prev) => {
                if (!prev) return prev
                let decremented = false
                const items = prev.items.map((item) => {
                    if (item.notificationId === notificationId && !item.isRead) {
                        decremented = true
                        return { ...item, isRead: true }
                    }
                    return item
                })
                return {
                    items,
                    unreadCount: decremented ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
                }
            })
            return { previous }
        },
        onError: (_err, _notificationId, context) => {
            if (context?.previous) {
                queryClient.setQueryData([...NOTIFICATIONS_QUERY_KEY, userId], context.previous)
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
        },
    })

    const markAllRead = useMutation({
        mutationFn: () => markAllNotificationsRead(),
        onMutate: async () => {
            const inboxKey = [...NOTIFICATIONS_QUERY_KEY, userId]
            await queryClient.cancelQueries({ queryKey: inboxKey })
            const previous = queryClient.getQueryData<NotificationListResponse>(inboxKey)
            queryClient.setQueryData<NotificationListResponse>(inboxKey, (prev) => {
                if (!prev) return prev
                return {
                    items: prev.items.map((item) => ({ ...item, isRead: true })),
                    unreadCount: 0,
                }
            })
            return { previous }
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData([...NOTIFICATIONS_QUERY_KEY, userId], context.previous)
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
        },
    })

    const sendNotification = useMutation({
        mutationFn: (input: SendNotificationInput) => sendManualNotification(input),
        onSuccess: (created) => {
            void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
            showToast({
                type: "success",
                title: "Role notification sent",
                description: `Notified ${created.targetRoleNames.join(", ") || "selected roles"}.`,
            })
        },
        onError: (error: Error) => {
            showToast({
                type: "error",
                title: "Failed to send notification",
                description: error.message,
            })
        },
    })

    return {
        roles: rolesQuery.data ?? EMPTY_ROLES,
        items: inboxQuery.data?.items ?? EMPTY_ITEMS,
        unreadCount: inboxQuery.data?.unreadCount ?? 0,
        isLoadingInbox: inboxQuery.isPending,
        markRead,
        markAllRead,
        sendNotification,
        refetchInbox: () => void inboxQuery.refetch(),
    }
}
