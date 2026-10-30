import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { afterEach, test } from "node:test"

registerHooks({
    resolve(specifier, context, nextResolve) {
        return nextResolve(
            specifier.startsWith("@/")
                ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url)
                      .href
                : specifier,
            context,
        )
    },
})
const api = await import("../src/hooks/modules/transfers/use-transfers.ts")
const schema =
    await import("../src/components/modules/transfers/transfer.schema.ts")
const originalFetch = globalThis.fetch
afterEach(() => {
    globalThis.fetch = originalFetch
})

const timestamp = "2026-10-30T00:00:00.000Z"
const transfer = {
    transferId: 1,
    transferNumber: "TR-2026-0001",
    sourceLocationId: 1,
    sourceLocationCode: "WH-FG",
    sourceLocationName: "Finished goods warehouse",
    destinationLocationId: 2,
    destinationLocationCode: "BR-MNL",
    destinationLocationName: "Manila branch",
    status: "Draft",
    requestedAt: timestamp,
    dispatchedAt: null,
    receivedAt: null,
    notes: null,
    createdBy: null,
    createdAt: timestamp,
    updatedBy: null,
    updatedAt: timestamp,
    lineCount: 1,
    transitLocationId: null,
}
const line = {
    transferLineId: 4,
    itemId: 3,
    itemSku: "FG-GARLIC",
    itemName: "Garlic powder 100g",
    lotId: 5,
    lotNumber: "FG-GARLIC-01",
    packingOrderId: 6,
    primaryUomId: 7,
    primaryUomName: "pc",
    qtyRequested: "200.0001",
    qtyShipped: "0.0000",
    qtyReceived: "0.0000",
    qtyOutstanding: "0.0000",
    expirationDate: null,
    qcStatus: "Approved",
}
const detail = { ...transfer, lines: [line] }
const options = {
    locations: [
        {
            locationId: 1,
            code: "WH-FG",
            name: "Finished goods warehouse",
            locationType: "Warehouse",
        },
        {
            locationId: 2,
            code: "BR-MNL",
            name: "Manila branch",
            locationType: "Branch",
        },
        {
            locationId: 8,
            code: "STORE",
            name: "Retail store",
            locationType: "Store",
        },
        {
            locationId: 9,
            code: "TRANSIT",
            name: "Goods in transit",
            locationType: "In Transit",
        },
    ],
    stock: [
        {
            itemId: 3,
            itemSku: "FG-GARLIC",
            itemName: "Garlic powder 100g",
            lotId: 5,
            lotNumber: "FG-GARLIC-01",
            packingOrderId: 6,
            locationId: 1,
            primaryUomId: 7,
            primaryUomName: "pc",
            qtyOnHand: "300.0001",
            qtyReserved: "100.0000",
            qtyAvailable: "200.0001",
            expirationDate: null,
            qcStatus: "Approved",
        },
    ],
}
const draft = {
    transferNumber: "TR-2026-0001",
    sourceLocationId: 1,
    destinationLocationId: 2,
    notes: null,
    lines: [{ itemId: 3, lotId: 5, qtyRequested: "200.0001" }],
}
const dispatch = {
    transitLocationId: 9,
    lines: [{ transferLineId: 4, qtyShipped: "150.0001" }],
}
const receipt = { lines: [{ transferLineId: 4, qtyReceived: "50.0001" }] }
const shippedDetail = {
    ...detail,
    status: "In Transit",
    transitLocationId: 9,
    dispatchedAt: timestamp,
    lines: [
        {
            ...line,
            qtyShipped: "150.0001",
            qtyReceived: "50.0001",
            qtyOutstanding: "100.0000",
        },
    ],
}

test("transfer form validates active warehouse source, distinct destination and eligible source lots", () => {
    const values = { ...draft, notes: "" }
    assert.deepEqual(schema.validateTransfer(values, options), {})
    assert.ok(
        schema.validateTransfer({ ...values, sourceLocationId: null }, options)
            .sourceLocationId,
    )
    assert.ok(
        schema.validateTransfer({ ...values, sourceLocationId: 2 }, options)
            .sourceLocationId,
    )
    assert.ok(
        schema.validateTransfer(
            { ...values, destinationLocationId: null },
            options,
        ).destinationLocationId,
    )
    assert.ok(
        schema.validateTransfer(
            { ...values, destinationLocationId: 1 },
            options,
        ).destinationLocationId,
    )
    assert.ok(
        schema.validateTransfer(
            { ...values, destinationLocationId: 9 },
            options,
        ).destinationLocationId,
    )
    assert.ok(
        Object.keys(
            schema.validateTransfer(
                {
                    ...values,
                    lines: [{ itemId: 3, lotId: 999, qtyRequested: "1" }],
                },
                options,
            ),
        ).length,
    )
    assert.ok(
        Object.keys(
            schema.validateTransfer(
                {
                    ...values,
                    lines: [{ itemId: 999, lotId: 5, qtyRequested: "1" }],
                },
                options,
            ),
        ).length,
    )
    assert.ok(
        Object.keys(
            schema.validateTransfer(values, {
                ...options,
                stock: [{ ...options.stock[0], locationId: 2 }],
            }),
        ).length,
    )
})

