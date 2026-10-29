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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://suppliers.example.test/api///"
const api = await import("../src/hooks/modules/suppliers/use-suppliers.ts")
const schema = await import("../src/components/modules/suppliers/supplier.schema.ts")
const { ApiError } = await import("../src/lib/api-request.ts")
const originalFetch = globalThis.fetch
const audits = {
    createdBy: 7,
    createdAt: "2026-10-28T00:00:00Z",
    updatedBy: null,
    updatedAt: "2026-10-28T08:00:00+08:00",
}
const supplier = {
    supplierId: 4,
    name: "Davao Spices",
    email: null,
    isActive: true,
    itemCount: 2,
    activeItemCount: 1,
    preferredItemCount: 1,
    hasOpenPurchaseOrders: false,
    ...audits,
}
const item = {
    supplierItemId: 8,
    supplierId: 4,
    itemId: 12,
    supplierItemCode: null,
    defaultUomId: null,
    defaultPrice: "9999999999.9999",
    leadTimeDays: null,
    isPreferred: true,
    isActive: true,
    itemSku: "RM-GARLIC",
    itemName: "Garlic Powder",
    itemType: "Raw Material - Bulk",
    itemIsActive: true,
    primaryUomId: 2,
    primaryUomName: "kg",
    defaultUomName: null,
    uomClassId: 1,
    ...audits,
}
const options = {
    items: [
        {
            itemId: 12,
            sku: "RM-GARLIC",
            name: "Garlic Powder",
            itemType: "Raw Material - Bulk",
            primaryUomId: 2,
            primaryUomName: "kg",
            uomClassId: 1,
            isActive: true,
        },
    ],
    uoms: [
        { uomId: 2, name: "kg", uomClassId: 1 },
        { uomId: 3, name: "pc", uomClassId: 2 },
    ],
}
const itemValues = {
    itemId: 12,
    supplierItemCode: "",
    defaultUomId: null,
    defaultPrice: "9999999999.9999",
    leadTimeDays: "",
    isPreferred: true,
    isActive: true,
}
const response = (data, status = 200) => Response.json({ success: true, data }, { status })

afterEach(() => {
    globalThis.fetch = originalFetch
})

test("supplier reads use configured prefix, credentials and query cancellation", async () => {
    const controller = new AbortController()
    for (const [path, data, invoke] of [
        ["/suppliers", [supplier], () => api.getSuppliers(controller.signal)],
        ["/suppliers/4", supplier, () => api.getSupplier(4, controller.signal)],
        ["/suppliers/options", options, () => api.getSupplierOptions(controller.signal)],
        ["/suppliers/4/items", [item], () => api.getSupplierItems(4, controller.signal)],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://suppliers.example.test/api${path}`)
            assert.equal(request.credentials, "include")
            assert.equal(request.signal, controller.signal)
            assert.equal(request.headers.Accept, "application/json")
            return response(data)
        }
        assert.deepEqual(await invoke(), data)
    }
})

test("supplier writes preserve optional fields and status-only deactivation/reactivation", async () => {
    for (const [path, method, input, invoke] of [
        ["/suppliers", "POST", { name: "New Supplier" }, (input) => api.createSupplier(input)],
        ["/suppliers/4", "PATCH", { email: null }, (input) => api.updateSupplier(4, input)],
        ["/suppliers/4", "PATCH", { isActive: false }, (input) => api.updateSupplier(4, input)],
        ["/suppliers/4", "PATCH", { isActive: true }, (input) => api.updateSupplier(4, input)],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://suppliers.example.test/api${path}`)
            assert.equal(request.method, method)
            assert.equal(request.credentials, "include")
            assert.equal(request.headers["Content-Type"], "application/json")
            assert.deepEqual(JSON.parse(request.body), input)
            return response(supplier, method === "POST" ? 201 : 200)
        }
        assert.deepEqual(await invoke(input), supplier)
    }
})

