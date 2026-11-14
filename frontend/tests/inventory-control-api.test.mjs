import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { test, afterEach } from "node:test"
registerHooks({
    resolve(specifier, context, next) {
        return next(
            specifier.startsWith("@/")
                ? new URL("../src/" + specifier.slice(2) + ".ts", import.meta.url).href
                : specifier,
            context,
        )
    },
})
process.env.NEXT_PUBLIC_API_BASE_URL = "https://controls.example.test/api"
const controls = await import("../src/hooks/modules/inventory-controls/use-inventory-controls.ts")
const settings = await import("../src/hooks/modules/company-settings/use-company-settings.ts")
const packaging = await import("../src/hooks/modules/item-packaging/use-item-packaging.ts")
const reasons = await import("../src/hooks/modules/reason-codes/use-reason-codes.ts")
const levels = await import("../src/hooks/modules/reorder-policies/use-reorder-policies.ts")
const reports = await import("../src/hooks/modules/operational-reports/use-operational-reports.ts")
const original = globalThis.fetch
afterEach(() => {
    globalThis.fetch = original
})
const header = {
    requestId: 1,
    requestNumber: "COUNT-1",
    kind: "Count",
    status: "Draft",
    notes: "Physical count",
    evidenceReference: null,
    createdBy: 2,
    submittedBy: null,
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: "2026-11-08T00:00:00Z",
    updatedAt: "2026-11-08T00:00:00Z",
}
const detail = {
    ...header,
    count: { locationId: 1, reasonId: 1 },
    disposal: null,
    qc: null,
    formula: null,
    observations: [],
    materials: [],
    events: [],
}
function response(data) {
    return Response.json({ success: true, data })
}
test("reviewed requests encode queries, validate DTOs and forward cancellation", async () => {
    const signal = new AbortController().signal
    globalThis.fetch = async (url, init) => {
        assert.equal(url, "https://controls.example.test/api/inventory-controls?kind=Count")
        assert.equal(init.credentials, "include")
        assert.equal(init.signal, signal)
        return response([header])
    }
    assert.equal((await controls.getControls("Count", signal))[0].requestId, 1)
    globalThis.fetch = async () => response([{ ...header, status: "Unknown" }])
    await assert.rejects(controls.getControls("Count"))
})
test("review actions and observations send only writable fields", async () => {
    globalThis.fetch = async (url, init) => {
        assert.equal(url, "https://controls.example.test/api/inventory-controls/1/actions")
        assert.equal(init.method, "POST")
        assert.deepEqual(JSON.parse(init.body), {
            action: "approve",
            reviewNote: "Reviewed evidence",
        })
        return response(detail)
    }
    await controls.actOnControl(1, "approve", "Reviewed evidence")
    globalThis.fetch = async (url, init) => {
        assert.equal(url, "https://controls.example.test/api/inventory-controls/1/observations")
        assert.equal(init.method, "PATCH")
        assert.deepEqual(JSON.parse(init.body), {
            observations: [{ observationId: 4, countedQty: "0.0001" }],
        })
        return response(detail)
    }
    await controls.saveObservations(1, [{ observationId: 4, countedQty: "0.0001" }])
})
test("master controls preserve nullable fields, exact ratios and update contracts", async () => {
    const pack = {
        packagingId: 1,
        itemId: 2,
        itemName: "Bag",
        sku: "BAG",
        uomId: 3,
        uomName: "box",
        primaryUomName: "pc",
        baseQty: "24.0000",
        barcode: null,
        grossWeightG: null,
        isInUse: true,
    }
    const reason = {
        reasonId: 1,
        codeName: "COUNT",
        category: "Inventory Adjustment",
        description: null,
        isActive: false,
    }
    const level = {
        itemId: 2,
        itemName: "Bag",
        sku: "BAG",
        primaryUomName: "pc",
        reorderLevel: "15.0000",
    }
    for (const [api, record, path, input, payload] of [
        [
            packaging,
            pack,
            "item-packaging",
            { itemId: 2, uomId: 3, baseQty: "24.0000", barcode: null, grossWeightG: null },
            { itemId: 2, uomId: 3, baseQty: "24.0000", barcode: null, grossWeightG: null },
        ],
        [
            reasons,
            reason,
            "reason-codes",
            {
                codeName: "COUNT",
                category: "Inventory Adjustment",
                description: null,
                isActive: false,
            },
            {
                codeName: "COUNT",
                category: "Inventory Adjustment",
                description: null,
                isActive: false,
            },
        ],
        [
            levels,
            level,
            "reorder-policies",
            { itemId: 2, reorderLevel: "15.0000" },
            { reorderLevel: "15.0000" },
        ],
    ]) {
        globalThis.fetch = async (url, init) => {
            assert.equal(
                new URL(url).pathname,
                "/api/" + path + "/" + (path === "reorder-policies" ? 2 : 1),
            )
            assert.equal(init.method, "PATCH")
            assert.deepEqual(JSON.parse(init.body), payload)
            return response(record)
        }
        await api.saveRecord(input, record)
    }
})
test("company settings use optimistic versions and retain configured currency", async () => {
    const record = {
        companyName: "KFF",
        address: null,
        email: null,
        phone: null,
        currencyCode: "PHP",
        defaultReorderLevel: "10.0000",
        expiryWarningDays: 30,
        version: 2,
    }
    globalThis.fetch = async (url, init) => {
        assert.equal(new URL(url).pathname, "/api/company-settings")
        assert.equal(JSON.parse(init.body).expectedVersion, 1)
        return response(record)
    }
    const { version, ...body } = record
    assert.equal(
        (await settings.saveSettings({ ...body, expectedVersion: version - 1 })).version,
        2,
    )
})
test("operational reports encode full history genealogy and date ranges separately", async () => {
    const signal = new AbortController().signal
    globalThis.fetch = async (url, init) => {
        const q = new URL(url).searchParams
        assert.equal(q.get("report"), "genealogy")
        assert.equal(q.get("lotId"), "8")
        assert.equal(q.has("fromDate"), false)
        assert.equal(init.signal, signal)
        return response({
            report: "genealogy",
            generatedAt: "2026-11-08T00:00:00Z",
            currencyCode: "PHP",
            sections: [
                { title: "Lots", columns: [{ key: "lot", label: "Lot" }], rows: [{ lot: "LOT8" }] },
            ],
        })
    }
    assert.equal(
        (
            await reports.getReport(
                "genealogy",
                { lotId: "8", fromDate: "2026-01-01", toDate: "" },
                signal,
            )
        ).sections[0].rows[0].lot,
        "LOT8",
    )
    globalThis.fetch = async () => response({ sections: [] })
    await assert.rejects(reports.getReport("packing", { lotId: "", fromDate: "", toDate: "" }))
})

