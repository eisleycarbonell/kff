export type LoadStatus = "loading" | "error" | "signed-out" | "forbidden" | "ready"

type SessionState = { isPending: boolean; data: unknown }
type QueryState = { data: unknown; isError: boolean }

/** Keep cached records visible during a failed background refresh. */
export function getLoadStatus(
    session: SessionState,
    queries: readonly QueryState[],
    allowed = true,
): LoadStatus {
    if (session.isPending) return "loading"
    if (session.data === undefined) return "error"
    if (!session.data) return "signed-out"
    if (!allowed) return "forbidden"
    if (queries.every((query) => query.data !== undefined)) return "ready"
    return queries.some((query) => query.isError) ? "error" : "loading"
}
