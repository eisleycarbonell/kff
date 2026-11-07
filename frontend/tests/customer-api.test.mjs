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

process.env.NEXT_PUBLIC_API_BASE_URL = "https://customers.example.test/api///"
const api = await import("../src/hooks/modules/customers/use-customers.ts")
const schema = await import("../src/components/modules/customers/customer.schema.ts")
const { ApiError } = await import("../src/lib/api-request.ts")
const originalFetch = globalThis.fetch
const customer = {
    customerId: 4,
    name: "Manila Grocery",
    contactName: null,
    email: null,
    phone: null,
    address: null,
    notes: null,
    isActive: true,
    createdBy: 7,
    createdAt: "2026-10-28T00:00:00Z",
    updatedBy: null,
    updatedAt: "2026-10-28T08:00:00+08:00",
}
const formValues = {
    name: "Manila Grocery",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    isActive: true,
}
const response = (data, status = 200) => Response.json({ success: true, data }, { status })

afterEach(() => {
    globalThis.fetch = originalFetch
})

test("customer reads use the configured prefix, credentials and cancellation signal", async () => {
    const controller = new AbortController()
    for (const [path, data, invoke] of [
        ["/customers", [customer], () => api.getCustomers(controller.signal)],
        ["/customers/4", customer, () => api.getCustomer(4, controller.signal)],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://customers.example.test/api${path}`)
            assert.equal(request.method ?? "GET", "GET")
            assert.equal(request.credentials, "include")
            assert.equal(request.signal, controller.signal)
            assert.equal(new Headers(request.headers).get("Accept"), "application/json")
            assert.equal(request.body, undefined)
            return response(data)
        }
        assert.deepEqual(await invoke(), data)
    }
    globalThis.fetch = async () => response([])
    assert.deepEqual(await api.getCustomers(), [])
})

test("customer writes preserve omitted fields, explicit nulls and status-only updates", async () => {
    for (const [path, method, input, invoke] of [
        ["/customers", "POST", { name: "New Customer" }, (input) => api.createCustomer(input)],
        [
            "/customers",
            "POST",
            { ...formValues, contactName: null, email: null, phone: null, address: null, notes: null, isActive: false },
            (input) => api.createCustomer(input),
        ],
        ["/customers/4", "PATCH", { name: "Updated Customer" }, (input) => api.updateCustomer(4, input)],
        [
            "/customers/4",
            "PATCH",
            { contactName: null, email: null, phone: null, address: null, notes: null },
            (input) => api.updateCustomer(4, input),
        ],
        ["/customers/4", "PATCH", { isActive: false }, (input) => api.updateCustomer(4, input)],
        ["/customers/4", "PATCH", { isActive: true }, (input) => api.updateCustomer(4, input)],
    ]) {
        const saved = { ...customer, ...input }
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://customers.example.test/api${path}`)
            assert.equal(request.method, method)
            assert.equal(request.credentials, "include")
            assert.equal(new Headers(request.headers).get("Content-Type"), "application/json")
            assert.deepEqual(JSON.parse(request.body), input)
            return response(saved, method === "POST" ? 201 : 200)
        }
        assert.deepEqual(await invoke(input), saved)
    }
})

test("customer DTOs preserve optional contact details and valid timestamp precision", async () => {
    const populated = {
        ...customer,
        contactName: "Maria Santos",
        email: "orders@example.test",
        phone: "+63 917 100 2002",
        address: "123 Market Street\nManila",
        notes: "Call before delivery.",
        isActive: false,
        createdBy: null,
        createdAt: "2024-02-29T00:00:00.123456Z",
        updatedBy: 8,
        updatedAt: "2026-10-28T08:00:00.123+08:00",
    }
    globalThis.fetch = async () => response(populated)
    assert.deepEqual(await api.getCustomer(4), populated)
    assert.deepEqual(schema.customerSchema.parse(populated), populated)
})

test("malformed customer lists and missing public fields cannot reach the UI", async () => {
    for (const data of [{}, "customers", [null], [customer, {}]]) {
        globalThis.fetch = async () => response(data)
        await assert.rejects(api.getCustomers(), /invalid customer/)
    }
    for (const field of Object.keys(customer)) {
        const incomplete = { ...customer }
        delete incomplete[field]
        globalThis.fetch = async () => response(incomplete)
        await assert.rejects(api.getCustomer(4), /invalid customer/, `missing ${field}`)
    }
})

test("customer DTOs reject invalid IDs, booleans and nullable contact field types", async () => {
    for (const [field, value] of [
        ["customerId", 0],
        ["customerId", -1],
        ["customerId", 1.5],
        ["customerId", "4"],
        ["customerId", Number.MAX_SAFE_INTEGER + 1],
        ["name", null],
        ["contactName", 42],
        ["email", []],
        ["phone", 9171002002],
        ["address", {}],
        ["notes", false],
        ["isActive", "false"],
        ["isActive", null],
        ["createdBy", 0],
        ["createdBy", "7"],
        ["updatedBy", -1],
        ["updatedBy", 1.5],
    ]) {
        globalThis.fetch = async () => response([{ ...customer, [field]: value }])
        await assert.rejects(api.getCustomers(), /invalid customer/, `invalid ${field}`)
    }
})

test("customer audit timestamps require a real calendar date, time and timezone", async () => {
    for (const field of ["createdAt", "updatedAt"]) {
        for (const value of [
            null,
            "not-a-date",
            "2026-10-28",
            "2026-02-30T00:00:00Z",
            "2026-10-28T24:00:00Z",
            "2026-10-28T00:00:00",
            1792972800000,
        ]) {
            globalThis.fetch = async () => response({ ...customer, [field]: value })
            await assert.rejects(api.getCustomer(4), /invalid customer/, `invalid ${field}`)
        }
    }
})