test("supplier item writes preserve exact prices, null units, false values and zero lead time", async () => {
    const input = {
        itemId: 12,
        supplierItemCode: null,
        defaultUomId: null,
        defaultPrice: "9999999999.9999",
        leadTimeDays: 0,
        isPreferred: false,
        isActive: true,
    }
    globalThis.fetch = async (url, request) => {
        assert.equal(url, "https://suppliers.example.test/api/suppliers/4/items")
        assert.equal(request.method, "POST")
        assert.deepEqual(JSON.parse(request.body), input)
        return response(item, 201)
    }
    assert.deepEqual(await api.createSupplierItem(4, input), item)
    globalThis.fetch = async (url, request) => {
        assert.equal(url, "https://suppliers.example.test/api/suppliers/4/items/8")
        assert.equal(request.method, "PATCH")
        assert.deepEqual(JSON.parse(request.body), { defaultPrice: null, isActive: false })
        return response({ ...item, defaultPrice: null, isActive: false, isPreferred: false })
    }
    assert.equal(
        (await api.updateSupplierItem(4, 8, { defaultPrice: null, isActive: false })).defaultPrice,
        null,
    )
})

test("malformed supplier DTOs cannot enter the query cache", async () => {
    for (const data of [
        {},
        [null],
        [{ ...supplier, supplierId: 0 }],
        [{ ...supplier, email: 12 }],
        [{ ...supplier, itemCount: "2" }],
        [{ ...supplier, activeItemCount: -1 }],
        [{ ...supplier, hasOpenPurchaseOrders: null }],
        [{ ...supplier, createdAt: "2026-02-30T00:00:00Z" }],
        [{ ...supplier, updatedBy: "7" }],
    ]) {
        globalThis.fetch = async () => response(data)
        await assert.rejects(api.getSuppliers(), /invalid supplier/)
    }
    const missing = { ...supplier }
    delete missing.preferredItemCount
    globalThis.fetch = async () => response(missing)
    await assert.rejects(api.getSupplier(4), /invalid supplier record/)
})

test("supplier item DTOs preserve nullable fields and reject invalid exact decimals", async () => {
    globalThis.fetch = async () => response([{ ...item, defaultPrice: null }])
    assert.equal((await api.getSupplierItems(4))[0].defaultPrice, null)
    for (const invalid of [110.1234, "-1", "1.00001", "10000000000", "1e3", "", "Infinity"]) {
        globalThis.fetch = async () => response([{ ...item, defaultPrice: invalid }])
        await assert.rejects(api.getSupplierItems(4), /invalid supplier item record/)
    }
    for (const changes of [
        { leadTimeDays: -1 },
        { leadTimeDays: 1.2 },
        { defaultUomId: 0 },
        { itemType: "Other" },
        { itemIsActive: "true" },
        { uomClassId: null },
    ]) {
        globalThis.fetch = async () => response([{ ...item, ...changes }])
        await assert.rejects(api.getSupplierItems(4), /invalid supplier item record/)
    }
})

test("option records and all public DTOs validate and strip unrelated server fields", async () => {
    globalThis.fetch = async () => response({ ...options, privateToken: "secret" })
    assert.deepEqual(await api.getSupplierOptions(), options)
    globalThis.fetch = async () => response([{ ...supplier, passwordHash: "secret" }])
    assert.deepEqual(await api.getSuppliers(), [supplier])
    globalThis.fetch = async () => response([{ ...item, internalToken: "secret" }])
    assert.deepEqual(await api.getSupplierItems(4), [item])
    globalThis.fetch = async () =>
        response({ ...options, uoms: [{ ...options.uoms[0], uomClassId: "1" }] })
    await assert.rejects(api.getSupplierOptions(), /invalid item and unit options/)
})

test("HTTP failures preserve status and readable backend messages", async () => {
    for (const status of [401, 403, 409, 503]) {
        globalThis.fetch = async () =>
            Response.json(
                {
                    success: false,
                    error: { message: "The supplier could not be updated." },
                },
                { status },
            )
        await assert.rejects(
            api.updateSupplier(4, { isActive: false }),
            (error) =>
                error instanceof ApiError &&
                error.status === status &&
                /supplier/.test(error.message),
        )
    }
})

test("network, invalid JSON, missing data and failed envelopes remain readable", async () => {
    globalThis.fetch = async () => {
        throw new TypeError("fetch failed")
    }
    await assert.rejects(api.getSuppliers(), /Unable to reach/)
    globalThis.fetch = async () => new Response("broken JSON")
    await assert.rejects(api.getSuppliers(), /invalid JSON/)
    globalThis.fetch = async () => Response.json({ success: true })
    await assert.rejects(api.getSuppliers(), /missing data/)
    globalThis.fetch = async () => Response.json({ data: [supplier] })
    await assert.rejects(api.getSuppliers(), /failed/)
})

