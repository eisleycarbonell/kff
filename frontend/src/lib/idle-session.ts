export const SESSION_IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000
export const SESSION_IDLE_WARNING_BEFORE_MS = 5 * 60 * 1000
export const SESSION_KEEPALIVE_INTERVAL_MS = 15 * 60 * 1000
export const SESSION_ACTIVITY_THROTTLE_MS = 15 * 1000

export const LAST_ACTIVITY_STORAGE_KEY = "kff:last-activity-at"
export const SESSION_LOGOUT_STORAGE_KEY = "kff:session-logout-at"

export function parseStoredTimestamp(raw: string | null | undefined): number | null {
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function parseLogoutBroadcast(
    raw: string | null | undefined,
): { reason: "idle" | "manual"; at: number } | null {
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as { reason?: unknown; at?: unknown }
        if (
            (parsed.reason === "idle" || parsed.reason === "manual") &&
            typeof parsed.at === "number" &&
            Number.isFinite(parsed.at) &&
            parsed.at > 0
        ) {
            return { reason: parsed.reason, at: parsed.at }
        }
    } catch {
        // Ignore malformed storage entries.
    }
    return null
}

export function getIdleRemainingMs(
    lastActivityAt: number,
    now = Date.now(),
    timeoutMs = SESSION_IDLE_TIMEOUT_MS,
): number {
    return Math.max(0, lastActivityAt + timeoutMs - now)
}

export function isSessionIdleExpired(
    lastActivityAt: number,
    now = Date.now(),
    timeoutMs = SESSION_IDLE_TIMEOUT_MS,
): boolean {
    return now - lastActivityAt >= timeoutMs
}

export function shouldWarnIdleTimeout(
    lastActivityAt: number,
    now = Date.now(),
    timeoutMs = SESSION_IDLE_TIMEOUT_MS,
    warningBeforeMs = SESSION_IDLE_WARNING_BEFORE_MS,
): boolean {
    const remaining = getIdleRemainingMs(lastActivityAt, now, timeoutMs)
    return remaining > 0 && remaining <= warningBeforeMs
}

export function shouldSendSessionKeepalive(
    lastActivityAt: number,
    lastKeepaliveAt: number,
    now = Date.now(),
    keepaliveIntervalMs = SESSION_KEEPALIVE_INTERVAL_MS,
    timeoutMs = SESSION_IDLE_TIMEOUT_MS,
): boolean {
    if (isSessionIdleExpired(lastActivityAt, now, timeoutMs)) return false
    return lastActivityAt > lastKeepaliveAt && now - lastKeepaliveAt >= keepaliveIntervalMs
}

function getLocalStorage(): Storage | null {
    if (typeof window === "undefined") return null
    try {
        return window.localStorage
    } catch {
        return null
    }
}

export function readLastActivityTimestamp(): number | null {
    const storage = getLocalStorage()
    if (!storage) return null
    try {
        return parseStoredTimestamp(storage.getItem(LAST_ACTIVITY_STORAGE_KEY))
    } catch {
        return null
    }
}

export function writeLastActivityTimestamp(timestamp = Date.now()): void {
    const storage = getLocalStorage()
    if (!storage) return
    try {
        storage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestamp))
    } catch {
        // Ignore storage quota or privacy-mode errors.
    }
}

export function clearLastActivityTimestamp(): void {
    const storage = getLocalStorage()
    if (!storage) return
    try {
        storage.removeItem(LAST_ACTIVITY_STORAGE_KEY)
    } catch {
        // Ignore storage errors.
    }
}

export function broadcastSessionLogout(reason: "idle" | "manual", timestamp = Date.now()): void {
    const storage = getLocalStorage()
    if (!storage) return
    try {
        storage.setItem(SESSION_LOGOUT_STORAGE_KEY, JSON.stringify({ reason, at: timestamp }))
    } catch {
        // Ignore storage errors.
    }
}
