import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { afterEach, test } from "node:test"

registerHooks({ resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith("@/") ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context)
} })
const api = await import("../src/hooks/modules/packing-orders/use-packing-orders.ts")
const schema = await import("../src/components/modules/packing-orders/packing-order.schema.ts")
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const timestamp = "2026-10-29T00:00:00.000Z"
const order = {
    packingOrderId: 1, packingOrderNumber: "PK-2026-0001", itemId: 4, itemSku: "FG-GARLIC", itemName: "Packed garlic",
    primaryUomId: 2, primaryUomName: "pc", targetQty: "500.0000", actualQty: "0.0000", status: "Draft",
    sourceLocationId: 1, sourceLocationCode: "WH-RM", sourceLocationName: "Materials", destinationLocationId: 2,
    destinationLocationCode: "WH-FG", destinationLocationName: "Finished goods", scheduledDate: null, startedAt: null,
    completedAt: null, notes: null, createdBy: 1, createdAt: timestamp, updatedBy: 1, updatedAt: timestamp, materialCount: 1,
}
const reservation = {
    reservationId: 1, packingOrderMaterialId: 1, packingOrderId: 1, packingOrderNumber: order.packingOrderNumber,
    orderStatus: "Planned", itemId: 3, itemSku: "RM-GARLIC", itemName: "Garlic", primaryUomId: 1, primaryUomName: "kg",
    lotId: 1, lotNumber: "GAR-01", locationId: 1, locationCode: "WH-RM", locationName: "Materials", qtyReserved: "50.0000",
    qtyConsumed: "0.0000", qtyOutstanding: "50.0000", releasedAt: null, expirationDate: null, createdAt: timestamp, updatedAt: timestamp,
}
const detail = { ...order, materials: [{ packingOrderMaterialId: 1, itemId: 3, itemSku: "RM-GARLIC", itemName: "Garlic", uomId: 1, uomName: "kg", requiredQty: "50.0000", consumedQty: "0.0000", qtyReserved: "0.0000" }], reservations: [], finishedLots: [] }
const options = { items: [{ itemId: 4, sku: "FG-GARLIC", name: "Packed garlic", primaryUomId: 2, primaryUomName: "pc", hasBom: true }], locations: [{ locationId: 1, code: "WH-RM", name: "Materials", locationType: "Warehouse" }, { locationId: 2, code: "WH-FG", name: "Finished goods", locationType: "Warehouse" }] }
const preview = { itemId: 4, itemSku: "FG-GARLIC", itemName: "Packed garlic", primaryUomId: 2, primaryUomName: "pc", targetQty: "500.0000", sourceLocationId: 1, maxProducible: "400.0000", canPlan: false, materials: [{ itemId: 3, itemSku: "RM-GARLIC", itemName: "Garlic", uomId: 1, uomName: "kg", requiredQty: "50.0000", qtyOnHand: "60.0000", qtyReserved: "20.0000", qtyAvailable: "40.0000", maxProducible: "400.0000", shortageQty: "10.0000" }] }
for (const [name, path, invoke, response] of [
    ["list", "", (signal) => api.getPackingOrders(signal), [order]],
    ["detail", "/1", (signal) => api.getPackingOrder(1, signal), detail],
    ["options", "/options", (signal) => api.getPackingOptions(signal), options],
    ["reservations", "/reservations", (signal) => api.getPackingReservations(signal), [reservation]],
]) test(`GET ${name} preserves exact decimals, nulls, credentials and cancellation`, async () => {
    const controller = new AbortController()
    globalThis.fetch = async (url, init) => {
        assert.equal(url, `http://localhost:3001/api/packing-orders${path}`)
        assert.equal(init.credentials, "include"); assert.equal(init.signal, controller.signal); assert.equal(init.body, undefined)
        return Response.json({ success: true, data: response })
    }
    assert.deepEqual(await invoke(controller.signal), response)
})
const create = { packingOrderNumber: order.packingOrderNumber, itemId: 4, targetQty: "500.0000", sourceLocationId: 1, destinationLocationId: 2, scheduledDate: null, notes: null }
const update = { packingOrderNumber: "PK-EDIT", destinationLocationId: 2, scheduledDate: "2026-11-01", notes: "Keep dry" }
const complete = { actualQty: "490.0000", lotNumber: "FG-GAR-01", manufactureDate: null, expirationDate: null }
for (const [name, path, method, input, invoke] of [
    ["create", "", "POST", create, () => api.createPackingOrder(create)],
    ["update", "/1", "PATCH", update, () => api.updatePackingOrder(1, update)],
    ["plan", "/1/plan", "POST", {}, () => api.runPackingAction(1, "plan")],
    ["start", "/1/start", "POST", {}, () => api.runPackingAction(1, "start")],
    ["cancel", "/1/cancel", "POST", {}, () => api.runPackingAction(1, "cancel")],
    ["complete", "/1/complete", "POST", complete, () => api.runPackingAction(1, "complete", complete)],
]) test(`${name} sends only contract fields and parses authoritative saved detail`, async () => {
    globalThis.fetch = async (url, init) => {
        assert.equal(url, `http://localhost:3001/api/packing-orders${path}`); assert.equal(init.method, method)
        assert.equal(init.credentials, "include"); assert.deepEqual(JSON.parse(init.body), input)
        assert.equal(new Headers(init.headers).get("Content-Type"), "application/json")
        return Response.json({ success: true, data: detail })
    }
    assert.deepEqual(await invoke(), detail)
})
test("preview sends product, source and exact target and preserves signed availability", async () => {
    const input = { itemId: 4, sourceLocationId: 1, targetQty: "0.0001" }
    const controller = new AbortController()
    const result = { ...preview, materials: [{ ...preview.materials[0], qtyAvailable: "-0.0001" }] }
    globalThis.fetch = async (url, init) => {
        assert.equal(url, "http://localhost:3001/api/packing-orders/preview"); assert.equal(init.method, "POST")
        assert.deepEqual(JSON.parse(init.body), input); assert.equal(init.signal, controller.signal)
        return Response.json({ success: true, data: result })
    }
    assert.deepEqual(await api.previewPacking(input, controller.signal), result)
})
test("packing form rejects missing BOM, same locations, invalid decimals, dates and oversized order number", () => {
    const values = { ...create, scheduledDate: "", notes: "" }
    assert.deepEqual(schema.validatePacking(values, options), {})
    assert.match(schema.validatePacking({ ...values, packingOrderNumber: "x".repeat(31) }, options).packingOrderNumber, /30/)
    assert.ok(schema.validatePacking(values, { ...options, items: [{ ...options.items[0], hasBom: false }] }).itemId)
    assert.ok(schema.validatePacking({ ...values, destinationLocationId: 1 }, options).destinationLocationId)
    for (const targetQty of ["0", "-1", "0.00001", "1e3", "99999999999", "NaN"]) assert.ok(schema.validatePacking({ ...values, targetQty }, options).targetQty)
    assert.ok(schema.validatePacking({ ...values, scheduledDate: "2026-02-30" }, options).scheduledDate)
    assert.deepEqual(schema.validatePacking({ ...values, targetQty: "0.0001" }, options), {})
})
test("sorting uses exact signed decimal values including large aggregated quantities", () => {
    assert.equal(schema.comparePackingDecimals("999999999999999.0001", "999999999999999.0002"), -1)
    assert.equal(schema.comparePackingDecimals("-0.0001", "0.0000"), -1)
    assert.equal(schema.formatPackingDecimal("123456789012345.0001"), "123,456,789,012,345.0001")
})
test("reservation status distinguishes active, fully consumed and released remainder", () => {
    assert.equal(schema.reservationStatus(reservation), "Active")
    assert.equal(schema.reservationStatus({ ...reservation, qtyConsumed: "50.0000", qtyOutstanding: "0.0000", releasedAt: timestamp }), "Consumed")
    assert.equal(schema.reservationStatus({ ...reservation, qtyConsumed: "40.0000", qtyOutstanding: "0.0000", releasedAt: timestamp }), "Released")
})
for (const [name, payload] of [["numeric target", [{ ...order, targetQty: 500 }]], ["unknown status", [{ ...order, status: "Sent" }]], ["missing audit", [{ ...order, createdAt: undefined }]], ["not a list", detail]]) test(`GET rejects ${name}`, async () => {
    globalThis.fetch = async () => Response.json({ success: true, data: payload })
    await assert.rejects(api.getPackingOrders(), /invalid packing orders/)
})
test("detail parser rejects invalid finished lot quality status", async () => {
    globalThis.fetch = async () => Response.json({ success: true, data: { ...detail, finishedLots: [{ lotId: 1, lotNumber: "FG-01", qcStatus: "Unknown", manufactureDate: null, expirationDate: null }] } })
    await assert.rejects(api.getPackingOrder(1), /invalid order details/)
})
for (const status of [401, 403, 409]) test(`HTTP ${status} preserves actionable backend error`, async () => {
    globalThis.fetch = async () => Response.json({ success: false, error: { message: "  Insufficient available material.  " } }, { status })
    await assert.rejects(api.runPackingAction(1, "plan"), { message: "Insufficient available material." })
})
test("malformed JSON, missing data and network failures produce readable errors", async () => {
    globalThis.fetch = async () => new Response("{", { status: 200 }); await assert.rejects(api.getPackingOrders(), /invalid JSON/)
    globalThis.fetch = async () => Response.json({ success: true }); await assert.rejects(api.getPackingOrders(), /missing data/)
    globalThis.fetch = async () => { throw new TypeError("fetch failed") }; await assert.rejects(api.getPackingOrders(), /Unable to reach/)
})
test("fetch and response cancellation retain the AbortError", async () => {
    const reason = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => { throw reason }; await assert.rejects(api.getPackingOrders(), (error) => error === reason)
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => { throw reason } }); await assert.rejects(api.getPackingOrders(), (error) => error === reason)
})
