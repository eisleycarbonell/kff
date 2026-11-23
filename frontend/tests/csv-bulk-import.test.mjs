import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { registerHooks } from "node:module"
import { afterEach, test } from "node:test"

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith("@/")) {
            const base = new URL(`../src/${specifier.slice(2)}`, import.meta.url)
            for (const ext of [".ts", ".tsx", "/index.ts"]) {
                const candidate = new URL(base.href + ext)
                if (existsSync(candidate)) return nextResolve(candidate.href, context)
            }
        }
        return nextResolve(specifier, context)
    },
})

process.env.NEXT_PUBLIC_API_BASE_URL = "https://bulk-import.example.test/api"

const csvImport = await import("../src/lib/csv-import.ts")
const { MODULE_BULK_IMPORTS } = await import("../src/lib/module-bulk-imports.ts")

const originalFetch = globalThis.fetch
afterEach(() => {
    globalThis.fetch = originalFetch
})

test("parseCsvRecords handles UTF-8 BOM, quoted commas, newlines, escaped quotes, and header normalization", () => {
    const csv = [
        '\uFEFF"Item SKU","Item Type",unit_cost,Notes',
        '"SP-001","Raw Material - Bulk","125.50","Line one, ""quoted""\nLine two"',
        " , , , ",
        '"SP-002","Finished Good","210.00","Single line"',
    ].join("\r\n")

    const parsed = csvImport.parseCsvRecords(csv)
    assert.deepEqual(parsed.headers, ["Item SKU", "Item Type", "unit_cost", "Notes"])
    assert.equal(parsed.rows.length, 2)
    assert.equal(csvImport.getCsvValue(parsed.rows[0], "itemSku"), "SP-001")
    assert.equal(csvImport.getCsvValue(parsed.rows[0], "itemType"), "Raw Material - Bulk")
    assert.equal(csvImport.getCsvValue(parsed.rows[0], "unitCost"), "125.50")
    assert.equal(
        csvImport.getCsvValue(parsed.rows[0], "notes"),
        'Line one, "quoted"\nLine two',
    )
    assert.equal(csvImport.requiredCsvString(parsed.rows[1], "itemSku"), "SP-002")
    assert.equal(csvImport.optionalCsvString(parsed.rows[1], "missing"), null)
})

test("parseCsvBoolean supports standard true/false/yes/no/active/inactive strings", () => {
    assert.equal(csvImport.parseCsvBoolean("yes"), true)
    assert.equal(csvImport.parseCsvBoolean("ACTIVE"), true)
    assert.equal(csvImport.parseCsvBoolean("1"), true)
    assert.equal(csvImport.parseCsvBoolean("no"), false)
    assert.equal(csvImport.parseCsvBoolean("inactive"), false)
    assert.equal(csvImport.parseCsvBoolean("0"), false)
    assert.equal(csvImport.parseCsvBoolean("", false), false)
    assert.throws(() => csvImport.parseCsvBoolean("maybe"), /Invalid boolean/)
})

test("every writable module bulk import config defines consistent columns and valid sample CSV rows", () => {
    const expectedModules = [
        "items",
        "item-packaging",
        "reorder-policies",
        "reason-codes",
        "suppliers",
        "customers",
        "locations",
        "uoms",
        "users",
        "roles",
        "company-settings",
        "lots",
        "inventory-adjustments",
        "scrap",
        "packing-formulas",
        "purchase-orders",
        "receiving",
        "packing-orders",
        "transfers",
        "sales-orders",
        "delivery-orders",
    ]
    assert.deepEqual(Object.keys(MODULE_BULK_IMPORTS).sort(), [...expectedModules].sort())

    for (const [key, config] of Object.entries(MODULE_BULK_IMPORTS)) {
        assert.equal(config.key, key)
        assert.ok(config.templateFilename.endsWith(".csv"), `${key} template must end with .csv`)
        assert.ok(config.columns.length > 0, `${key} must define columns`)
        assert.ok(config.sampleRows.length > 0, `${key} must provide sample rows`)
        assert.ok(config.queryKeys.length > 0, `${key} must list query keys to invalidate`)

        for (const sample of config.sampleRows) {
            assert.equal(
                sample.length,
                config.columns.length,
                `${key} sample row column count must match columns`,
            )
        }

        const headerRow = config.columns.map((c) => c.key)
        const serialized = [headerRow, ...config.sampleRows]
            .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
            .join("\r\n")
        const parsed = csvImport.parseCsvRecords(serialized)
        assert.equal(parsed.rows.length, config.sampleRows.length, `${key} sample round-trip failed`)

        for (const col of config.columns) {
            if (col.required) {
                assert.ok(
                    csvImport.getCsvValue(parsed.rows[0], col.key),
                    `${key} sample row missing required column ${col.key}`,
                )
            }
        }
    }
})