test("reason code helpers normalize whitespace descriptions and toggle active status", async () => {
    const longDescription = "x".repeat(2000)
    globalThis.fetch = async (url, init) => {
        assert.equal(new URL(url).pathname, "/api/reason-codes")
        assert.equal(init.method, "POST")
        assert.deepEqual(JSON.parse(init.body), {
            codeName: "COUNT",
            category: "Inventory Adjustment",
            description: null,
            isActive: true,
        })
        return response({
            reasonId: 9,
            codeName: "COUNT",
            category: "Inventory Adjustment",
            description: null,
            isActive: true,
        })
    }
    await reasons.saveRecord(
        {
            codeName: " COUNT ",
            category: "Inventory Adjustment",
            description: "   ",
            isActive: true,
        },
        null,
    )

    globalThis.fetch = async (url, init) => {
        assert.equal(new URL(url).pathname, "/api/reason-codes/9")
        assert.equal(init.method, "PATCH")
        assert.deepEqual(JSON.parse(init.body), {
            codeName: "COUNT",
            category: "Inventory Adjustment",
            description: longDescription,
            isActive: true,
        })
        return response({
            reasonId: 9,
            codeName: "COUNT",
            category: "Inventory Adjustment",
            description: longDescription,
            isActive: true,
        })
    }
    await reasons.saveRecord(
        {
            codeName: "COUNT",
            category: "Inventory Adjustment",
            description: longDescription,
            isActive: true,
        },
        {
            reasonId: 9,
            codeName: "COUNT",
            category: "Inventory Adjustment",
            description: null,
            isActive: true,
        },
    )

    globalThis.fetch = async (url, init) => {
        assert.equal(new URL(url).pathname, "/api/reason-codes/9")
        assert.equal(init.method, "PATCH")
        assert.deepEqual(JSON.parse(init.body), { isActive: false })
        return response({
            reasonId: 9,
            codeName: "COUNT",
            category: "Inventory Adjustment",
            description: longDescription,
            isActive: false,
        })
    }
    const updated = await reasons.setRecordActiveStatus(9, false)
    assert.equal(updated.isActive, false)
})
