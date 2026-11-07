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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://delivery.example.test/api/"
const api = await import("../src/hooks/modules/delivery-orders/use-delivery-orders.ts")
const schema = await import("../src/components/modules/delivery-orders/delivery-order.schema.ts")
const { ApiError } = await import("../src/lib/api-request.ts")
const originalFetch = globalThis.fetch
afterEach(() => {
    globalThis.fetch = originalFetch
})
const timestamp = "2026-11-05T02:00:00.000Z"
const order = {
    deliveryOrderId: 1,
    deliveryOrderNumber: "DO-2026-001",
    salesOrderId: 2,
    salesOrderNumber: "SO-2026-001",
    customerId: 3,
    customerName: "Manila Grocery",
    sourceLocationId: 4,
    sourceLocationName: "Finished Goods",
    transitLocationId: null,
    transitLocationName: null,
    deliveryDate: "2026-11-05",
    notes: null,
    status: "Draft",
    dispatchedAt: null,
    completedAt: null,
    createdBy: 6,
    updatedBy: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    lines: [
        {
            deliveryOrderLineId: 7,
            deliveryOrderId: 1,
            salesOrderLineId: 8,
            itemId: 9,
            itemSku: "FG-GARLIC",
            itemName: "Garlic Powder 100g",
            lotId: 10,
            lotNumber: "FG-GAR-001",
            uomId: 11,
            uomName: "pc",
            qtyDelivered: "2.0001",
        },
    ],
}
const options = {
    salesOrders: [
        {
            salesOrderId: 2,
            salesOrderNumber: "SO-2026-001",
            customerName: "Manila Grocery",
            orderDate: "2026-11-01",
            lines: [
                {
                    salesOrderLineId: 8,
                    itemId: 9,
                    itemSku: "FG-GARLIC",
                    itemName: "Garlic Powder 100g",
                    uomId: 11,
                    uomName: "pc",
                    qtyOrdered: "10.0000",
                    qtyDelivered: "0.0000",
                    qtyAllocated: "4.0000",
                    qtyRemaining: "10.0000",
                },
            ],
        },
    ],
    locations: [
        { locationId: 4, name: "Finished Goods", locationType: "Warehouse", isActive: true },
        { locationId: 5, name: "Goods In Transit", locationType: "In Transit", isActive: true },
    ],
    stock: [
        {
            stockId: 12,
            itemId: 9,
            itemSku: "FG-GARLIC",
            itemName: "Garlic Powder 100g",
            lotId: 10,
            lotNumber: "FG-GAR-001",
            locationId: 4,
            qtyOnHand: "20.0000",
            qtyReserved: "0.0000",
            qtyAvailable: "20.0000",
            uomId: 11,
            uomName: "pc",
            qcStatus: "Approved",
            expirationDate: null,
            packingOrderId: 13,
        },
    ],
}
const input = {
    deliveryOrderNumber: "DO-2026-001",
    salesOrderId: 2,
    sourceLocationId: 4,
    deliveryDate: "2026-11-05",
    notes: null,
    lines: [{ salesOrderLineId: 8, lotId: 10, qtyDelivered: "2.0001" }],
}
const response = (data, status = 200) => Response.json({ success: true, data }, { status })

