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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://sales.example.test/api///"
const api = await import("../src/hooks/modules/sales-orders/use-sales-orders.ts")
const schema = await import("../src/components/modules/sales-orders/sales-order.schema.ts")
const { ApiError } = await import("../src/lib/api-request.ts")
const originalFetch = globalThis.fetch
const line = {
    salesOrderLineId: 8,
    salesOrderId: 5,
    itemId: 3,
    itemSku: "FG-GARLIC",
    itemName: "Garlic 100g",
    uomId: 2,
    uomName: "pc",
    qtyOrdered: "20.0001",
    qtyDelivered: "0.0000",
    qtyRemaining: "20.0001",
    qtyAllocated: "0.0000",
    unitPrice: "5.1250",
    lineTotal: "102.5005",
}
const order = {
    salesOrderId: 5,
    salesOrderNumber: "SO-2026-001",
    customerId: 4,
    customerName: "Customer",
    customerIsActive: true,
    orderDate: "2026-11-05",
    requestedDeliveryDate: null,
    notes: null,
    status: "Draft",
    totalAmount: "102.5005",
    lineCount: 1,
    lines: [line],
    createdBy: 7,
    updatedBy: null,
    createdAt: "2026-11-05T00:00:00Z",
    updatedAt: "2026-11-05T08:00:00+08:00",
}
const options = {
    customers: [{ customerId: 4, name: "Customer", isActive: true }],
    items: [
        {
            itemId: 3,
            sku: "FG-GARLIC",
            name: "Garlic 100g",
            primaryUomId: 2,
            primaryUomName: "pc",
            isActive: true,
        },
    ],
}
const input = {
    salesOrderNumber: "SO-2026-001",
    customerId: 4,
    orderDate: "2026-11-05",
    requestedDeliveryDate: null,
    notes: null,
    lines: [{ itemId: 3, uomId: 2, qtyOrdered: "20.0001", unitPrice: "5.1250" }],
}
const values = {
    ...input,
    salesOrderNumber: " so-2026-001 ",
    requestedDeliveryDate: "",
    notes: "",
}
const response = (data, status = 200) => Response.json({ success: true, data }, { status })
afterEach(() => {
    globalThis.fetch = originalFetch
})

test("sales reads normalize API prefix, preserve decimals and nullable fields, and pass cancellation", async () => {
    const controller = new AbortController()
    for (const [path, data, invoke] of [
        ["/sales-orders", [order], () => api.getSalesOrders(controller.signal)],
        ["/sales-orders/5", order, () => api.getSalesOrder(5, controller.signal)],
        ["/sales-orders/options", options, () => api.getSalesOrderOptions(controller.signal)],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://sales.example.test/api${path}`)
            assert.equal(request.credentials, "include")
            assert.equal(request.signal, controller.signal)
            return response(data)
        }
        assert.deepEqual(await invoke(), data)
    }
})
test("sales writes send writable create and partial patch payloads", async () => {
    for (const [path, method, payload, invoke] of [
        ["/sales-orders", "POST", input, () => api.createSalesOrder(input)],
        [
            "/sales-orders/5",
            "PATCH",
            { notes: null },
            () => api.updateSalesOrder(5, { notes: null }),
        ],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://sales.example.test/api${path}`)
            assert.equal(request.method, method)
            assert.equal(request.headers["Content-Type"], "application/json")
            assert.equal(request.credentials, "include")
            assert.deepEqual(JSON.parse(request.body), payload)
            return response(order, method === "POST" ? 201 : 200)
        }
        assert.deepEqual(await invoke(), order)
    }
})
test("sales workflow actions POST empty objects and use authoritative states", async () => {
    for (const [action, status, invoke] of [
        ["confirm", "Confirmed", () => api.confirmSalesOrder(5)],
        ["cancel", "Cancelled", () => api.cancelSalesOrder(5)],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://sales.example.test/api/sales-orders/5/${action}`)
            assert.equal(request.method, "POST")
            assert.equal(request.body, "{}")
            return response({ ...order, status })
        }
        assert.equal((await invoke()).status, status)
    }
})
test("sales DTOs reject malformed IDs, dates, statuses and numeric stock or money", async () => {
    for (const patch of [
        { salesOrderId: 0 },
        { orderDate: "2026-02-30" },
        { requestedDeliveryDate: "bad" },
        { status: "Approved" },
        { totalAmount: 5.125 },
        { createdBy: "7" },
        { lines: [{ ...line, qtyOrdered: 20 }] },
        { lines: [{ ...line, qtyAllocated: "-1.0000" }] },
    ]) {
        globalThis.fetch = async () => response([{ ...order, ...patch }])
        await assert.rejects(api.getSalesOrders(), /invalid record/)
    }
    for (const status of schema.SALES_ORDER_STATUSES) {
        globalThis.fetch = async () => response({ ...order, status })
        assert.equal((await api.getSalesOrder(5)).status, status)
    }
})
test("sales errors retain server status and network cancellation", async () => {
    globalThis.fetch = async () =>
        Response.json(
            {
                success: false,
                error: { message: "Active deliveries must be cancelled first." },
            },
            { status: 409 },
        )
    await assert.rejects(
        api.cancelSalesOrder(5),
        (error) =>
            error instanceof ApiError &&
            error.status === 409 &&
            /Active deliveries/.test(error.message),
    )
    const aborted = new DOMException("Aborted", "AbortError")
    globalThis.fetch = async () => {
        throw aborted
    }
    await assert.rejects(api.getSalesOrders(), (error) => error === aborted)
    globalThis.fetch = async () => new Response("not-json", { status: 200 })
    await assert.rejects(api.getSalesOrders(), /JSON|response/i)
})
test("sales forms normalize writable values and reject inactive or incompatible selections", () => {
    assert.deepEqual(schema.toSalesOrderInput(values), input)
    assert.deepEqual(schema.validateSalesOrder(values, options), {})
    assert.ok(
        schema.validateSalesOrder({ ...values, requestedDeliveryDate: "2026-11-04" }, options)
            .requestedDeliveryDate,
    )
    assert.ok(
        schema.validateSalesOrder(values, {
            ...options,
            customers: [{ ...options.customers[0], isActive: false }],
        }).customerId,
    )
    assert.ok(
        schema.validateSalesOrder(
            { ...values, lines: [{ ...values.lines[0], uomId: 99 }] },
            options,
        )["lines.0.itemId"],
    )
    assert.ok(
        schema.validateSalesOrder(
            { ...values, lines: [values.lines[0], values.lines[0]] },
            options,
        )["lines.1.itemId"],
    )
    assert.ok(
        schema.validateSalesOrder(
            { ...values, lines: [{ ...values.lines[0], qtyOrdered: "0" }] },
            options,
        )["lines.0.qtyOrdered"],
    )
    assert.equal(
        schema.previewSalesTotal([
            { itemId: 3, uomId: 2, qtyOrdered: "0.1001", unitPrice: "0.1001" },
        ]),
        "0.0100",
    )
    assert.equal(schema.compareSalesDecimals("9999999999.9999", "9999999999.9998"), 1)
})
