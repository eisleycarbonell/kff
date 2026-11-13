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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://reports.example.test/api"
const api = await import("../src/hooks/modules/inventory-reports/use-inventory-reports.ts")
const schema =
    await import("../src/components/modules/inventory-reports/inventory-report.schema.ts")
const { buildInventoryReport } =
    await import("../../backend/src/modules/inventory-reports/inventory-report.rules.ts")
const { inventoryReportQuerySchema } =
    await import("../../backend/src/modules/inventory-reports/inventory-report.schema.ts")
const originalFetch = globalThis.fetch
afterEach(() => {
    globalThis.fetch = originalFetch
})
const report = (query = {}) =>
    JSON.parse(
        JSON.stringify(
            buildInventoryReport(
                inventoryReportQuerySchema.parse(query),
                [],
                [],
                [],
                new Date("2026-11-07T00:00:00Z"),
            ),
        ),
    )
test("report reads encode exact filters, send credentials, forward cancellation and validate every report type", async () => {
    const signal = new AbortController().signal
    for (const type of schema.REPORT_TYPES) {
        globalThis.fetch = async (url, options) => {
            const parsed = new URL(url)
            assert.equal(parsed.pathname, "/api/reports/inventory")
            assert.equal(parsed.searchParams.get("report"), type)
            assert.equal(parsed.searchParams.get("q"), "Garlic & Pepper")
            assert.equal(parsed.searchParams.get("threshold"), "0.0001")
            assert.equal(parsed.searchParams.get("includeExpired"), "false")
            assert.equal(options.credentials, "include")
            assert.equal(options.signal, signal)
            return Response.json({
                success: true,
                data: report({
                    report: type,
                    q: "Garlic & Pepper",
                    threshold: "0.0001",
                    includeExpired: "false",
                }),
            })
        }
        assert.equal(
            (
                await api.getInventoryReport(
                    {
                        report: type,
                        q: "Garlic & Pepper",
                        threshold: "0.0001",
                        includeExpired: false,
                    },
                    signal,
                )
            ).report,
            type,
        )
    }
})
test("filter options validate IDs and forward abort signals", async () => {
    const signal = new AbortController().signal
    const options = {
        items: [{ itemId: 1, sku: "RM", name: "Material" }],
        locations: [{ locationId: 2, code: "WH", name: "Warehouse" }],
        brands: [],
    }
    globalThis.fetch = async (url, init) => {
        assert.equal(url, "https://reports.example.test/api/reports/inventory/options")
        assert.equal(init.signal, signal)
        assert.equal(init.credentials, "include")
        return Response.json({ success: true, data: options })
    }
    assert.deepEqual(await api.getInventoryReportOptions(signal), options)
    globalThis.fetch = async () =>
        Response.json({ success: true, data: { ...options, items: [{ itemId: "1" }] } })
    await assert.rejects(api.getInventoryReportOptions(), /invalid filter options/)
})
test("wrong reports, malformed quantities, unsafe HTTP failures and cancellation never become cached report data", async () => {
    globalThis.fetch = async () =>
        Response.json({ success: true, data: report({ report: "movement" }) })
    await assert.rejects(
        api.getInventoryReport({ report: "low-stock" }),
        /invalid inventory report/,
    )
    const invalid = report()
    invalid.totals = [{ primaryUomId: 1, primaryUomName: "kg", qtyOnHand: 1 }]
    globalThis.fetch = async () => Response.json({ success: true, data: invalid })
    await assert.rejects(
        api.getInventoryReport({ report: "stock-by-location" }),
        /invalid inventory report/,
    )
    globalThis.fetch = async () =>
        Response.json({ success: false, error: { message: "Sign in required" } }, { status: 401 })
    await assert.rejects(
        api.getInventoryReport({ report: "movement" }),
        (error) => error.status === 401 && error.message === "Sign in required",
    )
    const abort = new DOMException("Aborted", "AbortError")
    globalThis.fetch = async () => {
        throw abort
    }
    await assert.rejects(api.getInventoryReport({ report: "movement" }), (error) => error === abort)
})
test("large decimal totals and export retain exact strings and full report/filter context", () => {
    assert.equal(schema.decimalUnits("1000000000000.0001"), BigInt("10000000000000001"))
    const row = {
        rowId: "item:1",
        itemId: 1,
        sku: "ZERO",
        itemName: "Zero stock",
        itemType: "Raw Material - Bulk",
        brandId: null,
        brandName: null,
        primaryUomId: 1,
        primaryUomName: "kg",
        isActive: true,
        locationId: null,
        locationCode: null,
        locationName: null,
        locationType: null,
        lotId: null,
        lotNumber: null,
        lotCount: 0,
        qcStatus: null,
        expirationDate: null,
        daysToExpiry: null,
        qtyOnHand: "0.0000",
        qtyReserved: "0.0000",
        qtyAvailable: "0.0000",
        transactionId: null,
        transactionType: null,
        qtyChange: null,
        occurredAt: null,
        sourceReference: null,
        referenceId: null,
        actorName: null,
        reasonCode: null,
    }
    const data = report({ report: "low-stock", threshold: "0" })
    data.rows = [row, { ...row, itemId: 2, rowId: "item:2" }]
    data.summary = { rowCount: 2, itemCount: 2, lotCount: 0, locationCount: 0 }
    schema.reportSchema.parse(data)
    const csv = schema.reportCsv(data, [row])
    assert.deepEqual(csv[0], ["Report", "Low Stock"])
    assert.match(csv[2][1], /threshold=0/)
    assert.equal(csv.length, 6)
    assert.equal(csv[5][0], "ZERO")
    assert.equal(csv[5][14], "0.0000")
    assert.doesNotMatch(
        schema.reportQuery({ report: "movement", itemId: undefined, q: "" }),
        /undefined|q=/,
    )
})