test("delivery reads use configured API, cookies and cancellation", async () => {
    const controller = new AbortController()
    for (const [path, data, invoke] of [
        ["", [order], () => api.getDeliveryOrders(controller.signal)],
        ["/1", order, () => api.getDeliveryOrder(1, controller.signal)],
        ["/options", options, () => api.getDeliveryOrderOptions(controller.signal)],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://delivery.example.test/api/delivery-orders${path}`)
            assert.equal(request.credentials, "include")
            assert.equal(request.signal, controller.signal)
            assert.equal(request.body, undefined)
            return response(data)
        }
        assert.deepEqual(await invoke(), data)
    }
})
test("delivery writes preserve decimal strings, null notes and supplied fields", async () => {
    for (const [path, method, body, invoke] of [
        ["", "POST", input, () => api.createDeliveryOrder(input)],
        ["/1", "PATCH", { notes: null }, () => api.updateDeliveryOrder(1, { notes: null })],
        [
            "/1/dispatch",
            "POST",
            { transitLocationId: 5 },
            () => api.runDeliveryOrderAction(1, "dispatch", { transitLocationId: 5 }),
        ],
        ["/1/complete", "POST", {}, () => api.runDeliveryOrderAction(1, "complete")],
        ["/1/cancel", "POST", {}, () => api.runDeliveryOrderAction(1, "cancel")],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://delivery.example.test/api/delivery-orders${path}`)
            assert.equal(request.method, method)
            assert.equal(request.credentials, "include")
            assert.equal(new Headers(request.headers).get("Content-Type"), "application/json")
            assert.deepEqual(JSON.parse(request.body), body)
            return response(order, method === "POST" && !path ? 201 : 200)
        }
        assert.deepEqual(await invoke(), order)
    }
})
test("delivery DTOs reject malformed states, decimals, dates and missing lines", async () => {
    for (const data of [
        {},
        { ...order, status: "Delivered" },
        { ...order, deliveryDate: "2026-02-30" },
        { ...order, transitLocationId: 0 },
        { ...order, lines: undefined },
        { ...order, lines: [{ ...order.lines[0], qtyDelivered: 2 }] },
    ]) {
        globalThis.fetch = async () => response(data)
        await assert.rejects(api.getDeliveryOrder(1), /invalid data/)
    }
    globalThis.fetch = async () =>
        response({
            ...order,
            internalSecret: "private",
            lines: [{ ...order.lines[0], privateField: true }],
        })
    assert.deepEqual(await api.getDeliveryOrder(1), order)
})
test("delivery errors retain backend conflicts and cancellation reasons", async () => {
    globalThis.fetch = async () =>
        Response.json(
            { success: false, error: { message: "Insufficient available stock." } },
            { status: 409 },
        )
    await assert.rejects(
        api.runDeliveryOrderAction(1, "dispatch", { transitLocationId: 5 }),
        (error) =>
            error instanceof ApiError && error.status === 409 && /Insufficient/.test(error.message),
    )
    const abort = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => {
        throw abort
    }
    await assert.rejects(api.getDeliveryOrders(), (error) => error === abort)
    globalThis.fetch = async () => new Response("{broken")
    await assert.rejects(api.getDeliveryOrders(), /invalid JSON/)
    globalThis.fetch = async () => {
        throw new TypeError("offline")
    }
    await assert.rejects(api.getDeliveryOrders(), /Unable to reach/)
})
test("delivery form enforces order allocations using exact arithmetic including own draft", () => {
    const values = { ...input, notes: "" }
    assert.deepEqual(schema.validateDeliveryOrder(values, options, null), {})
    assert.equal(schema.remainingAllocation(options.salesOrders[0].lines[0], null), 60000n)
    assert.equal(schema.remainingAllocation(options.salesOrders[0].lines[0], order), 80001n)
    const tooMany = { ...values, lines: [{ ...values.lines[0], qtyDelivered: "6.0001" }] }
    assert.ok(schema.validateDeliveryOrder(tooMany, options, null).lines)
    assert.deepEqual(schema.validateDeliveryOrder(tooMany, options, order), {})
    assert.ok(
        schema.validateDeliveryOrder(
            { ...values, lines: [...values.lines, ...values.lines] },
            options,
            null,
        ).lines,
    )
    for (const qtyDelivered of ["0", "-1", "1e2", "1.00001", "NaN"]) {
        assert.ok(
            schema.validateDeliveryOrder(
                { ...values, lines: [{ ...values.lines[0], qtyDelivered }] },
                options,
                null,
            ).lines,
        )
    }
    assert.equal(schema.quantityUnits("9999999999.9999"), 99999999999999n)
    assert.equal(schema.unitsToQuantity(1n), "0.0001")
    assert.equal(schema.formatDeliveryQuantity("12345.1200"), "12,345.12")
})

test("delivery planning checks dates and eligible lots while physical availability is enforced at dispatch", () => {
    const values = { ...input, notes: "" }
    assert.ok(
        schema.validateDeliveryOrder({ ...values, deliveryDate: "2026-10-31" }, options, null)
            .deliveryDate,
    )
    for (const patch of [
        { qcStatus: "Quarantine" },
        { packingOrderId: null },
        { expirationDate: "2000-01-01" },
        { qtyOnHand: "0.0000" },
    ]) {
        assert.ok(
            schema.validateDeliveryOrder(
                values,
                { ...options, stock: [{ ...options.stock[0], ...patch }] },
                null,
            ).lines,
        )
    }
    assert.deepEqual(
        schema.validateDeliveryOrder(
            values,
            {
                ...options,
                stock: [{ ...options.stock[0], qtyAvailable: "0.0000", qtyReserved: "20.0000" }],
            },
            null,
        ),
        {},
    )
})
