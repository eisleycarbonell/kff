export const API_BASE_URL = (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api"
).replace(/\/+$/, "")

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
    let response: Response
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            credentials: "include",
            headers: {
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...options.headers,
            },
        })
    } catch (error) {
        if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError"))
            throw error
        throw new Error("Unable to reach the API. Check your connection and try again.")
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