test("transfer form rejects missing or duplicate lots and malformed metadata", () => {
    const values = { ...draft, notes: "" }
    assert.ok(
        schema.validateTransfer({ ...values, transferNumber: " " }, options)
            .transferNumber,
    )
    assert.ok(
        schema.validateTransfer(
            { ...values, transferNumber: "X".repeat(31) },
            options,
        ).transferNumber,
    )
    assert.ok(
        schema.validateTransfer({ ...values, notes: "X".repeat(5001) }, options)
            .notes,
    )
    assert.ok(
        Object.keys(schema.validateTransfer({ ...values, lines: [] }, options))
            .length,
    )
    assert.ok(
        Object.keys(
            schema.validateTransfer(
                { ...values, lines: [values.lines[0], values.lines[0]] },
                options,
            ),
        ).length,
    )
})

test("draft edits can retain an original same-source lot when current availability options omit it", () => {
    const values = { ...draft, notes: "" }
    const unavailable = { ...options, stock: [] }
    assert.deepEqual(schema.validateTransfer(values, unavailable, detail), {})
    assert.ok(schema.validateTransfer(values, unavailable).lines)
    for (const changedLine of [
        { ...values.lines[0], lotId: 999 },
        { ...values.lines[0], itemId: 999 },
    ])
        assert.ok(
            schema.validateTransfer(
                { ...values, lines: [changedLine] },
                unavailable,
                detail,
            ).lines,
        )
    const otherWarehouse = {
        ...unavailable,
        locations: [
            ...unavailable.locations,
            {
                locationId: 10,
                code: "WH-OTHER",
                name: "Other warehouse",
                locationType: "Warehouse",
            },
        ],
    }
    assert.ok(
        schema.validateTransfer(
            { ...values, sourceLocationId: 10 },
            otherWarehouse,
            detail,
        ).lines,
    )
    // A draft records a request; dispatch checks current available stock atomically.
    assert.deepEqual(
        schema.validateTransfer(
            { ...values, lines: [{ ...values.lines[0], qtyRequested: "201" }] },
            options,
        ),
        {},
    )
})

test("transfer form preserves four-place decimal precision and does not use floating point quantities", () => {
    const values = { ...draft, notes: "" }
    for (const qtyRequested of [
        "0",
        "0.0000",
        "-1",
        "0.00001",
        "1e3",
        "10000000000",
        "NaN",
    ])
        assert.ok(
            Object.keys(
                schema.validateTransfer(
                    {
                        ...values,
                        lines: [{ ...values.lines[0], qtyRequested }],
                    },
                    options,
                ),
            ).length,
        )
    assert.deepEqual(
        schema.validateTransfer(
            {
                ...values,
                lines: [{ ...values.lines[0], qtyRequested: "0.0001" }],
            },
            options,
        ),
        {},
    )
    assert.equal(schema.decimalUnits("0.0001"), 1n)
    assert.equal(schema.decimalUnits("9999999999.9999"), 99_999_999_999_999n)
    for (const value of ["1e3", "1.00001", "-1", "10000000000"])
        assert.equal(schema.decimalUnits(value), null)
})

test("transfer quantity sorting and display preserve differences beyond JavaScript safe integers", () => {
    assert.equal(
        schema.compareTransferDecimals(
            "999999999999999.0001",
            "999999999999999.0002",
        ),
        -1,
    )
    assert.equal(schema.compareTransferDecimals("-0.0001", "0.0000"), -1)
    assert.equal(schema.compareTransferDecimals("1.0000", "1"), 0)
    assert.equal(
        schema.formatTransferDecimal("123456789012345.0001"),
        "123,456,789,012,345.0001",
    )
    assert.equal(schema.formatTransferDecimal("200.0000"), "200")
})

for (const [name, path, invoke, response] of [
    ["list", "", (signal) => api.getTransfers(signal), [transfer]],
    ["detail", "/1", (signal) => api.getTransfer(1, signal), detail],
    [
        "options",
        "/options",
        (signal) => api.getTransferOptions(signal),
        options,
    ],
])
    test(`transfer GET ${name} preserves exact quantities, nullability, credentials and cancellation`, async () => {
        const controller = new AbortController()
        globalThis.fetch = async (url, init) => {
            assert.equal(url, `http://localhost:3001/api/transfers${path}`)
            assert.equal(init.method ?? "GET", "GET")
            assert.equal(init.credentials, "include")
            assert.equal(init.signal, controller.signal)
            assert.equal(init.body, undefined)
            assert.equal(
                new Headers(init.headers).get("Accept"),
                "application/json",
            )
            return Response.json({ success: true, data: response })
        }
        assert.deepEqual(await invoke(controller.signal), response)
    })

