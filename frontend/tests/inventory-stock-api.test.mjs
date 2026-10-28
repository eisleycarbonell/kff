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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://stocks.example.test/custom-api///"
const api = await import("../src/hooks/modules/inventory-stocks/use-inventory-stocks.ts")
const schema = await import("../src/components/modules/inventory-stocks/inventory-stock.schema.ts")
const { ApiError } = await import("../src/lib/api-request.ts")
const originalFetch = globalThis.fetch
const stock = {
    stockId: 1,
    itemId: 10,
    sku: "RM-GARLIC",
    itemName: "Garlic powder",
    itemType: "Raw Material - Bulk",
    primaryUomId: 1,
    primaryUomName: "kg",
    lotId: 2,
    lotNumber: "GARLIC-001",
    supplierLotNumber: null,
    manufactureDate: null,
    expirationDate: null,
    qcStatus: "Approved",
    lotUnitCost: "110.0000",
    locationId: 3,
    locationCode: "WH-RM",
    locationName: "Raw materials",
    locationType: "Warehouse",
    qtyOnHand: "10.0000",
    qtyReserved: "2.5000",
    qtyAvailable: "7.5000",
    lastUpdated: "2026-10-27T00:00:00Z",
}
const options = {
    lots: [
        {
            lotId: 2,
            lotNumber: "GARLIC-001",
            itemId: 10,
            itemName: "Garlic powder",
            sku: "RM-GARLIC",
            primaryUomName: "kg",
        },
    ],
    locations: [
        {
            locationId: 3,
            name: "Raw materials",
            code: "WH-RM",
            locationType: "Warehouse",
            isActive: true,
        },
    ],
    reasons: [{ reasonId: 4, codeName: "Physical count", description: null }],
}
const input = {
    lotId: 2,
    locationId: 3,
    reasonId: 4,
    expectedQtyOnHand: "10.0000",
    qtyOnHand: "12.0001",
    referenceId: null,
}
const response = (data, status = 200) =>
    new Response(JSON.stringify({ success: true, data }), {
        status,
        headers: { "Content-Type": "application/json" },
    })