test("bulk import creates new records and updates existing records matched by natural key", async () => {
    const calls = []
    globalThis.fetch = async (url, init = {}) => {
        const target = String(url)
        const method = (init.method ?? "GET").toUpperCase()
        calls.push({ target, method, body: init.body ? JSON.parse(String(init.body)) : undefined })

        if (target.endsWith("/customers") && method === "GET") {
            return new Response(
                JSON.stringify({
                    success: true,
                    data: [
                        {
                            customerId: 5,
                            name: "Existing Customer",
                            contactName: "Old Contact",
                            email: "old@example.test",
                            phone: null,
                            address: null,
                            notes: null,
                            isActive: true,
                            createdBy: 1,
                            createdAt: "2026-01-01T00:00:00Z",
                            updatedBy: 1,
                            updatedAt: "2026-01-01T00:00:00Z",
                        },
                    ],
                }),
                { status: 200, headers: { "content-type": "application/json" } },
            )
        }
        if (target.endsWith("/customers/5") && method === "PATCH") {
            const payload = JSON.parse(String(init.body))
            return new Response(
                JSON.stringify({
                    success: true,
                    data: {
                        customerId: 5,
                        name: payload.name ?? "Existing Customer",
                        contactName: payload.contactName ?? null,
                        email: payload.email ?? null,
                        phone: payload.phone ?? null,
                        address: payload.address ?? null,
                        notes: payload.notes ?? null,
                        isActive: payload.isActive ?? true,
                        createdBy: 1,
                        createdAt: "2026-01-01T00:00:00Z",
                        updatedBy: 1,
                        updatedAt: "2026-01-02T00:00:00Z",
                    },
                }),
                { status: 200, headers: { "content-type": "application/json" } },
            )
        }
        if (target.endsWith("/customers") && method === "POST") {
            const payload = JSON.parse(String(init.body))
            return new Response(
                JSON.stringify({
                    success: true,
                    data: {
                        customerId: 6,
                        name: payload.name,
                        contactName: payload.contactName ?? null,
                        email: payload.email ?? null,
                        phone: payload.phone ?? null,
                        address: payload.address ?? null,
                        notes: payload.notes ?? null,
                        isActive: payload.isActive ?? true,
                        createdBy: 1,
                        createdAt: "2026-01-02T00:00:00Z",
                        updatedBy: 1,
                        updatedAt: "2026-01-02T00:00:00Z",
                    },
                }),
                { status: 201, headers: { "content-type": "application/json" } },
            )
        }
        throw new Error(`Unexpected fetch: ${method} ${target}`)
    }

    const result = await MODULE_BULK_IMPORTS.customers.runImport([
        { name: "Existing Customer", contactName: "Updated Contact", email: "new@example.test" },
        { name: "Brand New Store", contactName: "Ana", email: "ana@example.test", isActive: "true" },
        { name: "", contactName: "Invalid Empty Name" },
    ])

    assert.equal(result.updated, 1)
    assert.equal(result.created, 1)
    assert.equal(result.errors.length, 1)
    assert.equal(result.errors[0].row, 4)

    const patchCall = calls.find((c) => c.method === "PATCH")
    assert.ok(patchCall)
    assert.equal(patchCall.body.contactName, "Updated Contact")

    const postCall = calls.find((c) => c.method === "POST")
    assert.ok(postCall)
    assert.equal(postCall.body.name, "Brand New Store")
})
