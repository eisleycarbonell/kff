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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://catalog.example.test/api///"
const api = await import("../src/hooks/modules/items/use-items.ts")
const sessionApi = await import("../src/hooks/use-session.ts")
const schema = await import("../src/components/modules/items/item.schema.ts")
const { ApiError } = await import("../src/lib/api-request.ts")
const originalFetch = globalThis.fetch
const item = {
    itemId: 10,
    sku: "RM-GARLIC",
    name: "Garlic powder",
    itemType: "Raw Material - Bulk",
    primaryUomId: 1,
    primaryUomName: "kg",
    uomClassName: "Mass",
    unitCost: "110.1234",
    netWeightG: null,
    shelfLifeDays: null,
    requiresQc: false,
    isActive: true,
    isInUse: false,
    createdBy: 7,
    updatedBy: 7,
    createdAt: "2026-10-27T00:00:00Z",
    updatedAt: "2026-10-27T00:00:00Z",
}
const unit = { uomId: 1, name: "kg", uomClassId: 1, uomClassName: "Mass" }
const session = {
    userId: 7,
    firstName: "Maria",
    lastName: "Santos",
    email: "manager@example.com",
    roleId: 2,
    permissions: { canManageInventory: true },
}
const response = (data, status = 200) =>
    new Response(JSON.stringify({ success: true, data }), {
        status,
        headers: { "Content-Type": "application/json" },
    })
afterEach(() => {
    globalThis.fetch = originalFetch
})

test("item GET trims the API prefix, sends credentials, forwards cancellation, and preserves decimal strings", async () => {
    const abort = new AbortController()
    globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://catalog.example.test/api/items")
        assert.equal(options.credentials, "include")
        assert.equal(options.signal, abort.signal)
        return response([item])
    }
    assert.deepEqual(await api.getItems(abort.signal), [item])
})
test("unit options are fetched and validated from the item API", async () => {
    globalThis.fetch = async (url) => {
        assert.equal(url, "https://catalog.example.test/api/items/uoms")
        return response([unit])
    }
    assert.deepEqual(await api.getItemUoms(), [unit])
})
test("item create and PATCH send only the supplied writable payload", async () => {
    const input = {
        sku: item.sku,
        name: item.name,
        itemType: item.itemType,
        primaryUomId: item.primaryUomId,
        unitCost: item.unitCost,
        netWeightG: item.netWeightG,
        shelfLifeDays: item.shelfLifeDays,
        requiresQc: item.requiresQc,
        isActive: item.isActive,
    }
    globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://catalog.example.test/api/items")
        assert.equal(options.method, "POST")
        assert.deepEqual(JSON.parse(options.body), input)
        return response(item, 201)
    }
    assert.deepEqual(await api.createItem(input), item)
    globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://catalog.example.test/api/items/10")
        assert.equal(options.method, "PATCH")
        assert.deepEqual(JSON.parse(options.body), { isActive: false, netWeightG: null })
        return response({ ...item, isActive: false })
    }
    assert.equal((await api.updateItem(10, { isActive: false, netWeightG: null })).isActive, false)
})
test("malformed DTOs and numeric money responses are rejected", async () => {
    for (const data of [
        null,
        {},
        [{ ...item, unitCost: 110.1234 }],
        [{ ...item, itemType: "Other" }],
        [{ ...item, itemId: -1 }],
    ]) {
        globalThis.fetch = async () => response(data)
        await assert.rejects(api.getItems())
    }
    globalThis.fetch = async () => response([{ ...unit, uomId: 0 }])
    await assert.rejects(api.getItemUoms(), /unit options/)
})
test("HTTP failures preserve status and safe backend messages", async () => {
    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                success: false,
                error: { message: "Your role does not allow this action." },
            }),
            { status: 403 },
        )
    await assert.rejects(
        api.updateItem(10, { isActive: false }),
        (error) => error instanceof ApiError && error.status === 403 && /role/.test(error.message),
    )
})
test("network, JSON, envelope, and cancellation failures are handled explicitly", async () => {
    globalThis.fetch = async () => {
        throw new TypeError("fetch failed")
    }
    await assert.rejects(api.getItems(), /Unable to reach/)
    globalThis.fetch = async () => new Response("broken-json")
    await assert.rejects(api.getItems(), /invalid JSON/)
    globalThis.fetch = async () => new Response(JSON.stringify({ data: [item] }))
    await assert.rejects(api.getItems(), /failed/)
    const cancelled = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => {
        throw cancelled
    }
    await assert.rejects(api.getItems(), (error) => error === cancelled)
})
test("session lookup treats 401 as signed out and validates successful sessions", async () => {
    globalThis.fetch = async () =>
        new Response(JSON.stringify({ success: false, error: { message: "Please sign in." } }), {
            status: 401,
        })
    assert.equal(await sessionApi.getSession(), null)
    globalThis.fetch = async () => response(session)
    assert.deepEqual(await sessionApi.getSession(), session)
    globalThis.fetch = async () =>
        response({ ...session, permissions: { canManageInventory: "true" } })
    await assert.rejects(sessionApi.getSession(), /invalid session/)
})
test("login normalizes email while preserving password; logout accepts a success without data", async () => {
    globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://catalog.example.test/api/auth/login")
        assert.deepEqual(JSON.parse(options.body), {
            username: "manager@example.com",
            password: " password ",
        })
        assert.equal(options.credentials, "include")
        return response(session)
    }
    await sessionApi.loginSession(" MANAGER@EXAMPLE.COM ", " password ")
    globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://catalog.example.test/api/auth/logout")
        assert.equal(options.method, "POST")
        return new Response(JSON.stringify({ success: true, message: "Signed out." }))
    }
    await sessionApi.logoutSession()
})
test("item form validation preserves exact amounts and handles blanks, duplicate SKUs, and missing units", () => {
    const values = {
        sku: " new-sku ",
        name: " New product ",
        itemType: "Finished Good",
        primaryUomId: 1,
        unitCost: "9999999999.9999",
        netWeightG: "",
        shelfLifeDays: "",
        requiresQc: false,
        isActive: true,
    }
    assert.deepEqual(schema.validateItem(values, [item], [unit]), {})
    const input = schema.toItemInput(values)
    assert.equal(input.sku, "NEW-SKU")
    assert.equal(input.unitCost, "9999999999.9999")
    assert.equal(input.netWeightG, null)
    assert.equal(input.shelfLifeDays, null)
    assert.ok(schema.validateItem({ ...values, sku: "rm-garlic" }, [item], [unit]).sku)
    assert.ok(schema.validateItem({ ...values, primaryUomId: null }, [], [unit]).primaryUomId)
    assert.ok(schema.validateItem({ ...values, unitCost: "1.00001" }, [], [unit]).unitCost)
    assert.ok(schema.validateItem({ ...values, shelfLifeDays: "1.5" }, [], [unit]).shelfLifeDays)
})

test("cancellation during JSON reading is preserved", async () => {
    const aborted = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw aborted
        },
    })
    await assert.rejects(api.getItems(), (error) => error === aborted)
})

test("public item DTO parsing strips extra server fields", async () => {
    globalThis.fetch = async () =>
        response([{ ...item, internalNote: "private", passwordHash: "private" }])
    assert.deepEqual(await api.getItems(), [item])
})