afterEach(() => {
    globalThis.fetch = originalFetch
})
test("stock GET uses the configured API prefix, credentials, cancellation, and exact balances", async () => {
    const controller = new AbortController()
    globalThis.fetch = async (url, request) => {
        assert.equal(url, "https://stocks.example.test/custom-api/inventory/stocks")
        assert.equal(request.credentials, "include")
        assert.equal(request.signal, controller.signal)
        return response([stock])
    }
    assert.deepEqual(await api.getInventoryStocks(controller.signal), [stock])
})
test("stock lists accept empty balances, optional lot dates, transit locations, and visible reservation deficits", async () => {
    globalThis.fetch = async () => response([])
    assert.deepEqual(await api.getInventoryStocks(), [])
    const transit = {
        ...stock,
        locationType: "In Transit",
        qtyOnHand: "0",
        qtyReserved: "0.0001",
        qtyAvailable: "-0.0001",
    }
    globalThis.fetch = async () => response([transit])
    assert.deepEqual(await api.getInventoryStocks(), [transit])
})
test("stock DTO validation rejects malformed data, numeric quantities, invalid dates, and unknown statuses", async () => {
    for (const data of [
        null,
        {},
        [{ ...stock, stockId: 0 }],
        [{ ...stock, qtyOnHand: 10 }],
        [{ ...stock, qtyOnHand: "10000000000" }],
        [{ ...stock, qtyReserved: "-1" }],
        [{ ...stock, qtyAvailable: "1e3" }],
        [{ ...stock, qtyOnHand: "0.00001" }],
        [{ ...stock, qcStatus: "Pending" }],
        [{ ...stock, lastUpdated: "yesterday" }],
    ]) {
        globalThis.fetch = async () => response(data)
        await assert.rejects(
            api.getInventoryStocks(),
            data === null ? /missing data/ : /invalid inventory balances/,
        )
    }
})
test("public stock parsing strips server-only fields", async () => {
    globalThis.fetch = async () =>
        response([{ ...stock, passwordHash: "private", rawSql: "private" }])
    assert.deepEqual(await api.getInventoryStocks(), [stock])
})
test("stock adjustment options come from their authenticated endpoint and are validated", async () => {
    globalThis.fetch = async (url, request) => {
        assert.equal(url, "https://stocks.example.test/custom-api/inventory/stocks/options")
        assert.equal(request.credentials, "include")
        return response(options)
    }
    assert.deepEqual(await api.getStockOptions(), options)
    globalThis.fetch = async () => response({ ...options, reasons: [{ reasonId: 0 }] })
    await assert.rejects(api.getStockOptions(), /invalid adjustment options/)
})
test("recording an adjustment sends counted and expected balances and parses its committed ledger result", async () => {
    const result = {
        stock: { ...stock, qtyOnHand: "12.0001", qtyAvailable: "9.5001" },
        transactionId: 55,
        qtyChange: "2.0001",
    }
    globalThis.fetch = async (url, request) => {
        assert.equal(url, "https://stocks.example.test/custom-api/inventory/stocks/adjustments")
        assert.equal(request.method, "POST")
        assert.equal(request.credentials, "include")
        assert.deepEqual(JSON.parse(request.body), input)
        return response(result, 201)
    }
    assert.deepEqual(await api.recordStockAdjustment(input), result)
    globalThis.fetch = async () => response({ ...result, qtyChange: 2.0001 })
    await assert.rejects(api.recordStockAdjustment(input), /invalid adjustment result/)
})
test("permission and stale-count errors retain HTTP status and the backend message", async () => {
    for (const status of [401, 403, 409, 503]) {
        globalThis.fetch = async () =>
            new Response(
                JSON.stringify({
                    success: false,
                    error: { message: "Stock changed. Refresh and reopen." },
                }),
                { status },
            )
        await assert.rejects(
            api.recordStockAdjustment(input),
            (error) =>
                error instanceof ApiError &&
                error.status === status &&
                /Stock changed/.test(error.message),
        )
    }
})
test("stock request cancellation, network failure, invalid JSON, and invalid envelopes are handled", async () => {
    const abort = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => {
        throw abort
    }
    await assert.rejects(api.getInventoryStocks(), (error) => error === abort)
    globalThis.fetch = async () => {
        throw new TypeError("Network failed")
    }
    await assert.rejects(api.getInventoryStocks(), /Unable to reach/)
    globalThis.fetch = async () => new Response("not-json", { status: 200 })
    await assert.rejects(api.getInventoryStocks(), /invalid JSON/)
    globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }), { status: 200 })
    await assert.rejects(api.getInventoryStocks(), /API request failed/)
})
test("stock quantities format and sort without losing large values, fractions, or negative deficits", () => {
    assert.equal(schema.formatStockQuantity("9007199254740993.0001"), "9,007,199,254,740,993.0001")
    assert.equal(schema.formatStockQuantity("-0.0001"), "-0.0001")
    assert.equal(schema.formatStockQuantity("12.2500"), "12.25")
    assert.equal(schema.compareStockQuantities("10", "2"), 1)
    assert.equal(schema.compareStockQuantities("1.1", "1.1000"), 0)
    assert.equal(
        schema.compareStockQuantities("9007199254740993.0001", "9007199254740993.0002"),
        -1,
    )
})
test("inventory totals add matching primary units and keep kg separate from pieces", () => {
    const totals = schema.stockTotalsByUom([
        stock,
        { ...stock, stockId: 2, qtyOnHand: "0.0001", qtyReserved: "0", qtyAvailable: "0.0001" },
        {
            ...stock,
            stockId: 3,
            primaryUomId: 2,
            primaryUomName: "pcs",
            qtyOnHand: "100",
            qtyReserved: "25",
            qtyAvailable: "75",
        },
    ])
    assert.deepEqual(totals, [
        {
            uomId: 1,
            uomName: "kg",
            qtyOnHand: "10.0001",
            qtyReserved: "2.5000",
            qtyAvailable: "7.5001",
        },
        {
            uomId: 2,
            uomName: "pcs",
            qtyOnHand: "100.0000",
            qtyReserved: "25.0000",
            qtyAvailable: "75.0000",
        },
    ])
    assert.deepEqual(schema.stockTotalsByUom([]), [])
})
test("counted forms validate required relationships, reservations, unchanged counts, and writable fields", () => {
    const values = { ...input, referenceId: " COUNT-1 " }
    assert.deepEqual(schema.validateStockAdjustment(values, options, "2.5"), {})
    assert.deepEqual(schema.toStockAdjustment(values), { ...input, referenceId: "COUNT-1" })
    assert.equal(schema.toStockAdjustment({ ...values, referenceId: " " }).referenceId, null)
    assert.ok(
        schema.validateStockAdjustment({ ...values, qtyOnHand: "2.4999" }, options, "2.5")
            .qtyOnHand,
    )
    assert.ok(
        schema.validateStockAdjustment({ ...values, qtyOnHand: "10" }, options, "2.5").qtyOnHand,
    )
    assert.ok(
        schema.validateStockAdjustment({ ...values, reasonId: null }, options, "2.5").reasonId,
    )
    assert.ok(schema.validateStockAdjustment({ ...values, lotId: 999 }, options, "2.5").lotId)
    assert.throws(() => schema.toStockAdjustment({ ...values, authorizedByUserId: 999 }))
})

test("stock count forms reject inactive locations and accept active locations", () => {
    const inactive = {
        ...options,
        locations: options.locations.map((location) => ({ ...location, isActive: false })),
    }
    assert.ok(
        schema.validateStockAdjustment({ ...input, referenceId: "COUNT-1" }, inactive, "0")
            .locationId,
    )
    const active = {
        ...options,
        locations: options.locations.map((location) => ({ ...location, isActive: true })),
    }
    assert.equal(
        schema.validateStockAdjustment({ ...input, referenceId: "COUNT-1" }, active, "0")
            .locationId,
        undefined,
    )
})
