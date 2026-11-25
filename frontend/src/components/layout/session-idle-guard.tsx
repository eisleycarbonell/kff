"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { ApiError } from "@/lib/api-request"
import {
    LAST_ACTIVITY_STORAGE_KEY,
    SESSION_ACTIVITY_THROTTLE_MS,
    SESSION_IDLE_TIMEOUT_MS,
    SESSION_IDLE_WARNING_BEFORE_MS,
    SESSION_LOGOUT_STORAGE_KEY,
    broadcastSessionLogout,
    clearLastActivityTimestamp,
    getIdleRemainingMs,
    isSessionIdleExpired,
    parseLogoutBroadcast,
    parseStoredTimestamp,
    readLastActivityTimestamp,
    shouldSendSessionKeepalive,
    shouldWarnIdleTimeout,
    writeLastActivityTimestamp,
} from "@/lib/idle-session"
import {
    clearClientSession,
    keepaliveSession,
    logoutSession,
    useSession,
} from "@/hooks/use-session"

const ACTIVITY_EVENTS = [
    "pointerdown",
    "keydown",
    "wheel",
    "touchstart",
    "mousemove",
] as const

/** Automatically signs out sessions after 3 hours of user inactivity across tabs. */
export function SessionIdleGuard() {
    const session = useSession()
    const queryClient = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const userId = session.data?.userId ?? null

    useEffect(() => {
        if (!userId) return

        let disposed = false
        let loggingOut = false
        let warningShown = false
        let warningTimer: ReturnType<typeof setTimeout> | null = null
        let logoutTimer: ReturnType<typeof setTimeout> | null = null
        let keepaliveInFlight = false

        const initialStored = readLastActivityTimestamp()
        let lastActivityAt = initialStored ?? Date.now()
        let lastKeepaliveAt = Date.now()
        if (initialStored === null) {
            writeLastActivityTimestamp(lastActivityAt)
        }

        const clearTimers = () => {
            if (warningTimer !== null) {
                clearTimeout(warningTimer)
                warningTimer = null
            }
            if (logoutTimer !== null) {
                clearTimeout(logoutTimer)
                logoutTimer = null
            }
        }

        const finishIdleLogout = async (options: {
            callServer: boolean
            broadcast: boolean
            showInactivityToast: boolean
        }) => {
            if (disposed || loggingOut) return
            loggingOut = true
            clearTimers()
            clearLastActivityTimestamp()
            if (options.broadcast) {
                broadcastSessionLogout("idle")
            }
            if (options.callServer) {
                await logoutSession().catch(() => {})
            }
            if (disposed) return
            clearClientSession(queryClient)
            if (options.showInactivityToast) {
                showToast({
                    type: "warning",
                    title: "Signed out due to inactivity",
                    description:
                        "Your session timed out after 3 hours of inactivity. Please sign in again.",
                })
            }
        }

        const showWarningToast = () => {
            if (disposed || loggingOut || warningShown) return
            warningShown = true
            showToast({
                type: "warning",
                title: "Session expiring soon",
                description: "You will be signed out in 5 minutes due to inactivity.",
            })
        }

        const scheduleTimers = () => {
            clearTimers()
            if (disposed || loggingOut) return

            const now = Date.now()
            if (isSessionIdleExpired(lastActivityAt, now, SESSION_IDLE_TIMEOUT_MS)) {
                void finishIdleLogout({
                    callServer: true,
                    broadcast: true,
                    showInactivityToast: true,
                })
                return
            }

            const remainingMs = getIdleRemainingMs(
                lastActivityAt,
                now,
                SESSION_IDLE_TIMEOUT_MS,
            )
            if (
                shouldWarnIdleTimeout(
                    lastActivityAt,
                    now,
                    SESSION_IDLE_TIMEOUT_MS,
                    SESSION_IDLE_WARNING_BEFORE_MS,
                )
            ) {
                showWarningToast()
            } else {
                const warnDelay = remainingMs - SESSION_IDLE_WARNING_BEFORE_MS
                if (warnDelay > 0) {
                    warningTimer = setTimeout(showWarningToast, warnDelay)
                }
            }

            logoutTimer = setTimeout(() => {
                void finishIdleLogout({
                    callServer: true,
                    broadcast: true,
                    showInactivityToast: true,
                })
            }, remainingMs)
        }

        const maybeSendKeepalive = (now: number) => {
            if (
                disposed ||
                loggingOut ||
                keepaliveInFlight ||
                !shouldSendSessionKeepalive(lastActivityAt, lastKeepaliveAt, now)
            ) {
                return
            }
            keepaliveInFlight = true
            lastKeepaliveAt = now
            void keepaliveSession()
                .catch((error) => {
                    if (error instanceof ApiError && error.status === 401) {
                        void finishIdleLogout({
                            callServer: false,
                            broadcast: true,
                            showInactivityToast: true,
                        })
                    }
                })
                .finally(() => {
                    keepaliveInFlight = false
                })
        }

        const recordActivity = () => {
            if (disposed || loggingOut) return
            const now = Date.now()
            if (isSessionIdleExpired(lastActivityAt, now, SESSION_IDLE_TIMEOUT_MS)) {
                void finishIdleLogout({
                    callServer: true,
                    broadcast: true,
                    showInactivityToast: true,
                })
                return
            }
            if (now - lastActivityAt < SESSION_ACTIVITY_THROTTLE_MS) {
                return
            }
            lastActivityAt = now
            warningShown = false
            writeLastActivityTimestamp(now)
            scheduleTimers()
            maybeSendKeepalive(now)
        }

        const enforceFreshState = () => {
            if (disposed || loggingOut) return
            const stored = readLastActivityTimestamp()
            if (stored !== null && stored > lastActivityAt) {
                lastActivityAt = stored
                warningShown = false
            }
            const now = Date.now()
            if (isSessionIdleExpired(lastActivityAt, now, SESSION_IDLE_TIMEOUT_MS)) {
                void finishIdleLogout({
                    callServer: true,
                    broadcast: true,
                    showInactivityToast: true,
                })
                return
            }
            scheduleTimers()
            maybeSendKeepalive(now)
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                enforceFreshState()
            }
        }

        const handleStorage = (event: StorageEvent) => {
            if (disposed || loggingOut) return
            if (event.key === SESSION_LOGOUT_STORAGE_KEY) {
                const payload = parseLogoutBroadcast(event.newValue)
                if (payload) {
                    void finishIdleLogout({
                        callServer: false,
                        broadcast: false,
                        showInactivityToast: payload.reason === "idle",
                    })
                }
                return
            }
            if (event.key === LAST_ACTIVITY_STORAGE_KEY) {
                const parsed = parseStoredTimestamp(event.newValue)
                if (parsed !== null && parsed > lastActivityAt) {
                    lastActivityAt = parsed
                    warningShown = false
                    scheduleTimers()
                }
            }
        }

        scheduleTimers()

        for (const eventName of ACTIVITY_EVENTS) {
            window.addEventListener(eventName, recordActivity, { passive: true })
        }
        document.addEventListener("visibilitychange", handleVisibilityChange)
        window.addEventListener("focus", enforceFreshState)
        window.addEventListener("storage", handleStorage)

        return () => {
            disposed = true
            clearTimers()
            for (const eventName of ACTIVITY_EVENTS) {
                window.removeEventListener(eventName, recordActivity)
            }
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            window.removeEventListener("focus", enforceFreshState)
            window.removeEventListener("storage", handleStorage)
        }
    }, [userId, queryClient, showToast])

    return null
}
