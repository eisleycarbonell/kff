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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://roles.example.test/api"
const api = await import("../src/hooks/modules/roles/use-roles.ts")
const schema = await import("../src/components/modules/roles/role.schema.ts")
const users = await import("../src/components/modules/users/user.schema.ts")
const userApi = await import("../src/hooks/modules/users/use-users.ts")
const originalFetch = globalThis.fetch
afterEach(() => {
    globalThis.fetch = originalFetch
})
const role = {
    roleId: 37,
    name: "Custom warehouse",
    description: null,
    settings: { ...schema.EMPTY_SETTINGS, canManageInventory: true },
    userCount: 4,
    activeUserCount: 3,
    createdBy: 9,
    updatedBy: 9,
    createdAt: "2026-11-04T00:00:00Z",
    updatedAt: "2026-11-04T00:00:00Z",
}
const response = (data, status = 200) =>
    new Response(JSON.stringify({ success: true, data }), {
        status,
        headers: { "Content-Type": "application/json" },
    })
test("role reads use credentials, cancellation and public fields; user assignments use real role IDs and settings", async () => {
    const controller = new AbortController()
    globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://roles.example.test/api/roles")
        assert.equal(options.credentials, "include")
        assert.equal(options.signal, controller.signal)
        return response([{ ...role, privateField: "omit" }])
    }
    assert.deepEqual(await api.getRoles(controller.signal), [role])
    const options = await userApi.getUserRoleOptions(controller.signal)
    assert.equal(users.getRoleName(37, options), "Custom warehouse")
    assert.equal(options[0].settings.canManageUsers, false)
    assert.equal(users.getRoleName(999, options), "Role 999")
})
test("role writes preserve explicit false/null and omit unchanged permissions", async () => {
    const values = {
        name: role.name,
        description: "",
        settings: { ...role.settings, canManageInventory: false },
    }
    const patch = schema.toRoleUpdate(values, role)
    assert.deepEqual(patch, { settings: { canManageInventory: false } })
    globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://roles.example.test/api/roles/37")
        assert.equal(options.method, "PATCH")
        assert.deepEqual(JSON.parse(options.body), patch)
        return response({ ...role, settings: values.settings })
    }
    assert.equal((await api.updateRole(37, patch)).settings.canManageInventory, false)
    globalThis.fetch = async (_url, options) => {
        assert.equal(options.method, "DELETE")
        return new Response(null, { status: 204 })
    }
    await api.deleteRole(37)
    assert.deepEqual(
        schema.toRoleInput({ ...values, name: " Renamed ", description: "  " }).description,
        null,
    )
})
test("malformed roles and errors cannot enter the role cache", async () => {
    for (const invalid of [
        { ...role, roleId: 0 },
        { ...role, userCount: -1 },
        { ...role, settings: { canManageInventory: "true" } },
        { ...role, activeUserCount: 1.5 },
    ]) {
        globalThis.fetch = async () => response([invalid])
        await assert.rejects(api.getRoles(), /invalid roles/)
    }
    globalThis.fetch = async () =>
        new Response(JSON.stringify({ success: false, error: { message: "Keep one manager." } }), {
            status: 409,
        })
    await assert.rejects(
        api.updateRole(37, { settings: { canManageUsers: false } }),
        (error) => error.status === 409 && /Keep one manager/.test(error.message),
    )
    const abort = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => {
        throw abort
    }
    await assert.rejects(api.getRoles(), (error) => error === abort)
})
test("role form validation handles duplicates and unchanged changes without hardcoded role identities", () => {
    const values = { name: " CUSTOM WAREHOUSE ", description: "", settings: role.settings }
    assert.match(schema.validateRole(values, [role]).name, /already exists/)
    assert.match(
        schema.validateRole({ ...values, name: role.name }, [role], role).settings,
        /Make a change/,
    )
    assert.deepEqual(schema.validateRole({ ...values, name: "Receiving" }, [role]), {})
})
