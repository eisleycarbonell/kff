import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { registerHooks } from "node:module"
import { afterEach, test } from "node:test"

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith("@/")) {
            const base = new URL(`../src/${specifier.slice(2)}`, import.meta.url)
            for (const ext of [".ts", ".tsx", "/index.ts"]) {
                const candidate = new URL(base.href + ext)
                if (existsSync(candidate)) return nextResolve(candidate.href, context)
            }
        }
        return nextResolve(specifier, context)
    },
})

process.env.NEXT_PUBLIC_API_BASE_URL = "https://kff.example.test/api/"

const { ApiError } = await import("../src/lib/api-request.ts")
const { getLoadStatus, shouldRedirectToLogin } = await import("../src/lib/load-status.ts")
const {
    canNavigateToRoute,
    getHomeRouteForSession,
    getWorkspaceRedirect,
    isAccountingOnlySession,
    isAccountingRoute,
} = await import("../src/lib/workspace-access.ts")
const { getSession, keepaliveSession, loginSession, logoutSession, sessionSchema, SESSION_QUERY_KEY } =
    await import("../src/hooks/use-session.ts")
const {
    SESSION_IDLE_TIMEOUT_MS,
    SESSION_IDLE_WARNING_BEFORE_MS,
    SESSION_KEEPALIVE_INTERVAL_MS,
    getIdleRemainingMs,
    isSessionIdleExpired,
    parseLogoutBroadcast,
    parseStoredTimestamp,
    shouldSendSessionKeepalive,
    shouldWarnIdleTimeout,
} = await import("../src/lib/idle-session.ts")

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

const validSessionPayload = {
    userId: 7,
    firstName: "Maria",
    lastName: "Santos",
    email: "maria.santos@kff.test",
    roleId: 2,
    permissions: {
        canManageInventory: true,
        canManagePurchasing: true,
        canManagePacking: false,
        canManageTransfers: true,
        canManageAccounting: false,
        canManageUsers: false,
        notifyInventory: true,
    },
}

test("SESSION_QUERY_KEY and getSession fetch /auth/session with credentials and abort signal", async () => {
    assert.deepEqual(SESSION_QUERY_KEY, ["session"])
    const controller = new AbortController()
    let seenUrl = null
    let seenInit = null

    globalThis.fetch = async (url, init) => {
        seenUrl = String(url)
        seenInit = init
        return new Response(JSON.stringify({ success: true, data: validSessionPayload }), {
            status: 200,
            headers: { "content-type": "application/json" },
        })
    }

    const session = await getSession(controller.signal)
    assert.equal(seenUrl, "https://kff.example.test/api/auth/session")
    assert.equal(seenInit?.credentials, "include")
    assert.equal(seenInit?.signal, controller.signal)
    assert.deepEqual(session, validSessionPayload)
})

test("getSession returns null on 401 and rethrows server failures or malformed payloads", async () => {
    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                success: false,
                error: { message: "Authentication required." },
            }),
            { status: 401, headers: { "content-type": "application/json" } },
        )

    assert.equal(await getSession(), null)

    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                success: false,
                error: { message: "Database temporarily unavailable." },
            }),
            { status: 503, headers: { "content-type": "application/json" } },
        )

    await assert.rejects(
        () => getSession(),
        (error) =>
            error instanceof ApiError &&
            error.status === 503 &&
            error.message === "Database temporarily unavailable.",
    )

    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                success: true,
                data: { ...validSessionPayload, userId: 0 },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
        )

    await assert.rejects(() => getSession(), /The API returned an invalid session/)
})

test("loginSession normalizes username email, keeps exact password, and parses session", async () => {
    let seenUrl = null
    let seenInit = null

    globalThis.fetch = async (url, init) => {
        seenUrl = String(url)
        seenInit = init
        return new Response(JSON.stringify({ success: true, data: validSessionPayload }), {
            status: 200,
            headers: { "content-type": "application/json" },
        })
    }

    const session = await loginSession("  Maria.Santos@KFF.Test  ", "Secret Pass! ")
    assert.equal(seenUrl, "https://kff.example.test/api/auth/login")
    assert.equal(seenInit?.method, "POST")
    assert.equal(seenInit?.credentials, "include")
    assert.deepEqual(JSON.parse(String(seenInit?.body)), {
        username: "maria.santos@kff.test",
        password: "Secret Pass! ",
    })
    assert.deepEqual(session, validSessionPayload)

    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                success: false,
                error: { message: "Invalid email or password." },
            }),
            { status: 401, headers: { "content-type": "application/json" } },
        )

    await assert.rejects(
        () => loginSession("maria@kff.test", "wrong"),
        (error) =>
            error instanceof ApiError &&
            error.status === 401 &&
            error.message === "Invalid email or password.",
    )
})

