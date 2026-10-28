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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://purchasing.example.test/api///"
const api = await import("../src/hooks/modules/purchase-orders/use-purchase-orders.ts")
const schema = await import("../src/components/modules/purchase-orders/purchase-order.schema.ts")
const { ApiError } = await import("../src/lib/api-request.ts")
const originalFetch = globalThis.fetch
const audits = {
    createdBy: 7,
    createdAt: "2026-10-28T00:00:00Z",
    updatedBy: null,
    updatedAt: "2026-10-28T08:00:00+08:00",
}
const order = {
    poId: 5,
    poNumber: "PO-2026-0001",
    supplierId: 4,
    supplierName: "Davao Spices",
    supplierIsActive: true,
    status: "Draft",
    orderDate: "2026-10-28T00:00:00Z",
    expectedDeliveryDate: null,
    notes: null,
    lineCount: 1,
    totalAmount: "11012.35101234",
    receivedAmount: "0.00000000",
    outstandingAmount: "11012.35101234",
    hasReceipts: false,
    ...audits,
}
const line = {
    poLineId: 9,
    poId: 5,
    itemId: 10,
    itemSku: "RM-GARLIC",
    itemName: "Garlic Powder",
    itemType: "Raw Material - Bulk",
    itemIsActive: true,
    uomId: 1,
    uomName: "kg",
    uomClassId: 1,
    primaryUomId: 1,
    primaryUomName: "kg",
    qtyOrdered: "100.0001",
    qtyReceived: "0.0000",
    qtyRemaining: "100.0001",
    unitPrice: "110.1234",
    lineTotal: "11012.35101234",
    ...audits,
}
const detail = { ...order, lines: [line] }
const options = {
    suppliers: [{ supplierId: 4, name: "Davao Spices", isActive: true }],
    items: [
        {
            itemId: 10,
            sku: "RM-GARLIC",
            name: "Garlic Powder",
            itemType: "Raw Material - Bulk",
            isActive: true,
            primaryUomId: 1,
            primaryUomName: "kg",
            uomClassId: 1,
        },
    ],
    uoms: [
        { uomId: 1, name: "kg", uomClassId: 1 },
        { uomId: 2, name: "g", uomClassId: 1 },
        { uomId: 3, name: "pc", uomClassId: 2 },
    ],
    supplierItems: [
        {
            supplierItemId: 8,
            supplierId: 4,
            itemId: 10,
            supplierItemCode: null,
            defaultUomId: null,
            defaultPrice: "110.1234",
            leadTimeDays: null,
            isPreferred: true,
            isActive: true,
        },
    ],
}
const values = {
    poNumber: " po-2026-0001 ",
    supplierId: 4,
    orderDate: "2026-10-28",
    expectedDeliveryDate: "",
    notes: "",
    lines: [{ itemId: 10, uomId: 1, qtyOrdered: "100.0001", unitPrice: "110.1234" }],
}
const input = {
    poNumber: "PO-2026-0001",
    supplierId: 4,
    orderDate: "2026-10-28T00:00:00.000Z",
    expectedDeliveryDate: null,
    notes: null,
    lines: [{ itemId: 10, uomId: 1, qtyOrdered: "100.0001", unitPrice: "110.1234" }],
}
const response = (data, status = 200) => Response.json({ success: true, data }, { status })
afterEach(() => {
    globalThis.fetch = originalFetch
})

test("PO reads normalize the prefix and pass credentials and cancellation", async () => {
    const controller = new AbortController()
    for (const [path, data, invoke] of [
        ["/purchase-orders", [order], () => api.getPurchaseOrders(controller.signal)],
        ["/purchase-orders/5", detail, () => api.getPurchaseOrder(5, controller.signal)],
        ["/purchase-orders/options", options, () => api.getPurchaseOrderOptions(controller.signal)],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://purchasing.example.test/api${path}`)
            assert.equal(request.credentials, "include")
            assert.equal(request.signal, controller.signal)
            assert.equal(request.headers.Accept, "application/json")
            return response(data)
        }
        assert.deepEqual(await invoke(), data)
    }
})

test("PO create and partial PATCH send only supplied writable payloads", async () => {
    for (const [path, method, payload, invoke] of [
        ["/purchase-orders", "POST", input, () => api.createPurchaseOrder(input)],
        [
            "/purchase-orders/5",
            "PATCH",
            { notes: null },
            () => api.updatePurchaseOrder(5, { notes: null }),
        ],
        [
            "/purchase-orders/5",
            "PATCH",
            { lines: input.lines },
            () => api.updatePurchaseOrder(5, { lines: input.lines }),
        ],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://purchasing.example.test/api${path}`)
            assert.equal(request.method, method)
            assert.equal(request.credentials, "include")
            assert.equal(request.headers["Content-Type"], "application/json")
            assert.deepEqual(JSON.parse(request.body), payload)
            return response(detail, method === "POST" ? 201 : 200)
        }
        assert.deepEqual(await invoke(), detail)
    }
})

