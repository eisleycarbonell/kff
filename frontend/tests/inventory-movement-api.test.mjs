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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://movements.example.test/api///"
const api = await import("../src/hooks/modules/inventory-movements/use-inventory-movements.ts")
const { movementQuantityUnits, movementSource } =
    await import("../src/components/modules/inventory-movements/inventory-movement.schema.ts")
const originalFetch = globalThis.fetch
const movement = {
    transactionId: 41,
    transactionType: "Adjustment",
    qtyChange: "-0.0001",
    createdAt: "2026-11-03T04:00:00Z",
    itemId: 3,
    itemSku: "RM-GARLIC",
    itemName: "Garlic powder",
    primaryUomName: "kg",
    lotId: 11,
    lotNumber: "LOT-11",
    locationId: 4,
    locationCode: "WH-RM",
    locationName: "Raw warehouse",
    reasonCode: "Physical count",
    referenceId: "COUNT-1",
    poLineId: null,
    poNumber: null,
    packingOrderId: null,
    packingOrderNumber: null,
    transferLineId: null,
    transferNumber: null,
    authorizedByUserId: 7,
    actorFirstName: "Inventory",
    actorLastName: "Viewer",
}
const response = (data) => new Response(JSON.stringify({ success: true, data }), { status: 200 })
afterEach(() => {
    globalThis.fetch = originalFetch
})

test("movement list uses authenticated API and preserves signed exact quantities", async () => {
    const controller = new AbortController()
    globalThis.fetch = async (url, request) => {
        assert.equal(url, "https://movements.example.test/api/inventory/movements")
        assert.equal(request.credentials, "include")
        assert.equal(request.signal, controller.signal)
        return response([movement])
    }
    assert.deepEqual(await api.getInventoryMovements(undefined, controller.signal), [movement])
    assert.equal(movementQuantityUnits("-0.0001"), BigInt(-1))
    assert.equal(movementSource(movement), "COUNT-1")
})

test("adjustment history requests only adjustment entries and rejects malformed responses", async () => {
    globalThis.fetch = async (url) => {
        assert.equal(
            url,
            "https://movements.example.test/api/inventory/movements?transactionType=Adjustment",
        )
        return response([movement])
    }
    assert.deepEqual(await api.getInventoryMovements("Adjustment"), [movement])
    globalThis.fetch = async () => response([{ ...movement, qtyChange: 1 }])
    await assert.rejects(api.getInventoryMovements(), /invalid stock movements/)
    globalThis.fetch = async () => response([{ ...movement, transactionType: "Adjust" }])
    await assert.rejects(api.getInventoryMovements(), /invalid stock movements/)
})

test("completed customer deliveries appear as Sale movements with their delivery reference", async () => {
    const sale = {
        ...movement,
        transactionType: "Sale",
        qtyChange: "-5.0000",
        referenceId: "DO-1",
        reasonCode: null,
    }
    globalThis.fetch = async (url) => {
        assert.equal(
            url,
            "https://movements.example.test/api/inventory/movements?transactionType=Sale",
        )
        return response([sale])
    }
    assert.deepEqual(await api.getInventoryMovements("Sale"), [sale])
    assert.equal(movementSource(sale), "DO-1")
})