test("logoutSession accepts 204, bodyless 200, and expired 401 while surfacing 500 errors", async () => {
    globalThis.fetch = async () => new Response(null, { status: 204 })
    await logoutSession()

    globalThis.fetch = async () =>
        new Response(JSON.stringify({ success: true, message: "Signed out." }), {
            status: 200,
            headers: { "content-type": "application/json" },
        })
    await logoutSession()

    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({ success: false, error: { message: "Session expired." } }),
            { status: 401, headers: { "content-type": "application/json" } },
        )
    await logoutSession()

    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({ success: false, error: { message: "Sign out failed." } }),
            { status: 500, headers: { "content-type": "application/json" } },
        )
    await assert.rejects(
        () => logoutSession(),
        (error) => error instanceof ApiError && error.status === 500,
    )
})

test("sessionSchema rejects non-positive user/role IDs and non-boolean permissions", () => {
    assert.equal(sessionSchema.safeParse(validSessionPayload).success, true)
    assert.equal(
        sessionSchema.safeParse({ ...validSessionPayload, userId: -1 }).success,
        false,
    )
    assert.equal(
        sessionSchema.safeParse({ ...validSessionPayload, roleId: 1.5 }).success,
        false,
    )
    assert.equal(
        sessionSchema.safeParse({
            ...validSessionPayload,
            permissions: { canManageInventory: "yes" },
        }).success,
        false,
    )
})

test("getLoadStatus handles loading, error, signed-out, forbidden, and ready states", () => {
    assert.equal(getLoadStatus({ isPending: true, data: undefined }, []), "loading")
    assert.equal(getLoadStatus({ isPending: false, data: undefined }, []), "error")
    assert.equal(getLoadStatus({ isPending: false, data: null }, []), "signed-out")
    assert.equal(
        getLoadStatus({ isPending: false, data: validSessionPayload }, [], false),
        "forbidden",
    )
    assert.equal(
        getLoadStatus(
            { isPending: false, data: validSessionPayload },
            [{ data: undefined, isError: false }],
        ),
        "loading",
    )
    assert.equal(
        getLoadStatus(
            { isPending: false, data: validSessionPayload },
            [{ data: undefined, isError: true }],
        ),
        "error",
    )
    assert.equal(
        getLoadStatus(
            { isPending: false, data: validSessionPayload },
            [{ data: [], isError: true }],
        ),
        "ready",
    )
})

test("shouldRedirectToLogin only redirects when settled as definitively signed out", () => {
    assert.equal(shouldRedirectToLogin({ isPending: true, data: undefined }), false)
    assert.equal(shouldRedirectToLogin({ isPending: true, data: null }), false)
    assert.equal(shouldRedirectToLogin({ isPending: false, data: undefined }), false)
    assert.equal(shouldRedirectToLogin({ isPending: false, data: validSessionPayload }), false)
    assert.equal(shouldRedirectToLogin({ isPending: false, data: null }), true)
})

test("workspace access isolates Accounting-only roles into the standalone Accounting Portal", () => {
    const accountingOnlySession = {
        ...validSessionPayload,
        permissions: {
            canManageInventory: false,
            canManagePurchasing: false,
            canManagePacking: false,
            canManageTransfers: false,
            canManageUsers: false,
            canManageAccounting: true,
        },
    }
    const adminSession = {
        ...validSessionPayload,
        permissions: {
            canManageInventory: true,
            canManagePurchasing: true,
            canManagePacking: true,
            canManageTransfers: true,
            canManageUsers: true,
            canManageAccounting: true,
        },
    }
    const mixedSession = {
        ...validSessionPayload,
        permissions: {
            canManageInventory: true,
            canManageAccounting: true,
        },
    }
    const viewerSession = {
        ...validSessionPayload,
        permissions: {
            canManageInventory: false,
            canManagePurchasing: false,
            canManagePacking: false,
            canManageTransfers: false,
            canManageUsers: false,
            canManageAccounting: false,
        },
    }

    assert.equal(isAccountingOnlySession(accountingOnlySession), true)
    assert.equal(isAccountingOnlySession(adminSession), false)
    assert.equal(isAccountingOnlySession(mixedSession), false)
    assert.equal(isAccountingOnlySession(validSessionPayload), false)
    assert.equal(isAccountingOnlySession(viewerSession), false)
    assert.equal(isAccountingOnlySession(null), false)
    assert.equal(isAccountingOnlySession(undefined), false)

    assert.equal(isAccountingRoute("/accounting"), true)
    assert.equal(isAccountingRoute("/accounting/"), true)
    assert.equal(isAccountingRoute("/accounting/general-ledger"), true)
    assert.equal(isAccountingRoute("/accounting/payables/"), true)
    assert.equal(isAccountingRoute("/dashboard"), false)
    assert.equal(isAccountingRoute("/inventory"), false)

    assert.equal(getHomeRouteForSession(accountingOnlySession), "/accounting")
    assert.equal(getHomeRouteForSession(adminSession), "/dashboard")
    assert.equal(getHomeRouteForSession(validSessionPayload), "/dashboard")
    assert.equal(getHomeRouteForSession(viewerSession), "/dashboard")
    assert.equal(getHomeRouteForSession(null), "/dashboard")

    assert.equal(getWorkspaceRedirect(accountingOnlySession, "/dashboard"), "/accounting")
    assert.equal(getWorkspaceRedirect(accountingOnlySession, "/inventory"), "/accounting")
    assert.equal(getWorkspaceRedirect(accountingOnlySession, "/accounting"), null)
    assert.equal(
        getWorkspaceRedirect(accountingOnlySession, "/accounting/general-ledger"),
        null,
    )
    assert.equal(getWorkspaceRedirect(adminSession, "/accounting"), "/dashboard")
    assert.equal(getWorkspaceRedirect(adminSession, "/accounting/valuation"), "/dashboard")
    assert.equal(getWorkspaceRedirect(adminSession, "/dashboard"), null)
    assert.equal(getWorkspaceRedirect(viewerSession, "/accounting"), "/dashboard")
    assert.equal(getWorkspaceRedirect(null, "/dashboard"), null)

    assert.equal(canNavigateToRoute(accountingOnlySession, "/accounting/payables"), true)
    assert.equal(canNavigateToRoute(accountingOnlySession, "/purchase-orders"), false)
    assert.equal(canNavigateToRoute(adminSession, "/purchase-orders"), true)
    assert.equal(canNavigateToRoute(adminSession, "/accounting/payables"), false)
    assert.equal(canNavigateToRoute(adminSession, null), false)
})