for (const [name, path, method, input, invoke, response] of [
    ["create", "", "POST", draft, () => api.createTransfer(draft), detail],
    [
        "update",
        "/1",
        "PATCH",
        { notes: null },
        () => api.updateTransfer(1, { notes: null }),
        detail,
    ],
    [
        "dispatch",
        "/1/dispatch",
        "POST",
        dispatch,
        () => api.runTransferAction(1, "dispatch", dispatch),
        shippedDetail,
    ],
    [
        "receive",
        "/1/receive",
        "POST",
        receipt,
        () => api.runTransferAction(1, "receive", receipt),
        shippedDetail,
    ],
    [
        "cancel",
        "/1/cancel",
        "POST",
        {},
        () => api.runTransferAction(1, "cancel"),
        { ...detail, status: "Cancelled" },
    ],
])
    test(`transfer ${name} sends its writable contract and parses the server-confirmed detail`, async () => {
        globalThis.fetch = async (url, init) => {
            assert.equal(url, `http://localhost:3001/api/transfers${path}`)
            assert.equal(init.method, method)
            assert.equal(init.credentials, "include")
            assert.deepEqual(JSON.parse(init.body), input)
            assert.equal(
                new Headers(init.headers).get("Content-Type"),
                "application/json",
            )
            for (const field of [
                "createdBy",
                "updatedBy",
                "authorizedByUserId",
                "status",
                "qtyOnHand",
                "requestedAt",
            ])
                assert.equal(Object.hasOwn(JSON.parse(init.body), field), false)
            return Response.json({ success: true, data: response })
        }
        assert.deepEqual(await invoke(), response)
    })

test("transfer detail preserves historical nullable provenance and optional lot dates", async () => {
    const historical = {
        ...shippedDetail,
        lines: [
            {
                ...shippedDetail.lines[0],
                packingOrderId: null,
                expirationDate: null,
            },
        ],
    }
    globalThis.fetch = async () =>
        Response.json({ success: true, data: historical })
    assert.deepEqual(await api.getTransfer(1), historical)
})

test("partial receipt payload contains this confirmation's increment and does not supply a transit location", async () => {
    globalThis.fetch = async (_url, init) => {
        assert.deepEqual(JSON.parse(init.body), {
            lines: [{ transferLineId: 4, qtyReceived: "0.0001" }],
        })
        return Response.json({ success: true, data: shippedDetail })
    }
    await api.runTransferAction(1, "receive", {
        lines: [{ transferLineId: 4, qtyReceived: "0.0001" }],
    })
})

for (const [name, payload] of [
    ["unknown status", [{ ...transfer, status: "Sent" }]],
    ["missing audit", [{ ...transfer, createdAt: undefined }]],
    ["numeric identifier", [{ ...transfer, transferId: "1" }]],
    ["invalid timestamp", [{ ...transfer, requestedAt: "2026-10-30" }]],
    ["not a list", detail],
])
    test(`transfer list rejects ${name} before caching`, async () => {
        globalThis.fetch = async () =>
            Response.json({ success: true, data: payload })
        await assert.rejects(api.getTransfers(), /invalid/i)
    })

for (const [name, change] of [
    ["numeric quantity", { qtyRequested: 200 }],
    ["lossy quantity", { qtyShipped: "1e3" }],
    ["negative quantity", { qtyReceived: "-1.0000" }],
    ["invalid QC status", { qcStatus: "Unknown" }],
    ["impossible date", { expirationDate: "2026-02-30" }],
])
    test(`transfer detail rejects ${name}`, async () => {
        globalThis.fetch = async () =>
            Response.json({
                success: true,
                data: { ...detail, lines: [{ ...line, ...change }] },
            })
        await assert.rejects(api.getTransfer(1), /invalid/i)
    })

test("transfer options reject malformed availability while preserving separate on-hand and reserved quantities", async () => {
    globalThis.fetch = async () =>
        Response.json({
            success: true,
            data: {
                ...options,
                stock: [{ ...options.stock[0], qtyAvailable: 200 }],
            },
        })
    await assert.rejects(api.getTransferOptions(), /invalid/i)
})

for (const status of [401, 403, 409, 503])
    test(`transfer HTTP ${status} preserves an actionable backend error`, async () => {
        globalThis.fetch = async () =>
            Response.json(
                {
                    success: false,
                    error: {
                        message: "  There is not enough available stock.  ",
                    },
                },
                { status },
            )
        await assert.rejects(api.runTransferAction(1, "dispatch", dispatch), {
            message: "There is not enough available stock.",
        })
    })

test("transfer malformed JSON, missing data and network failures produce readable errors", async () => {
    globalThis.fetch = async () => new Response("{", { status: 200 })
    await assert.rejects(api.getTransfers(), /invalid JSON/)
    globalThis.fetch = async () => Response.json({ success: true })
    await assert.rejects(api.getTransfers(), /missing data/)
    globalThis.fetch = async () => Response.json({ success: true, data: null })
    await assert.rejects(api.getTransfer(1), /missing data/)
    globalThis.fetch = async () => {
        throw new TypeError("fetch failed")
    }
    await assert.rejects(api.getTransfers(), /Unable to reach/)
})

test("transfer fetch and response cancellation retain the original AbortError", async () => {
    const reason = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => {
        throw reason
    }
    await assert.rejects(api.getTransfers(), (error) => error === reason)
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw reason
        },
    })
    await assert.rejects(api.getTransfer(1), (error) => error === reason)
})