test("fetch and response-reading cancellation preserve the original reason", async () => {
    const cancelled = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => {
        throw cancelled
    }
    await assert.rejects(api.getSuppliers(), (error) => error === cancelled)
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw cancelled
        },
    })
    await assert.rejects(api.getSupplierItems(4), (error) => error === cancelled)
    const controller = new AbortController()
    const reason = new Error("Navigation cancelled")
    controller.abort(reason)
    globalThis.fetch = async (_url, request) => {
        throw request.signal.reason
    }
    await assert.rejects(api.getSupplierOptions(controller.signal), (error) => error === reason)
})

test("supplier forms normalize blanks and case while preserving exact name uniqueness", () => {
    assert.deepEqual(
        schema.toSupplierInput({
            name: " New Supplier ",
            email: " SALES@EXAMPLE.COM ",
            isActive: false,
        }),
        {
            name: "New Supplier",
            email: "sales@example.com",
            isActive: false,
        },
    )
    assert.equal(schema.toSupplierInput({ name: "New", email: " ", isActive: true }).email, null)
    assert.ok(
        schema.validateSupplier({ name: supplier.name, email: "", isActive: true }, [supplier])
            .name,
    )
    assert.deepEqual(
        schema.validateSupplier(
            { name: supplier.name, email: "", isActive: true },
            [supplier],
            supplier,
        ),
        {},
    )
    assert.deepEqual(
        schema.validateSupplier({ name: supplier.name.toLowerCase(), email: "", isActive: true }, [
            supplier,
        ]),
        {},
    )
    assert.ok(
        schema.validateSupplier({ name: "x".repeat(101), email: "bad", isActive: true }, []).name,
    )
    assert.ok(schema.validateSupplier({ name: "New", email: "bad", isActive: true }, []).email)
    assert.ok(
        schema.validateSupplier({ name: "New", email: "", isActive: false }, [], {
            ...supplier,
            hasOpenPurchaseOrders: true,
        }).isActive,
    )
})

test("item forms preserve decimal strings and convert only nullable blank and integer fields", () => {
    assert.deepEqual(schema.validateSupplierItem(itemValues, options, []), {})
    const input = schema.toSupplierItemInput({
        ...itemValues,
        supplierItemCode: " GAR-1 ",
        leadTimeDays: "0",
    })
    assert.equal(input.supplierItemCode, "GAR-1")
    assert.equal(input.defaultPrice, "9999999999.9999")
    assert.equal(input.leadTimeDays, 0)
    assert.equal(input.defaultUomId, null)
    const inactive = schema.toSupplierItemInput({
        ...itemValues,
        defaultPrice: " ",
        isActive: false,
    })
    assert.equal(inactive.defaultPrice, null)
    assert.equal(inactive.isPreferred, false)
    assert.equal(inactive.leadTimeDays, null)
    for (const value of ["1.1", "1e3", "2147483648", "-1"]) {
        assert.ok(
            schema.validateSupplierItem({ ...itemValues, leadTimeDays: value }, options, [])
                .leadTimeDays,
        )
    }
    assert.ok(
        schema.validateSupplierItem({ ...itemValues, defaultPrice: "1.00001" }, options, [])
            .defaultPrice,
    )
})

test("item form validation enforces active purchase items, unique links, immutable items and compatible units", () => {
    assert.ok(schema.validateSupplierItem(itemValues, options, [item]).itemId)
    assert.deepEqual(schema.validateSupplierItem(itemValues, options, [item], item), {})
    assert.ok(
        schema.validateSupplierItem({ ...itemValues, defaultUomId: 3 }, options, []).defaultUomId,
    )
    assert.ok(schema.validateSupplierItem({ ...itemValues, itemId: null }, options, []).itemId)
    assert.ok(
        schema.validateSupplierItem({ ...itemValues, itemId: 99 }, options, [item], item).itemId,
    )
    for (const changes of [{ isActive: false }, { itemType: "Finished Good" }]) {
        const unavailable = { ...options, items: [{ ...options.items[0], ...changes }] }
        assert.ok(schema.validateSupplierItem(itemValues, unavailable, []).itemId)
        assert.deepEqual(
            schema.validateSupplierItem(
                { ...itemValues, isActive: false },
                unavailable,
                [item],
                item,
            ),
            {},
        )
    }
})
