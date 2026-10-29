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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://lots.example.test/api///"
const api = await import("../src/hooks/modules/lots/use-lots.ts")
const schema = await import("../src/components/modules/lots/lot.schema.ts")
const { ApiError } = await import("../src/lib/api-request.ts")
const originalFetch = globalThis.fetch
const audits = {
    createdBy: 6,
    createdAt: "2026-10-28T00:00:00Z",
    updatedBy: null,
    updatedAt: "2026-10-28T00:00:00Z",
}
const lot = {
    lotId: 7,
    lotNumber: "LOT-001",
    supplierLotNumber: null,
    itemId: 10,
    itemSku: "RM-GARLIC",
    itemName: "Garlic Powder",
    itemType: "Raw Material - Bulk",
    primaryUomId: 2,
    primaryUomName: "g",
    manufactureDate: null,
    expirationDate: null,
    qcStatus: "Quarantine",
    unitCost: "0.1101",
    poLineId: 9,
    poId: 5,
    poNumber: "PO-001",
    supplierId: 4,
    supplierName: "Davao Spices",
    packingOrderId: null,
    packingOrderNumber: null,
    sourceType: "Purchased",
    qtyOnHand: "3000.0000",
    qtyReserved: "0.0000",
    qtyAvailable: "3000.0000",
    locationCount: 1,
    ...audits,
}
const stock = {
    stockId: 12,
    locationId: 3,
    locationCode: "WH-RM",
    locationName: "Raw Materials",
    locationType: "Warehouse",
    locationIsActive: true,
    qtyOnHand: "3000.0000",
    qtyReserved: "0.0000",
    qtyAvailable: "3000.0000",
    lastUpdated: "2026-10-28T00:00:00Z",
}
const transaction = {
    transactionId: 20,
    locationId: 3,
    locationCode: "WH-RM",
    locationName: "Raw Materials",
    qtyChange: "3000.0000",
    transactionType: "Receive",
    poLineId: 9,
    packingOrderId: null,
    transferLineId: null,
    referenceId: null,
    authorizedByUserId: 6,
    createdAt: "2026-10-28T00:00:00Z",
}
const detail = { ...lot, stocks: [stock], transactions: [transaction] }
const values = {
    supplierLotNumber: "",
    manufactureDate: "",
    expirationDate: "",
    qcStatus: "Quarantine",
}
const response = (data) => Response.json({ success: true, data })
afterEach(() => {
    globalThis.fetch = originalFetch
})

