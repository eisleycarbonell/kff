import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { afterEach, test } from "node:test"
registerHooks({
    resolve(specifier, context, nextResolve) {
        return nextResolve(
            specifier.startsWith("@/")
                ? new URL("../src/" + specifier.slice(2) + ".ts", import.meta.url).href
                : specifier,
            context,
        )
    },
})
process.env.NEXT_PUBLIC_API_BASE_URL = "https://master.example.test/api///"
const uoms = await import("../src/hooks/modules/uoms/use-uoms.ts")
const locations = await import("../src/hooks/modules/locations/use-locations.ts")
const unitSchema = await import("../src/components/modules/uoms/uom.schema.ts")
const locationSchema = await import("../src/components/modules/locations/location.schema.ts")
const { ApiError } = await import("../src/lib/api-request.ts")
const originalFetch = globalThis.fetch
const audit = {
    createdBy: 7,
    updatedBy: 7,
    createdAt: "2026-10-27T00:00:00Z",
    updatedAt: "2026-10-27T00:00:00Z",
}
const unit = {
    uomId: 1,
    name: "kg",
    uomClassId: 1,
    uomClassName: "Mass",
    factorToBase: "1.00000000",
    isBase: true,
    isInUse: false,
    isClassAnchor: false,
    ...audit,
}
const group = { uomClassId: 1, name: "Mass", unitCount: 1, baseUomName: "kg", ...audit }
const location = {
    locationId: 1,
    code: "WH-1",
    name: "Warehouse",
    locationType: "Warehouse",
    isActive: true,
    isInUse: false,
    hasOperationalActivity: false,
    ...audit,
}
const unitInput = { name: "kg", uomClassId: 1, factorToBase: "1.00000000", isBase: true }
const locationInput = { code: "WH-1", name: "Warehouse", locationType: "Warehouse", isActive: true }
const response = (data, status = 200) =>
    new Response(JSON.stringify({ success: true, data }), {
        status,
        headers: { "Content-Type": "application/json" },
    })
