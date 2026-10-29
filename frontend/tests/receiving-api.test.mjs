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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://receiving.example.test/api///"
const api = await import("../src/hooks/modules/receiving/use-receiving.ts")
const schema = await import("../src/components/modules/receiving/receiving.schema.ts")
const { ApiError } = await import("../src/lib/api-request.ts")
const originalFetch = globalThis.fetch
const source = {
    poLineId: 9,
    itemId: 10,
    itemSku: "RM-GARLIC",
    itemName: "Garlic Powder",
    itemType: "Raw Material - Bulk",
    itemIsActive: true,
    requiresQc: true,
    uomId: 1,
    uomName: "kg",
    purchaseUomFactor: "1000.00000000",
    primaryUomId: 2,
    primaryUomName: "g",
    primaryUomFactor: "1.00000000",
    qtyOrdered: "10.0000",
    qtyReceived: "2.0000",
    qtyRemaining: "8.0000",
    unitPrice: "110.1234",
}
const order = {
    poId: 5,
    poNumber: "PO-001",
    supplierId: 4,
    supplierName: "Davao Spices",
    status: "Partially Received",
    lines: [source],
}
const location = {
    locationId: 3,
    code: "WH-RM",
    name: "Raw Materials",
    locationType: "Warehouse",
    isActive: true,
}
const options = { orders: [order], locations: [location] }
const receipt = {
    transactionId: 20,
    lotId: 7,
    lotNumber: "LOT-001",
    supplierLotNumber: null,
    poId: 5,
    poNumber: "PO-001",
    poLineId: 9,
    supplierId: 4,
    supplierName: "Davao Spices",
    itemId: 10,
    itemSku: "RM-GARLIC",
    itemName: "Garlic Powder",
    itemType: "Raw Material - Bulk",
    locationId: 3,
    locationCode: "WH-RM",
    locationName: "Raw Materials",
    purchaseUomId: 1,
    purchaseUomName: "kg",
    primaryUomId: 2,
    primaryUomName: "g",
    qtyReceived: "3.0000",
    qtyPrimary: "3000.0000",
    unitPrice: "110.1234",
    unitCost: "0.1101",
    qcStatus: "Quarantine",
    manufactureDate: null,
    expirationDate: null,
    authorizedByUserId: 6,
    createdAt: "2026-10-28T00:00:00Z",
}
const formLine = {
    poLineId: 9,
    qtyReceived: "3.0000",
    expectedQtyReceived: "2.0000",
    lotNumber: " lot-001 ",
    supplierLotNumber: " ",
    locationId: 3,
    manufactureDate: "",
    expirationDate: "",
}
const values = { poId: 5, lines: [formLine] }
const input = {
    poId: 5,
    lines: [
        {
            ...formLine,
            lotNumber: "LOT-001",
            supplierLotNumber: null,
            manufactureDate: null,
            expirationDate: null,
        },
    ],
}
const result = { receipts: [receipt], poId: 5, poStatus: "Partially Received" }
const response = (data, status = 200) => Response.json({ success: true, data }, { status })
afterEach(() => {
    globalThis.fetch = originalFetch
})

