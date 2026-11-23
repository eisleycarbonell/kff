"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { io, type Socket } from "socket.io-client"
import { useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, resolveSocketUrl } from "@/lib/api-request"
import { useNotifyTargetStore } from "@/lib/realtime-notify-store"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    NOTIFICATION_ROLES_QUERY_KEY,
    NOTIFICATIONS_QUERY_KEY,
    getSocketToken,
    roleNotificationSchema,
    type NotificationListResponse,
} from "@/hooks/modules/notifications/use-notifications"

export type RealtimeStatus = "offline" | "connecting" | "connected" | "reconnecting"

type RealtimeContextValue = {
    status: RealtimeStatus
    lastSyncAt: string | null
    lastSyncModule: string | null
}

const RealtimeContext = createContext<RealtimeContextValue>({
    status: "offline",
    lastSyncAt: null,
    lastSyncModule: null,
})

export function useRealtime() {
    return useContext(RealtimeContext)
}

const SYNC_COALESCE_MS = 80
const FALLBACK_POLL_MS = 30_000
const MAX_SOCKET_RETRIES = 5

export function RealtimeProvider({ children }: { children: ReactNode }) {
    const session = useSession()
    const queryClient = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const userId = session.data?.userId ?? null

    const [status, setStatus] = useState<RealtimeStatus>("connecting")

    useEffect(() => {
        if (!userId) {
            useNotifyTargetStore.getState().setSocketId(null)
            return
        }

        let disposed = false
        let needsTokenAuth = process.env.NEXT_PUBLIC_API_PROXY === "true"
        let consecutiveFailures = 0
        let healthChecked = false
        let fallbackActive = false
        let fallbackTimer: ReturnType<typeof setInterval> | null = null

        const pendingKeys = new Set<string>()
        let flushTimer: ReturnType<typeof setTimeout> | null = null

        const flushPendingSyncs = () => {
            flushTimer = null
            if (disposed || pendingKeys.size === 0) return
            if (typeof document !== "undefined" && document.visibilityState === "hidden") {
                return
            }
            const keysToInvalidate = [...pendingKeys]
            pendingKeys.clear()

            for (const rootKey of keysToInvalidate) {
                void queryClient.invalidateQueries({ queryKey: [rootKey] })
            }
            if (keysToInvalidate.includes("session")) {
                void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            }
        }

        const activateFallbackSync = () => {
            if (disposed || fallbackActive) return
            fallbackActive = true
            useNotifyTargetStore.getState().setSocketId(null)
            setStatus("offline")
            socket.disconnect()

            if (fallbackTimer === null) {
                fallbackTimer = setInterval(() => {
                    if (
                        !disposed &&
                        (typeof document === "undefined" || document.visibilityState === "visible")
                    ) {
                        void queryClient.invalidateQueries({ refetchType: "active" })
                    }
                }, FALLBACK_POLL_MS)
            }
        }

        const checkRealtimeHealth = async () => {
            if (healthChecked || disposed || fallbackActive) return
            healthChecked = true
            try {
                const health = (await apiRequest("/health")) as { realtime?: boolean } | null
                if (health && health.realtime === false) {
                    activateFallbackSync()
                }
            } catch {
                // Keep retrying until MAX_SOCKET_RETRIES decides.
            }
        }

        const handleVisibilityChange = () => {
            if (disposed || document.visibilityState !== "visible") return
            if (fallbackActive) {
                void queryClient.invalidateQueries({ refetchType: "active" })
                return
            }
            flushPendingSyncs()
        }

        const handleWindowFocus = () => {
            if (disposed) return
            if (fallbackActive) {
                void queryClient.invalidateQueries({ refetchType: "active" })
            }
        }

        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", handleVisibilityChange)
        }
        if (typeof window !== "undefined") {
            window.addEventListener("focus", handleWindowFocus)
        }

        const socketUrl = resolveSocketUrl()
        const socket: Socket = io(socketUrl || undefined, {
            withCredentials: true,
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: MAX_SOCKET_RETRIES,
            reconnectionDelay: 1500,
            reconnectionDelayMax: 10_000,
            auth: async (cb) => {
                if (!needsTokenAuth) {
                    cb({})
                    return
                }
                try {
                    const token = await getSocketToken()
                    cb({ token })
                } catch {
                    cb({})
                }
            },
        })

        socket.on("connect", () => {
            if (disposed) return
            consecutiveFailures = 0
            setStatus("connected")
            useNotifyTargetStore.getState().setSocketId(socket.id ?? null)
        })

        socket.on("realtime:ready", () => {
            if (disposed) return
            consecutiveFailures = 0
            setStatus("connected")
            useNotifyTargetStore.getState().setSocketId(socket.id ?? null)
        })

        socket.io.on("reconnect_attempt", () => {
            if (!disposed && !fallbackActive) setStatus("reconnecting")
        })

        socket.io.on("reconnect_failed", () => {
            activateFallbackSync()
        })

        socket.on("disconnect", () => {
            if (disposed) return
            useNotifyTargetStore.getState().setSocketId(null)
            if (!fallbackActive) setStatus("reconnecting")
        })

        socket.on("connect_error", (error) => {
            if (disposed || fallbackActive) return
            consecutiveFailures += 1
            if (error?.message && /auth|session|token/i.test(error.message)) {
                needsTokenAuth = true
            }
            if (consecutiveFailures >= 3) {
                void checkRealtimeHealth()
            }
            if (consecutiveFailures >= MAX_SOCKET_RETRIES) {
                activateFallbackSync()
                return
            }
            setStatus("reconnecting")
        })

        // Real-time data sync broadcast for ALL connected roles & users, coalesced and visibility-aware.
        socket.on(
            "data:sync",
            (payload: {
                module?: string
                queryKeys?: string[]
                timestamp?: string
            }) => {
                if (disposed) return
                const keys = Array.isArray(payload?.queryKeys) ? payload.queryKeys : []
                for (const rootKey of keys) {
                    if (typeof rootKey === "string" && rootKey.trim()) {
                        pendingKeys.add(rootKey.trim())
                    }
                }
                if (
                    pendingKeys.size > 0 &&
                    flushTimer === null &&
                    (typeof document === "undefined" || document.visibilityState !== "hidden")
                ) {
                    flushTimer = setTimeout(flushPendingSyncs, SYNC_COALESCE_MS)
                }
            },
        )

        // Role-targeted notification delivered only to users in targetRoleIds rooms.
        socket.on("notification:new", (rawPayload: unknown) => {
            if (disposed) return
            const parsed = roleNotificationSchema.safeParse(rawPayload)
            if (!parsed.success) return

            const notification = parsed.data
            const inboxKey = [...NOTIFICATIONS_QUERY_KEY, userId]
            const cached = queryClient.getQueryData<NotificationListResponse>(inboxKey)

            if (cached) {
                queryClient.setQueryData<NotificationListResponse>(inboxKey, (prev) => {
                    if (!prev) return prev
                    if (
                        prev.items.some(
                            (existing) => existing.notificationId === notification.notificationId,
                        )
                    ) {
                        return prev
                    }
                    return {
                        items: [notification, ...prev.items].slice(0, 40),
                        unreadCount: notification.isRead
                            ? prev.unreadCount
                            : prev.unreadCount + 1,
                    }
                })
            } else {
                void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
            }

            if (notification.actorUserId !== userId) {
                const roleTargets =
                    notification.targetRoleNames.length > 0
                        ? ` [${notification.targetRoleNames.join(", ")}]`
                        : ""
                showToast({
                    type: "info",
                    title: `${notification.title}${roleTargets}`,
                    description: notification.message,
                })
            }
        })

        // Role or permission update: refresh current session & notifications seamlessly.
        socket.on("session:refresh", () => {
            if (disposed) return
            void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
            void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
            void queryClient.invalidateQueries({ queryKey: NOTIFICATION_ROLES_QUERY_KEY })
        })

        return () => {
            disposed = true
            if (flushTimer !== null) {
                clearTimeout(flushTimer)
                flushTimer = null
            }
            if (fallbackTimer !== null) {
                clearInterval(fallbackTimer)
                fallbackTimer = null
            }
            if (typeof document !== "undefined") {
                document.removeEventListener("visibilitychange", handleVisibilityChange)
            }
            if (typeof window !== "undefined") {
                window.removeEventListener("focus", handleWindowFocus)
            }
            pendingKeys.clear()
            useNotifyTargetStore.getState().setSocketId(null)
            socket.disconnect()
        }
    }, [userId, queryClient, showToast])

    const contextValue = useMemo<RealtimeContextValue>(
        () => ({
            status: userId ? status : "offline",
            lastSyncAt: null,
            lastSyncModule: null,
        }),
        [status, userId],
    )

    return <RealtimeContext.Provider value={contextValue}>{children}</RealtimeContext.Provider>
}
