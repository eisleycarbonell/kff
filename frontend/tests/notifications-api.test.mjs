import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { afterEach, test } from "node:test"

registerHooks({
    resolve(specifier, context, nextResolve) {
        return nextResolve(
            specifier.startsWith("@/")
                ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href
                : specifier,
            context,
        )
    },
})

process.env.NEXT_PUBLIC_API_BASE_URL = "https://kff.example.test/api///"

const { apiRequest, buildNotifyRequestHeaders, resolveSocketUrl } = await import(
    "../src/lib/api-request.ts"
)
const { useNotifyTargetStore } = await import("../src/lib/realtime-notify-store.ts")
const notificationsApi = await import(
    "../src/hooks/modules/notifications/use-notifications.ts"
)

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    useNotifyTargetStore.getState().setSocketId(null)
    useNotifyTargetStore.getState().resetToAuto()
})

test("resolveSocketUrl derives origin cleanly from API_BASE_URL", () => {
    assert.equal(resolveSocketUrl(), "https://kff.example.test")
})

test("apiRequest attaches user-selected target roles and optional message on updates then clears note", async () => {
    useNotifyTargetStore.getState().setSocketId("sock_abc_123")
    useNotifyTargetStore.getState().setSelectedRoleIds([7, 2])
    useNotifyTargetStore.getState().setNote("Verify landed cost after update")

    const preview = buildNotifyRequestHeaders("PATCH", "/items/12")
    assert.equal(preview.sentNote, true)
    assert.equal(preview.headers["X-Socket-Id"], "sock_abc_123")
    assert.equal(preview.headers["X-Notify-Mode"], "custom")
    assert.equal(preview.headers["X-Notify-Role-Ids"], "7,2")
    assert.equal(
        preview.headers["X-Notify-Message"],
        encodeURIComponent("Verify landed cost after update"),
    )

    let capturedHeaders = null
    globalThis.fetch = async (_url, init) => {
        capturedHeaders = init.headers
        return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
            status: 200,
            headers: { "content-type": "application/json" },
        })
    }

    await apiRequest("/items/12", {
        method: "PATCH",
        body: JSON.stringify({ name: "Black Pepper" }),
    })

    assert.equal(capturedHeaders["X-Socket-Id"], "sock_abc_123")
    assert.equal(capturedHeaders["X-Notify-Mode"], "custom")
    assert.equal(capturedHeaders["X-Notify-Role-Ids"], "7,2")
    assert.equal(useNotifyTargetStore.getState().note, "")
    assert.deepEqual(buildNotifyRequestHeaders("GET", "/items/12").headers, {})
    assert.deepEqual(buildNotifyRequestHeaders("POST", "/notifications").headers, {})
})

test("notifications API functions validate role notifications and target roles", async () => {
    globalThis.fetch = async (url, init) => {
        if (String(url).endsWith("/notifications/roles")) {
            return new Response(
                JSON.stringify({
                    success: true,
                    data: [
                        {
                            roleId: 7,
                            name: "Accounting",
                            description: "Financial review",
                            settings: { canManageAccounting: true },
                        },
                    ],
                }),
                { status: 200, headers: { "content-type": "application/json" } },
            )
        }
        if (init?.method === "POST") {
            return new Response(
                JSON.stringify({
                    success: true,
                    data: {
                        notificationId: 11,
                        title: "Cost Check",
                        message: "Check spice batch cost.",
                        module: "manual",
                        action: "manual",
                        entityId: null,
                        route: "/accounting",
                        targetRoleIds: [7],
                        targetRoleNames: ["Accounting"],
                        selectionMode: "manual",
                        actorUserId: 2,
                        actorName: "Marta Reyes",
                        actorRoleId: 2,
                        actorRoleName: "Warehouse",
                        createdAt: "2026-11-16T12:00:00.000Z",
                        isRead: false,
                    },
                }),
                { status: 201, headers: { "content-type": "application/json" } },
            )
        }
        return new Response(
            JSON.stringify({
                success: true,
                data: { items: [], unreadCount: 0 },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
        )
    }

    const roles = await notificationsApi.getNotificationRoles()
    assert.equal(roles[0].name, "Accounting")

    const inbox = await notificationsApi.getRoleNotifications()
    assert.equal(inbox.unreadCount, 0)

    const sent = await notificationsApi.sendManualNotification({
        title: "Cost Check",
        message: "Check spice batch cost.",
        targetRoleIds: [7],
        route: "/accounting",
    })
    assert.deepEqual(sent.targetRoleIds, [7])
    assert.equal(sent.selectionMode, "manual")
})