test("receiving reads forward credentials, configured prefix and cancellation", async () => {
    const controller = new AbortController()
    for (const [path, data, invoke] of [
        ["/receiving", [receipt], () => api.getReceipts(controller.signal)],
        ["/receiving/options", options, () => api.getReceivingOptions(controller.signal)],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://receiving.example.test/api${path}`)
            assert.equal(request.credentials, "include")
            assert.equal(request.signal, controller.signal)
            return response(data)
        }
        assert.deepEqual(await invoke(), data)
    }
})
test("receiving POST carries the original snapshot and returns authoritative receipts and PO status", async () => {
    globalThis.fetch = async (url, request) => {
        assert.equal(url, "https://receiving.example.test/api/receiving")
        assert.equal(request.method, "POST")
        assert.equal(request.credentials, "include")
        assert.equal(request.headers["Content-Type"], "application/json")
        assert.deepEqual(JSON.parse(request.body), input)
        return response(result, 201)
    }
    assert.deepEqual(await api.recordReceipt(input), result)
})
test("historic inverse purchase quantities and optional lot metadata remain nullable", async () => {
    const historical = { ...receipt, qtyReceived: null, unitCost: null }
    globalThis.fetch = async () => response([historical])
    assert.deepEqual(await api.getReceipts(), [historical])
    globalThis.fetch = async () => response([{ ...receipt, internalToken: "private" }])
    assert.deepEqual(await api.getReceipts(), [receipt])
})
test("receipt DTOs reject invalid IDs, enums, numeric quantities and calendar dates", async () => {
    for (const patch of [
        { transactionId: 0 },
        { qtyReceived: 3 },
        { qtyPrimary: "0" },
        { qtyPrimary: "1.00001" },
        { qtyPrimary: "10000000000" },
        { unitCost: 0.1101 },
        { unitPrice: "-1" },
        { qcStatus: "Pending" },
        { manufactureDate: "2026-02-30" },
        { createdAt: "bad" },
        { authorizedByUserId: null },
    ]) {
        globalThis.fetch = async () => response([{ ...receipt, ...patch }])
        await assert.rejects(api.getReceipts(), /invalid receipt history/)
    }
    globalThis.fetch = async () => response({ ...result, poStatus: "Sent" })
    await assert.rejects(api.recordReceipt(input), /invalid receipt result/)
})
test("receiving option DTOs validate open PO states and exact positive UOM factors", async () => {
    for (const patch of [
        { purchaseUomFactor: 1000 },
        { primaryUomFactor: "0.00000000" },
        { qtyReceived: null },
    ]) {
        globalThis.fetch = async () =>
            response({ ...options, orders: [{ ...order, lines: [{ ...source, ...patch }] }] })
        await assert.rejects(
            api.getReceivingOptions(),
            /invalid purchase order and location options/,
        )
    }
    globalThis.fetch = async () => response({ ...options, orders: [{ ...order, status: "Draft" }] })
    await assert.rejects(api.getReceivingOptions(), /invalid purchase order and location options/)
})
test("receiving errors preserve HTTP status and do not change the submitted form snapshot", async () => {
    for (const status of [400, 401, 403, 409, 503]) {
        globalThis.fetch = async () =>
            Response.json(
                {
                    success: false,
                    error: { message: "Received quantities changed. Review this PO." },
                },
                { status },
            )
        await assert.rejects(
            api.recordReceipt(input),
            (error) =>
                error instanceof ApiError &&
                error.status === status &&
                /Received quantities/.test(error.message),
        )
        assert.equal(values.lines[0].expectedQtyReceived, "2.0000")
        assert.equal(values.lines[0].qtyReceived, "3.0000")
    }
})
test("receiving network, JSON and cancellation failures remain readable", async () => {
    globalThis.fetch = async () => {
        throw new TypeError("fetch failed")
    }
    await assert.rejects(api.getReceipts(), /Unable to reach/)
    globalThis.fetch = async () => new Response("bad-json")
    await assert.rejects(api.getReceipts(), /invalid JSON/)
    globalThis.fetch = async () => Response.json({ success: true })
    await assert.rejects(api.getReceivingOptions(), /missing data/)
    const cancelled = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => {
        throw cancelled
    }
    await assert.rejects(api.getReceipts(), (error) => error === cancelled)
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw cancelled
        },
    })
    await assert.rejects(api.getReceivingOptions(), (error) => error === cancelled)
    const controller = new AbortController(),
        reason = new Error("Navigation cancelled")
    controller.abort(reason)
    globalThis.fetch = async (_url, request) => {
        throw request.signal.reason
    }
    await assert.rejects(api.getReceipts(controller.signal), (error) => error === reason)
})
test("receipt forms normalize new lot numbers and project only server-writable fields", () => {
    assert.deepEqual(schema.toReceivingInput(values), input)
    assert.deepEqual(schema.validateReceipt(values, options), {})
    const extra = {
        ...values,
        createdBy: 99,
        lines: [{ ...formLine, itemId: 99, unitCost: "1", qcStatus: "Approved", uomId: 2 }],
    }
    assert.deepEqual(schema.toReceivingInput(extra), input)
    for (const field of ["itemId", "uomId", "unitCost", "qcStatus", "createdBy"]) {
        assert.equal(
            schema.receivingInputSchema.safeParse({
                ...input,
                lines: [{ ...input.lines[0], [field]: 1 }],
            }).success,
            false,
        )
    }
    assert.equal(
        schema.receivingInputSchema.safeParse({
            poId: 5,
            lines: [{ ...input.lines[0], expectedQtyReceived: undefined }],
        }).success,
        false,
    )
})
test("split lots share a starting snapshot and are checked against their aggregate remaining quantity", () => {
    const split = {
        poId: 5,
        lines: [formLine, { ...formLine, lotNumber: "LOT-002", qtyReceived: "5" }],
    }
    assert.deepEqual(schema.validateReceipt(split, options), {})
    assert.ok(
        schema.validateReceipt(
            { ...split, lines: [formLine, { ...split.lines[1], qtyReceived: "5.0001" }] },
            options,
        ).lineErrors[0].qtyReceived,
    )
    assert.ok(
        schema.validateReceipt(
            { ...split, lines: [formLine, { ...split.lines[1], expectedQtyReceived: "3" }] },
            options,
        ).lineErrors[1].expectedQtyReceived,
    )
    const stale = {
        ...options,
        orders: [
            { ...order, lines: [{ ...source, qtyReceived: "3.0000", qtyRemaining: "7.0000" }] },
        ],
    }
    assert.ok(schema.validateReceipt(values, stale).lineErrors[0].expectedQtyReceived)
    assert.equal(values.lines[0].expectedQtyReceived, "2.0000")
    assert.ok(
        schema.validateReceipt(
            { ...split, lines: [formLine, { ...formLine, lotNumber: "LOT-001" }] },
            options,
        ).lineErrors[1].lotNumber,
    )
})
test("receipt validation requires valid open lines, safe destinations and optional strictly ordered dates", () => {
    assert.ok(schema.validateReceipt({ ...values, poId: null }, options).poId)
    for (const patch of [{ itemIsActive: false }, { itemType: "Finished Good" }]) {
        assert.ok(
            schema.validateReceipt(values, {
                ...options,
                orders: [{ ...order, lines: [{ ...source, ...patch }] }],
            }).lineErrors[0].poLineId,
        )
    }
    for (const patch of [
        { isActive: false },
        { locationType: "Store" },
        { locationType: "In Transit" },
    ]) {
        assert.ok(
            schema.validateReceipt(values, { ...options, locations: [{ ...location, ...patch }] })
                .lineErrors[0].locationId,
        )
    }
    assert.deepEqual(
        schema.validateReceipt(values, {
            ...options,
            locations: [{ ...location, locationType: "Quarantine" }],
        }),
        {},
    )
    for (const expirationDate of ["2026-10-28", "2026-10-27", "2026-02-30"]) {
        assert.ok(
            schema.validateReceipt(
                {
                    ...values,
                    lines: [{ ...formLine, manufactureDate: "2026-10-28", expirationDate }],
                },
                options,
            ).lineErrors[0].expirationDate,
        )
    }
    assert.deepEqual(
        schema.validateReceipt(
            { ...values, lines: [{ ...formLine, expirationDate: "2026-10-29" }] },
            options,
        ),
        {},
    )
    assert.ok(schema.validateReceipt({ ...values, lines: [] }, options).lines)
})
test("primary quantity previews convert exactly and reject rounding, zero and range overflow", () => {
    assert.equal(
        schema.calculateReceiptPrimaryQuantity("3.0001", "1000.00000000", "1.00000000"),
        "3000.1000",
    )
    assert.equal(schema.calculateReceiptPrimaryQuantity("3", "1.00000000", "3.00000000"), "1.0000")
    assert.equal(schema.calculateReceiptPrimaryQuantity("0.0001", "1.00000000", "3.00000000"), null)
    assert.equal(
        schema.calculateReceiptPrimaryQuantity("9999999999.9999", "1.00000000", "1.00000000"),
        "9999999999.9999",
    )
    assert.equal(
        schema.calculateReceiptPrimaryQuantity("9999999999.9999", "2.00000000", "1.00000000"),
        null,
    )
    for (const value of ["0", "-1", "1e3", "1.00001", "", null])
        assert.equal(
            schema.calculateReceiptPrimaryQuantity(value, "1.00000000", "1.00000000"),
            null,
        )
    assert.equal(schema.calculateReceiptPrimaryQuantity("1", "0.00000000", "1.00000000"), null)
})
test("unit cost previews use half-up four-place rounding and enforce the cost range", () => {
    assert.equal(
        schema.calculateReceiptUnitCost("110.1234", "1000.00000000", "1.00000000"),
        "0.1101",
    )
    assert.equal(schema.calculateReceiptUnitCost("0.0001", "2.00000000", "1.00000000"), "0.0001")
    assert.equal(schema.calculateReceiptUnitCost("0.0001", "3.00000000", "1.00000000"), "0.0000")
    assert.equal(schema.calculateReceiptUnitCost("0", "1.00000000", "1.00000000"), "0.0000")
    assert.equal(
        schema.calculateReceiptUnitCost("9999999999.9999", "1.00000000", "2.00000000"),
        null,
    )
    assert.equal(schema.calculateReceiptUnitCost("bad", "1.00000000", "1.00000000"), null)
})
test("grouped receiving statistics and sorting preserve quantities beyond Number precision", () => {
    assert.equal(
        schema.sumReceivingQuantities(["9007199254740992.0001", "0.0001"]),
        "9007199254740992.0002",
    )
    assert.equal(schema.sumReceivingQuantities(["-1.0000", "0.0001"]), "-0.9999")
    assert.equal(schema.sumReceivingQuantities([]), "0.0000")
    assert.equal(schema.sumReceivingQuantities(["bad"]), null)
    assert.equal(
        schema.compareReceivingDecimals("9007199254740992.0001", "9007199254740992.0002"),
        -1,
    )
    assert.equal(
        schema.formatReceivingDecimal("9007199254740992.0001"),
        "9,007,199,254,740,992.0001",
    )
    assert.equal(schema.formatReceivingDecimal("NaN"), "—")
})