afterEach(() => {
    globalThis.fetch = originalFetch
})
test("master data GET requests use correct URLs, cookies, cancellation, and exact factors", async () => {
    const controller = new AbortController()
    for (const [request, path, data] of [
        [uoms.getUoms, "/uoms", [unit]],
        [uoms.getUomClasses, "/uoms/classes", [group]],
        [locations.getLocations, "/locations", [location]],
    ]) {
        globalThis.fetch = async (url, options) => {
            assert.equal(url, "https://master.example.test/api" + path)
            assert.equal(options.credentials, "include")
            assert.equal(options.signal, controller.signal)
            return response(data)
        }
        assert.deepEqual(await request(controller.signal), data)
    }
})
test("unit, class and location writes preserve request methods, exact values, and partial updates", async () => {
    for (const [send, path, method, input, data] of [
        [() => uoms.createUom(unitInput), "/uoms", "POST", unitInput, unit],
        [
            () => uoms.updateUom(1, { factorToBase: "0.00000001", isBase: false }),
            "/uoms/1",
            "PATCH",
            { factorToBase: "0.00000001", isBase: false },
            { ...unit, factorToBase: "0.00000001", isBase: false },
        ],
        [
            () => uoms.createUomClass({ name: "Mass" }),
            "/uoms/classes",
            "POST",
            { name: "Mass" },
            group,
        ],
        [
            () => uoms.updateUomClass(1, { name: "Weight" }),
            "/uoms/classes/1",
            "PATCH",
            { name: "Weight" },
            { ...group, name: "Weight" },
        ],
        [
            () => locations.createLocation(locationInput),
            "/locations",
            "POST",
            locationInput,
            location,
        ],
        [
            () => locations.updateLocation(1, { isActive: false }),
            "/locations/1",
            "PATCH",
            { isActive: false },
            { ...location, isActive: false },
        ],
    ]) {
        globalThis.fetch = async (url, options) => {
            assert.equal(url, "https://master.example.test/api" + path)
            assert.equal(options.method, method)
            assert.equal(options.credentials, "include")
            assert.deepEqual(JSON.parse(options.body), input)
            return response(data, method === "POST" ? 201 : 200)
        }
        assert.deepEqual(await send(), data)
    }
})
test("unit and class DELETE requests accept empty 204 responses", async () => {
    for (const [remove, path] of [
        [uoms.deleteUom, "/uoms/1"],
        [uoms.deleteUomClass, "/uoms/classes/1"],
    ]) {
        globalThis.fetch = async (url, options) => {
            assert.equal(url, "https://master.example.test/api" + path)
            assert.equal(options.method, "DELETE")
            assert.equal(options.body, undefined)
            return new Response(null, { status: 204 })
        }
        assert.equal(await remove(1), undefined)
    }
})
test("invalid master data DTOs are rejected before rendering", async () => {
    for (const [get, badValues] of [
        [
            uoms.getUoms,
            [
                {},
                null,
                [{ ...unit, factorToBase: 1 }],
                [{ ...unit, factorToBase: "1.000000001" }],
                [{ ...unit, isInUse: "yes" }],
            ],
        ],
        [uoms.getUomClasses, [[{ ...group, unitCount: "1" }], [{ ...group, baseUomName: 1 }]]],
        [
            locations.getLocations,
            [
                [{ ...location, locationType: "Bin" }],
                [{ ...location, locationId: 0 }],
                [{ ...location, hasOperationalActivity: null }],
            ],
        ],
    ]) {
        for (const data of badValues) {
            globalThis.fetch = async () => response(data)
            await assert.rejects(get())
        }
    }
})
test("private response fields are stripped from public master data records", async () => {
    for (const [get, record] of [
        [uoms.getUoms, unit],
        [uoms.getUomClasses, group],
        [locations.getLocations, location],
    ]) {
        globalThis.fetch = async () =>
            response([{ ...record, passwordHash: "private", internalNote: "private" }])
        assert.deepEqual(await get(), [record])
    }
})
test("conflicts retain HTTP status and safe server messages for failed forms", async () => {
    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                success: false,
                error: { message: "Move stock before deactivating this location." },
            }),
            { status: 409 },
        )
    await assert.rejects(
        locations.updateLocation(1, { isActive: false }),
        (error) =>
            error instanceof ApiError && error.status === 409 && /Move stock/.test(error.message),
    )
    await assert.rejects(
        uoms.deleteUom(1),
        (error) => error instanceof ApiError && error.status === 409,
    )
})
test("network errors and cancellation are preserved across both resource boundaries", async () => {
    globalThis.fetch = async () => {
        throw new TypeError("offline")
    }
    await assert.rejects(uoms.getUoms(), /Unable to reach/)
    await assert.rejects(locations.getLocations(), /Unable to reach/)
    const aborted = new DOMException("Cancelled", "AbortError")
    globalThis.fetch = async () => {
        throw aborted
    }
    for (const get of [uoms.getUoms, uoms.getUomClasses, locations.getLocations])
        await assert.rejects(get(), (error) => error === aborted)
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw aborted
        },
    })
    await assert.rejects(locations.getLocations(), (error) => error === aborted)
})
test("UOM validation starts each class with a base and blocks duplicate names and bases", () => {
    const base = { ...unitInput, name: "unit", uomClassId: 2 }
    const empty = { ...group, uomClassId: 2, name: "Count", unitCount: 0, baseUomName: null }
    assert.deepEqual(unitSchema.validateUom(base, [], [empty], null), {})
    assert.ok(unitSchema.validateUom({ ...base, isBase: false }, [], [empty], null).isBase)
    assert.ok(unitSchema.validateUom({ ...unitInput, name: "new" }, [unit], [group], null).isBase)
    assert.ok(unitSchema.validateUom(unitInput, [unit], [group], null).name)
    assert.ok(unitSchema.validateUom({ ...base, uomClassId: null }, [], [empty], null).uomClassId)
    assert.ok(
        unitSchema.validateUom({ ...base, factorToBase: "0" }, [], [empty], null).factorToBase,
    )
    assert.ok(
        unitSchema.validateUom({ ...base, factorToBase: "1.000000001" }, [], [empty], null)
            .factorToBase,
    )
})
test("factor precision, display, and referenced-unit validation avoid floating-point loss", () => {
    assert.equal(unitSchema.factorUnits("9999999999.99999999"), BigInt("999999999999999999"))
    assert.equal(unitSchema.formatFactor("9999999999.99999999"), "9,999,999,999.99999999")
    assert.equal(unitSchema.formatFactor("0.00000001"), "0.00000001")
    const used = { ...unit, isInUse: true }
    assert.deepEqual(
        unitSchema.validateUom(
            { ...unitInput, name: "renamed", factorToBase: "01" },
            [used],
            [group],
            used,
        ),
        {},
    )
    assert.ok(
        unitSchema.validateUom({ ...unitInput, factorToBase: "2" }, [used], [group], used)
            .factorToBase,
    )
})
test("location form validates all types, codes, usage locks, lifecycle state, and master-data boundaries", () => {
    for (const locationType of locationSchema.LOCATION_TYPES)
        assert.deepEqual(
            locationSchema.validateLocation({ ...locationInput, locationType }, [], null),
            {},
        )
    assert.equal(
        locationSchema.locationInputSchema.parse({ ...locationInput, code: " wh-1 " }).code,
        "WH-1",
    )
    assert.ok(
        locationSchema.validateLocation({ ...locationInput, code: " wh-1 " }, [location], null)
            .code,
    )
    const used = { ...location, isInUse: true, hasOperationalActivity: true }
    assert.ok(
        locationSchema.validateLocation({ ...locationInput, locationType: "Branch" }, [used], used)
            .locationType,
    )
    assert.ok(
        locationSchema.validateLocation({ ...locationInput, isActive: false }, [used], used)
            .isActive,
    )
    assert.deepEqual(
        locationSchema.validateLocation({ ...locationInput, isActive: true }, [used], used),
        {},
    )
    assert.equal(
        locationSchema.locationInputSchema.safeParse({ ...locationInput, qtyOnHand: "10" }).success,
        false,
    )
})