test("send and cancel POST strict empty objects and consume authoritative detail", async () => {
    for (const [action, status, invoke] of [
        ["send", "Sent", () => api.sendPurchaseOrder(5)],
        ["cancel", "Cancelled", () => api.cancelPurchaseOrder(5)],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://purchasing.example.test/api/purchase-orders/5/${action}`)
            assert.equal(request.method, "POST")
            assert.equal(request.credentials, "include")
            assert.equal(request.body, "{}")
            return response({ ...detail, status })
        }
        assert.equal((await invoke()).status, status)
    }
})

test("all statuses and historical partial receiving quantities remain exact", async () => {
    for (const status of schema.PURCHASE_ORDER_STATUSES) {
        globalThis.fetch = async () => response([{ ...order, status }])
        assert.equal((await api.getPurchaseOrders())[0].status, status)
    }
    const partial = {
        ...detail,
        status: "Partially Received",
        hasReceipts: true,
        receivedAmount: "4404.93600000",
        outstandingAmount: "6607.41501234",
        lines: [{ ...line, qtyReceived: "40.0000", qtyRemaining: "60.0001" }],
    }
    globalThis.fetch = async () => response(partial)
    assert.deepEqual(await api.getPurchaseOrder(5), partial)
})

test("list and detail reject malformed IDs, dates, statuses and decimal response types", async () => {
    for (const patch of [
        { poId: 0 },
        { supplierId: "4" },
        { status: "Approved" },
        { orderDate: "2026-02-30T00:00:00Z" },
        { expectedDeliveryDate: "2026-02-30" },
        { lineCount: 1.5 },
        { totalAmount: 11012.35101234 },
        { totalAmount: "11012.35" },
        { receivedAmount: "-1.00000000" },
        { hasReceipts: "false" },
        { createdBy: 0 },
        { updatedAt: "not-a-date" },
    ]) {
        globalThis.fetch = async () => response([{ ...order, ...patch }])
        await assert.rejects(api.getPurchaseOrders(), /invalid order list/)
    }
    for (const patch of [
        { qtyOrdered: "0.0000" },
        { qtyOrdered: "1.00001" },
        { qtyReceived: 1 },
        { qtyRemaining: "-1" },
        { unitPrice: "10000000000" },
        { lineTotal: "Infinity" },
        { uomId: null },
        { itemType: "Other" },
    ]) {
        globalThis.fetch = async () => response({ ...detail, lines: [{ ...line, ...patch }] })
        await assert.rejects(api.getPurchaseOrder(5), /invalid order detail/)
    }
    globalThis.fetch = async () => response(order)
    await assert.rejects(api.getPurchaseOrder(5), /invalid order detail/)
})

test("DTOs strip unexpected server fields and options validate nullable quotes", async () => {
    globalThis.fetch = async () =>
        response({
            ...detail,
            internalToken: "private",
            lines: [{ ...line, internalToken: "private" }],
        })
    assert.deepEqual(await api.getPurchaseOrder(5), detail)
    const nullableQuote = {
        ...options,
        supplierItems: [{ ...options.supplierItems[0], defaultPrice: null }],
    }
    globalThis.fetch = async () => response(nullableQuote)
    assert.deepEqual(await api.getPurchaseOrderOptions(), nullableQuote)
    for (const malformed of [
        { ...options, suppliers: null },
        { ...options, supplierItems: [{ ...options.supplierItems[0], defaultPrice: 110 }] },
        { ...options, uoms: [{ ...options.uoms[0], uomClassId: "1" }] },
    ]) {
        globalThis.fetch = async () => response(malformed)
        await assert.rejects(api.getPurchaseOrderOptions(), /invalid order options/)
    }
})

test("HTTP failures preserve permission, missing record, state and connection messages", async () => {
    for (const status of [401, 403, 404, 409, 503]) {
        globalThis.fetch = async () =>
            Response.json(
                { success: false, error: { message: "The purchase order is unavailable." } },
                { status },
            )
        await assert.rejects(
            api.sendPurchaseOrder(5),
            (error) =>
                error instanceof ApiError &&
                error.status === status &&
                /purchase order/.test(error.message),
        )
    }
})

test("network, JSON, envelope and missing-data failures stay readable", async () => {
    globalThis.fetch = async () => {
        throw new TypeError("fetch failed")
    }
    await assert.rejects(api.getPurchaseOrders(), /Unable to reach/)
    globalThis.fetch = async () => new Response("broken-json")
    await assert.rejects(api.getPurchaseOrders(), /invalid JSON/)
    globalThis.fetch = async () => Response.json({ data: [order] })
    await assert.rejects(api.getPurchaseOrders(), /failed/)
    globalThis.fetch = async () => Response.json({ success: true })
    await assert.rejects(api.getPurchaseOrder(5), /missing data/)
})