test("lot list and detail use configured paths, credentials and cancellation", async () => {
    const controller = new AbortController()
    for (const [path, data, invoke] of [
        ["/lots", [lot], () => api.getLots(controller.signal)],
        ["/lots/7", detail, () => api.getLot(7, controller.signal)],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, `https://lots.example.test/api${path}`)
            assert.equal(request.credentials, "include")
            assert.equal(request.signal, controller.signal)
            return response(data)
        }
        assert.deepEqual(await invoke(), data)
    }
})
test("lot PATCH sends only supplied metadata and consumes returned authoritative detail", async () => {
    const input = {
        supplierLotNumber: "SUP-02",
        manufactureDate: null,
        expirationDate: "2027-10-28",
        qcStatus: "Approved",
    }
    globalThis.fetch = async (url, request) => {
        assert.equal(url, "https://lots.example.test/api/lots/7")
        assert.equal(request.method, "PATCH")
        assert.equal(request.credentials, "include")
        assert.deepEqual(JSON.parse(request.body), input)
        return response({ ...detail, ...input })
    }
    assert.deepEqual(await api.updateLot(7, input), { ...detail, ...input })
})
test("purchased, packed and opening-balance lots preserve nullable provenance and dates", async () => {
    for (const sourceType of schema.LOT_SOURCE_TYPES) {
        const historical = {
            ...lot,
            sourceType,
            unitCost: null,
            poLineId: null,
            poId: null,
            poNumber: null,
            supplierId: null,
            supplierName: null,
            packingOrderId: null,
            packingOrderNumber: null,
        }
        globalThis.fetch = async () => response([historical])
        assert.deepEqual(await api.getLots(), [historical])
    }
})
test("lot aggregates and signed ledger values remain exact beyond per-row inventory limits", async () => {
    const large = {
        ...detail,
        qtyOnHand: "9007199254740992.0001",
        qtyReserved: "9007199254740993.0000",
        qtyAvailable: "-0.9999",
        stocks: [
            {
                ...stock,
                qtyReserved: "9007199254740993.0000",
                qtyAvailable: "-9007199254737993.0000",
            },
        ],
        transactions: [{ ...transaction, transactionType: "Consume", qtyChange: "-0.0001" }],
    }
    globalThis.fetch = async () => response(large)
    assert.deepEqual(await api.getLot(7), large)
})
test("lot DTOs reject malformed types, enums, calendar dates and private extras", async () => {
    for (const patch of [
        { lotId: 0 },
        { qcStatus: "Pending" },
        { unitCost: 0.1101 },
        { qtyOnHand: 3000 },
        { qtyReserved: "1.00001" },
        { qtyAvailable: "NaN" },
        { sourceType: "Unknown" },
        { manufactureDate: "2026-02-30" },
        { createdAt: "bad" },
        { locationCount: -1 },
    ]) {
        globalThis.fetch = async () => response([{ ...lot, ...patch }])
        await assert.rejects(api.getLots(), /invalid lot records/)
    }
    globalThis.fetch = async () =>
        response({
            ...detail,
            internalToken: "private",
            stocks: [{ ...stock, privateNote: "private" }],
        })
    assert.deepEqual(await api.getLot(7), detail)
    globalThis.fetch = async () =>
        response({ ...detail, transactions: [{ ...transaction, authorizedByUserId: null }] })
    await assert.rejects(api.getLot(7), /invalid lot detail/)
    globalThis.fetch = async () =>
        response({ ...detail, transactions: [{ ...transaction, transactionType: "Delete" }] })
    await assert.rejects(api.getLot(7), /invalid lot detail/)
})
test("lot API failures preserve safe status/messages and original abort reasons", async () => {
    for (const status of [400, 401, 403, 404, 409, 503]) {
        globalThis.fetch = async () =>
            Response.json(
                {
                    success: false,
                    error: { message: "Release reservations before changing lot status." },
                },
                { status },
            )
        await assert.rejects(
            api.updateLot(7, { qcStatus: "Approved" }),
            (error) =>
                error instanceof ApiError &&
                error.status === status &&
                /reservations/.test(error.message),
        )
    }
    globalThis.fetch = async () => {
        throw new TypeError("fetch failed")
    }
    await assert.rejects(api.getLots(), /Unable to reach/)
    globalThis.fetch = async () => new Response("broken-json")
    await assert.rejects(api.getLot(7), /invalid JSON/)
    const cancelled = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => {
        throw cancelled
    }
    await assert.rejects(api.getLots(), (error) => error === cancelled)
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw cancelled
        },
    })
    await assert.rejects(api.getLot(7), (error) => error === cancelled)
    const controller = new AbortController(),
        reason = new Error("Navigation cancelled")
    controller.abort(reason)
    globalThis.fetch = async (_url, request) => {
        throw request.signal.reason
    }
    await assert.rejects(api.getLot(7, controller.signal), (error) => error === reason)
})
test("metadata form helpers normalize nullable blanks and emit only actual changes", () => {
    assert.deepEqual(schema.toLotInput(values, lot), {})
    assert.deepEqual(schema.toLotInput({ ...values, supplierLotNumber: " SUP-02 " }, lot), {
        supplierLotNumber: "SUP-02",
    })
    assert.deepEqual(schema.toLotInput({ ...values, manufactureDate: "2026-10-28" }, lot), {
        manufactureDate: "2026-10-28",
    })
    assert.deepEqual(
        schema.toLotInput(
            { ...values, qtyOnHand: "9999", lotNumber: "CHANGED", unitCost: "9", poId: 99 },
            lot,
        ),
        {},
    )
    for (const field of [
        "qtyOnHand",
        "qtyReserved",
        "unitCost",
        "lotNumber",
        "poLineId",
        "itemId",
        "createdBy",
    ]) {
        assert.equal(schema.lotUpdateSchema.safeParse({ [field]: "1" }).success, false)
    }
})
test("optional lot dates and QC validation enforce actual calendar dates and strict expiry ordering", () => {
    assert.deepEqual(schema.validateLot(values, lot), {})
    assert.deepEqual(schema.validateLot({ ...values, expirationDate: "2027-10-28" }, lot), {})
    for (const qcStatus of schema.QC_STATUSES)
        assert.deepEqual(schema.validateLot({ ...values, qcStatus }, lot), {})
    assert.ok(schema.validateLot({ ...values, qcStatus: "Pending" }, lot).qcStatus)
    assert.ok(
        schema.validateLot({ ...values, supplierLotNumber: "X".repeat(101) }, lot)
            .supplierLotNumber,
    )
    assert.ok(schema.validateLot({ ...values, manufactureDate: "2026-02-30" }, lot).manufactureDate)
    for (const expirationDate of ["2026-10-28", "2026-10-27"]) {
        assert.ok(
            schema.validateLot({ ...values, manufactureDate: "2026-10-28", expirationDate }, lot)
                .expirationDate,
        )
        assert.throws(() =>
            schema.toLotInput({ ...values, manufactureDate: "2026-10-28", expirationDate }, lot),
        )
    }
})
test("reservation locks apply only to actual date or QC changes and permit supplier reference correction", () => {
    const reserved = { ...lot, qtyReserved: "0.0001", qtyAvailable: "2999.9999" }
    assert.equal(schema.lotHasReservations(reserved), true)
    assert.equal(schema.lotHasReservations(lot), false)
    assert.deepEqual(schema.validateLot({ ...values, supplierLotNumber: "SUP-02" }, reserved), {})
    assert.deepEqual(schema.toLotInput({ ...values, supplierLotNumber: "SUP-02" }, reserved), {
        supplierLotNumber: "SUP-02",
    })
    assert.ok(
        schema.validateLot({ ...values, manufactureDate: "2026-10-28" }, reserved).manufactureDate,
    )
    assert.ok(
        schema.validateLot({ ...values, expirationDate: "2027-10-28" }, reserved).expirationDate,
    )
    assert.ok(schema.validateLot({ ...values, qcStatus: "Approved" }, reserved).qcStatus)
    assert.deepEqual(schema.validateLot(values, reserved), {})
})
test("lot sorting, formatting and grouped sums retain signed decimal precision", () => {
    assert.equal(
        schema.sumLotQuantities(["9007199254740992.0001", "0.0001"]),
        "9007199254740992.0002",
    )
    assert.equal(schema.sumLotQuantities(["-1.0000", "0.0001"]), "-0.9999")
    assert.equal(schema.sumLotQuantities([]), "0.0000")
    assert.equal(schema.sumLotQuantities(["bad"]), null)
    assert.equal(schema.compareLotDecimals("9007199254740992.0001", "9007199254740992.0002"), -1)
    assert.equal(schema.compareLotDecimals("-0.0001", "0"), -1)
    assert.equal(schema.formatLotDecimal("-9007199254740992.0001"), "-9,007,199,254,740,992.0001")
    assert.equal(schema.formatLotDecimal("1.0000"), "1")
    for (const invalid of ["", "NaN", "1e3", "1.00001", null, 1])
        assert.equal(schema.formatLotDecimal(invalid), "—")
})