test("all customer endpoints strip unrelated server fields from public data", async () => {
    const serverCustomer = { ...customer, internalToken: "private", passwordHash: "private" }
    for (const [data, expected, invoke] of [
        [[serverCustomer], [customer], () => api.getCustomers()],
        [serverCustomer, customer, () => api.getCustomer(4)],
        [serverCustomer, customer, () => api.createCustomer({ name: customer.name })],
        [serverCustomer, customer, () => api.updateCustomer(4, { isActive: true })],
    ]) {
        globalThis.fetch = async () => response(data)
        assert.deepEqual(await invoke(), expected)
    }
})

test("customer writes reject malformed returned records before updating the cache", async () => {
    for (const invoke of [
        () => api.createCustomer({ name: customer.name }),
        () => api.updateCustomer(4, { isActive: false }),
    ]) {
        globalThis.fetch = async () => response("saved")
        await assert.rejects(invoke(), /invalid customer/)
    }
})

test("customer HTTP failures preserve status and readable backend messages", async () => {
    for (const status of [200, 401, 403, 404, 409, 503]) {
        globalThis.fetch = async () =>
            Response.json(
                { success: false, error: { message: "  The customer could not be updated.  " } },
                { status },
            )
        await assert.rejects(
            api.updateCustomer(4, { isActive: false }),
            (error) =>
                error instanceof ApiError &&
                error.status === status &&
                error.message === "The customer could not be updated.",
        )
    }
    globalThis.fetch = async () => response([customer], 500)
    await assert.rejects(api.getCustomers(), /HTTP 500/)
    globalThis.fetch = async () => new Response("Service unavailable", { status: 503 })
    await assert.rejects(api.getCustomers(), /HTTP 503/)
})

test("customer network, JSON and envelope failures remain readable", async () => {
    globalThis.fetch = async () => {
        throw new TypeError("fetch failed")
    }
    await assert.rejects(api.getCustomers(), /Unable to reach the API/)
    globalThis.fetch = async () => new Response("{broken JSON")
    await assert.rejects(api.getCustomers(), /invalid JSON/)
    for (const [payload, expected] of [
        [{ success: true }, /missing data/],
        [{ success: true, data: null }, /missing data/],
        [{ data: [customer] }, /request failed/],
        [{ success: "true", data: [customer] }, /request failed/],
        [null, /request failed/],
    ]) {
        globalThis.fetch = async () => Response.json(payload)
        await assert.rejects(api.getCustomers(), expected)
    }
})

test("customer request and response-reading cancellation preserve the original reason", async () => {
    const cancelled = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => {
        throw cancelled
    }
    await assert.rejects(api.getCustomers(), (error) => error === cancelled)
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw cancelled
        },
    })
    await assert.rejects(api.getCustomer(4), (error) => error === cancelled)
    const controller = new AbortController()
    const reason = new Error("Navigation cancelled")
    controller.abort(reason)
    globalThis.fetch = async (_url, request) => {
        assert.equal(request.signal, controller.signal)
        throw request.signal.reason
    }
    await assert.rejects(api.getCustomers(controller.signal), (error) => error === reason)
})

test("customer forms normalize whitespace, email case and blanks without server audit fields", () => {
    const normalized = schema.toCustomerInput({
        name: "  Manila Grocery  ",
        contactName: "  Maria Santos  ",
        email: "  ORDERS@EXAMPLE.TEST  ",
        phone: "  +63 917 100 2002  ",
        address: "  123 Market Street\nManila  ",
        notes: "  Call before delivery.  ",
        isActive: false,
    })
    assert.deepEqual(normalized, {
        name: "Manila Grocery",
        contactName: "Maria Santos",
        email: "orders@example.test",
        phone: "+63 917 100 2002",
        address: "123 Market Street\nManila",
        notes: "Call before delivery.",
        isActive: false,
    })
    assert.deepEqual(schema.toCustomerInput({ ...formValues, email: " ", notes: "\n " }), {
        name: "Manila Grocery",
        contactName: null,
        email: null,
        phone: null,
        address: null,
        notes: null,
        isActive: true,
    })
    for (const field of ["customerId", "createdBy", "createdAt", "updatedBy", "updatedAt"])
        assert.equal(field in normalized, false)
})

test("customer forms require a name and validate contact details against their limits", () => {
    assert.deepEqual(schema.validateCustomer(formValues), {})
    assert.ok(schema.validateCustomer({ ...formValues, name: " \t " }).name)
    assert.ok(schema.validateCustomer({ ...formValues, email: "invalid-email" }).email)
    for (const [field, limit] of [
        ["name", 120],
        ["contactName", 100],
        ["phone", 40],
        ["address", 500],
        ["notes", 2000],
    ]) {
        assert.deepEqual(
            schema.validateCustomer({ ...formValues, [field]: "x".repeat(limit) }),
            {},
            `${field} at its limit`,
        )
        assert.ok(
            schema.validateCustomer({ ...formValues, [field]: "x".repeat(limit + 1) })[field],
            `${field} beyond its limit`,
        )
    }
    const email = `${"x".repeat(64)}@${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(56)}.test`
    assert.equal(email.length, 254)
    assert.deepEqual(schema.validateCustomer({ ...formValues, email }), {})
    assert.ok(schema.validateCustomer({ ...formValues, email: `x${email}` }).email)
})
