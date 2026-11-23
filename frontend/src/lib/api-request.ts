import { useNotifyTargetStore } from "@/lib/realtime-notify-store"

export const API_BASE_URL = (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api"
).replace(/\/+$/, "")

function resolveRequestBaseUrl(): string {
    if (
        typeof window !== "undefined" &&
        process.env.NEXT_PUBLIC_API_PROXY === "true" &&
        /^https?:\/\//i.test(API_BASE_URL)
    ) {
        return "/api"
    }
    return API_BASE_URL
}

export function resolveSocketUrl(): string {
    const explicit = (process.env.NEXT_PUBLIC_SOCKET_URL ?? "").trim().replace(/\/+$/, "")
    if (explicit) return explicit
    if (/^https?:\/\//i.test(API_BASE_URL)) {
        return API_BASE_URL.replace(/\/api$/i, "")
    }
    return ""
}

export function buildNotifyRequestHeaders(
    method: string,
    path: string,
): { headers: Record<string, string>; sentNote: boolean } {
    const upperMethod = method.toUpperCase()
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(upperMethod)) {
        return { headers: {}, sentNote: false }
    }
    if (path.startsWith("/auth") || path.startsWith("/notifications")) {
        return { headers: {}, sentNote: false }
    }

    const state = useNotifyTargetStore.getState()
    const headers: Record<string, string> = {
        "X-Notify-Mode": state.mode,
    }
    if (state.socketId) {
        headers["X-Socket-Id"] = state.socketId
    }
    if (state.mode === "custom" && state.selectedRoleIds.length > 0) {
        headers["X-Notify-Role-Ids"] = state.selectedRoleIds.join(",")
    }
    const trimmedNote = state.note.trim()
    if (state.mode !== "none" && trimmedNote) {
        headers["X-Notify-Message"] = encodeURIComponent(trimmedNote)
        return { headers, sentNote: true }
    }
    return { headers, sentNote: false }
}

export class ApiError extends Error {
    readonly status: number
    constructor(status: number, message: string) {
        super(message)
        this.name = "ApiError"
        this.status = status
    }
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Shared HTTP boundary; resource DTO parsing stays in its hook. */
export async function apiRequest(
    path: string,
    options: RequestInit = {},
    allowEmpty = false,
): Promise<unknown> {
    const method = (options.method ?? "GET").toUpperCase()
    const notifyMeta = buildNotifyRequestHeaders(method, path)
    let response: Response
    try {
        response = await fetch(`${resolveRequestBaseUrl()}${path}`, {
            ...options,
            credentials: "include",
            headers: {
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...notifyMeta.headers,
                ...options.headers,
            },
        })
    } catch (error) {
        if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError"))
            throw error
        throw new Error("Unable to reach the API. Check your connection and try again.")
    }
    if (response.ok && notifyMeta.sentNote) {
        const state = useNotifyTargetStore.getState()
        if (state.clearNoteAfterSend) state.clearNote()
    }
    if (response.ok && response.status === 204 && allowEmpty) return
    let payload: unknown
    try {
        payload = await response.json()
    } catch (error) {
        if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError"))
            throw error
        throw new ApiError(
            response.status,
            response.ok
                ? "The API returned invalid JSON."
                : `The request failed (HTTP ${response.status}).`,
        )
    }
    if (!response.ok || !isRecord(payload) || payload.success !== true) {
        const message =
            isRecord(payload) &&
            isRecord(payload.error) &&
            typeof payload.error.message === "string"
                ? payload.error.message.trim()
                : ""
        throw new ApiError(
            response.status,
            message || `The API request failed (HTTP ${response.status}).`,
        )
    }
    if (allowEmpty) return
    if (!("data" in payload) || payload.data == null)
        throw new Error("The API response is missing data.")
    return payload.data
}