test("keepaliveSession calls POST /auth/keepalive with credentials", async () => {
    let seenUrl = null
    let seenInit = null
    globalThis.fetch = async (url, init) => {
        seenUrl = String(url)
        seenInit = init
        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    expiresAt: "2026-11-25T18:00:00.000Z",
                    idleTimeoutSeconds: 10800,
                },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
        )
    }

    await keepaliveSession()
    assert.equal(seenUrl, "https://kff.example.test/api/auth/keepalive")
    assert.equal(seenInit?.method, "POST")
    assert.equal(seenInit?.credentials, "include")
})

test("idle-session helpers enforce 3-hour expiry, 5-minute warning, and activity-only keepalive", () => {
    const start = 1_700_000_000_000

    assert.equal(SESSION_IDLE_TIMEOUT_MS, 3 * 60 * 60 * 1000)
    assert.equal(SESSION_IDLE_WARNING_BEFORE_MS, 5 * 60 * 1000)
    assert.equal(SESSION_KEEPALIVE_INTERVAL_MS, 15 * 60 * 1000)

    assert.equal(
        getIdleRemainingMs(start, start + SESSION_IDLE_TIMEOUT_MS - 1_000),
        1_000,
    )
    assert.equal(getIdleRemainingMs(start, start + SESSION_IDLE_TIMEOUT_MS + 5_000), 0)

    assert.equal(isSessionIdleExpired(start, start + SESSION_IDLE_TIMEOUT_MS - 1), false)
    assert.equal(isSessionIdleExpired(start, start + SESSION_IDLE_TIMEOUT_MS), true)

    assert.equal(
        shouldWarnIdleTimeout(start, start + SESSION_IDLE_TIMEOUT_MS - SESSION_IDLE_WARNING_BEFORE_MS - 1),
        false,
    )
    assert.equal(
        shouldWarnIdleTimeout(start, start + SESSION_IDLE_TIMEOUT_MS - SESSION_IDLE_WARNING_BEFORE_MS),
        true,
    )
    assert.equal(shouldWarnIdleTimeout(start, start + SESSION_IDLE_TIMEOUT_MS), false)

    // No keepalive without new user activity after the previous keepalive.
    assert.equal(
        shouldSendSessionKeepalive(start, start, start + SESSION_KEEPALIVE_INTERVAL_MS + 1_000),
        false,
    )
    // User acted within the interval, so keepalive triggers once the 15-minute throttle passes.
    assert.equal(
        shouldSendSessionKeepalive(
            start + 20_000,
            start,
            start + SESSION_KEEPALIVE_INTERVAL_MS,
        ),
        true,
    )
    // Never send keepalive once idle timeout is already reached.
    assert.equal(
        shouldSendSessionKeepalive(
            start,
            start - SESSION_KEEPALIVE_INTERVAL_MS,
            start + SESSION_IDLE_TIMEOUT_MS,
        ),
        false,
    )

    assert.equal(parseStoredTimestamp("1700000000000"), 1_700_000_000_000)
    assert.equal(parseStoredTimestamp("0"), null)
    assert.equal(parseStoredTimestamp("not-a-number"), null)
    assert.deepEqual(
        parseLogoutBroadcast(JSON.stringify({ reason: "idle", at: start })),
        { reason: "idle", at: start },
    )
    assert.equal(parseLogoutBroadcast('{"reason":"other","at":123}'), null)
    assert.equal(parseLogoutBroadcast("{"), null)
})