test("query fetch and response-reading cancellation preserve original reasons", async () => {
    const cancelled = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => {
        throw cancelled
    }
    await assert.rejects(api.getPurchaseOrders(), (error) => error === cancelled)
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw cancelled
        },
    })
    await assert.rejects(api.getPurchaseOrder(5), (error) => error === cancelled)
    const controller = new AbortController()
    const reason = new Error("Navigation cancelled")
    controller.abort(reason)
    globalThis.fetch = async (_url, request) => {
        throw request.signal.reason
    }
    await assert.rejects(
        api.getPurchaseOrderOptions(controller.signal),
        (error) => error === reason,
    )
})

test("form helpers normalize dates, numbers and nullable text without writing audit or receipt fields", () => {
    assert.deepEqual(schema.toPurchaseOrderInput(values), input)
    const extra = {
        ...values,
        status: "Completed",
        createdBy: 99,
        lines: [{ ...values.lines[0], poLineId: 99, qtyReceived: "100" }],
    }
    assert.deepEqual(schema.toPurchaseOrderInput(extra), input)
    const normalized = schema.toPurchaseOrderInput({
        ...values,
        notes: " Note ",
        expectedDeliveryDate: "2026-10-29",
    })
    assert.equal(normalized.notes, "Note")
    assert.equal(normalized.expectedDeliveryDate, "2026-10-29")
    assert.equal(schema.localTodayDate(new Date(2026, 9, 28, 12)), "2026-10-28")
    assert.deepEqual(schema.toPurchaseOrderFormValues(detail), {
        ...values,
        poNumber: "PO-2026-0001",
    })
    assert.equal(
        schema.toPurchaseOrderFormValues({ ...detail, orderDate: "invalid" }).orderDate,
        "",
    )
    assert.throws(() => schema.toPurchaseOrderInput({ ...values, orderDate: "2026-02-30" }))
})

test("form validation checks PO uniqueness, active supplier, dates and line counts", () => {
    assert.deepEqual(schema.validatePurchaseOrder(values, options, []), {})
    assert.ok(schema.validatePurchaseOrder(values, options, [order]).poNumber)
    assert.deepEqual(schema.validatePurchaseOrder(values, options, [order], order), {})
    assert.ok(
        schema.validatePurchaseOrder({ ...values, poNumber: "X".repeat(31) }, options, []).poNumber,
    )
    assert.ok(
        schema.validatePurchaseOrder({ ...values, notes: "X".repeat(5001) }, options, []).notes,
    )
    assert.ok(schema.validatePurchaseOrder({ ...values, supplierId: null }, options, []).supplierId)
    assert.ok(
        schema.validatePurchaseOrder(
            values,
            { ...options, suppliers: [{ ...options.suppliers[0], isActive: false }] },
            [],
        ).supplierId,
    )
    for (const orderDate of ["bad", "2026-02-30", "2026-10-28T00:00:00Z"]) {
        assert.ok(schema.validatePurchaseOrder({ ...values, orderDate }, options, []).orderDate)
    }
    assert.ok(
        schema.validatePurchaseOrder({ ...values, expectedDeliveryDate: "2026-10-27" }, options, [])
            .expectedDeliveryDate,
    )
    assert.deepEqual(
        schema.validatePurchaseOrder(
            { ...values, expectedDeliveryDate: "2026-10-28" },
            options,
            [],
        ),
        {},
    )
    assert.ok(schema.validatePurchaseOrder({ ...values, lines: [] }, options, []).lines)
    assert.ok(
        schema.validatePurchaseOrder(
            { ...values, lines: Array(101).fill(values.lines[0]) },
            options,
            [],
        ).lines,
    )
})

test("delivery date comparison uses the UTC order day for offset timestamps", () => {
    const offsetInput = {
        ...input,
        orderDate: "2026-10-29T00:30:00+08:00",
        expectedDeliveryDate: "2026-10-28",
    }
    assert.equal(schema.purchaseOrderInputSchema.safeParse(offsetInput).success, true)
    assert.equal(
        schema.purchaseOrderInputSchema.safeParse({
            ...offsetInput,
            expectedDeliveryDate: "2026-10-27",
        }).success,
        false,
    )
    assert.equal(
        schema.toPurchaseOrderFormValues({ ...detail, orderDate: offsetInput.orderDate }).orderDate,
        "2026-10-28",
    )
})

test("line validation rejects incompatible units and duplicate pairs but allows the same item in different compatible units", () => {
    const pairDuplicate = { ...values, lines: [values.lines[0], values.lines[0]] }
    assert.ok(schema.validatePurchaseOrder(pairDuplicate, options, []).lineErrors[1].itemId)
    const differentUnits = { ...values, lines: [values.lines[0], { ...values.lines[0], uomId: 2 }] }
    assert.deepEqual(schema.validatePurchaseOrder(differentUnits, options, []), {})
    assert.ok(
        schema.validatePurchaseOrder(
            { ...values, lines: [{ ...values.lines[0], uomId: 3 }] },
            options,
            [],
        ).lineErrors[0].uomId,
    )
    for (const itemPatch of [{ isActive: false }, { itemType: "Finished Good" }]) {
        const unavailable = { ...options, items: [{ ...options.items[0], ...itemPatch }] }
        assert.ok(schema.validatePurchaseOrder(values, unavailable, []).lineErrors[0].itemId)
    }
    for (const qtyOrdered of ["0", "-1", "1.00001", "1e3", "10000000000", ""]) {
        assert.ok(
            schema.validatePurchaseOrder(
                { ...values, lines: [{ ...values.lines[0], qtyOrdered }] },
                options,
                [],
            ).lineErrors[0].qtyOrdered,
        )
    }
    assert.deepEqual(
        schema.validatePurchaseOrder(
            { ...values, lines: [{ ...values.lines[0], unitPrice: "0" }] },
            options,
            [],
        ),
        {},
    )
})

test("lifecycle helpers allow only draft edits/sends and unreceived draft/sent cancellation", () => {
    assert.equal(schema.canEditPurchaseOrder(order), true)
    assert.equal(schema.canSendPurchaseOrder(order), true)
    assert.equal(schema.canCancelPurchaseOrder({ ...order, status: "Sent" }), true)
    for (const status of ["Partially Received", "Completed", "Cancelled"]) {
        assert.equal(schema.canEditPurchaseOrder({ ...order, status }), false)
        assert.equal(schema.canSendPurchaseOrder({ ...order, status }), false)
        assert.equal(schema.canCancelPurchaseOrder({ ...order, status }), false)
    }
    assert.equal(schema.canCancelPurchaseOrder({ ...order, hasReceipts: true }), false)
    assert.equal(schema.canSendPurchaseOrder({ ...order, hasReceipts: true }), false)
})

test("quantity-price previews and amount sums retain all 8 places beyond Number precision", () => {
    assert.equal(schema.calculatePurchaseOrderLineTotal("100.0001", "110.1234"), "11012.35101234")
    assert.equal(
        schema.calculatePurchaseOrderLineTotal("9999999999.9999", "9999999999.9999"),
        "99999999999998000000.00000001",
    )
    assert.equal(schema.calculatePurchaseOrderLineTotal("0.0001", "0.0001"), "0.00000001")
    assert.equal(schema.calculatePurchaseOrderLineTotal("2", "0"), "0.00000000")
    assert.equal(
        schema.calculatePurchaseOrderTotal([
            { qtyOrdered: "0.1", unitPrice: "0.2" },
            { qtyOrdered: "0.2", unitPrice: "0.2" },
        ]),
        "0.06000000",
    )
    assert.equal(
        schema.sumPurchaseOrderAmounts(["9007199254740992.00000001", "0.00000001"]),
        "9007199254740992.00000002",
    )
    assert.equal(schema.calculatePurchaseOrderTotal([]), "0.00000000")
    assert.equal(
        schema.comparePurchaseOrderDecimals(
            "9007199254740992.00000001",
            "9007199254740992.00000002",
        ),
        -1,
    )
    assert.equal(schema.comparePurchaseOrderDecimals("1", "1.00000000"), 0)
    assert.equal(schema.comparePurchaseOrderDecimals("2", "1.9"), 1)
})

test("exact amount formatting and partial-input previews guard malformed fields", () => {
    assert.equal(
        schema.formatPurchaseOrderDecimal("99999999999998000000.00000001"),
        "99,999,999,999,998,000,000.00000001",
    )
    assert.equal(schema.formatPurchaseOrderDecimal("0001234.5000"), "1,234.5")
    assert.equal(schema.formatPurchaseOrderDecimal("0.00000000"), "0")
    for (const invalid of ["", "1.", "-1", "1e3", "NaN", "Infinity", "1.000000001", null, 4]) {
        assert.equal(schema.formatPurchaseOrderDecimal(invalid), "—")
        assert.equal(schema.calculatePurchaseOrderLineTotal(invalid, "1"), null)
        assert.equal(schema.calculatePurchaseOrderLineTotal("1", invalid), null)
        assert.equal(schema.comparePurchaseOrderDecimals(invalid, "1"), 0)
    }
    assert.equal(schema.calculatePurchaseOrderLineTotal("0", "1"), null)
    assert.equal(schema.sumPurchaseOrderAmounts(["1.00000000", "bad"]), null)
    assert.equal(schema.calculatePurchaseOrderTotal([{ qtyOrdered: "", unitPrice: "1" }]), null)
})
