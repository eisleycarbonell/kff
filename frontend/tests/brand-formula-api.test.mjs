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
process.env.NEXT_PUBLIC_API_BASE_URL = "https://catalog.example.test/api"
const brands = await import("../src/hooks/modules/brands/use-brands.ts")
const formulas = await import("../src/hooks/modules/packing-formulas/use-packing-formulas.ts")
const schema = await import("../src/components/modules/packing-formulas/packing-formula.schema.ts")
const brandSchema = await import("../src/components/modules/brands/brand.schema.ts")
const originalFetch = globalThis.fetch
afterEach(() => {
    globalThis.fetch = originalFetch
})
const audit = {
    createdBy: 7,
    updatedBy: 7,
    createdAt: "2026-11-07T00:00:00Z",
    updatedAt: "2026-11-07T00:00:00Z",
}
const brand = {
    brandId: 1,
    code: "KFF",
    name: "KFF",
    description: null,
    isActive: true,
    itemCount: 1,
    ...audit,
}
const formula = {
    itemId: 3,
    itemSku: "FG",
    itemName: "Finished",
    brandName: null,
    isActive: true,
    primaryUomId: 2,
    primaryUomName: "pc",
    componentCount: 1,
    components: [
        {
            bomId: 1,
            componentItemId: 1,
            componentSku: "RM",
            componentName: "Raw",
            componentIsActive: true,
            quantity: "0.100000",
            uomId: 1,
            uomName: "kg",
        },
    ],
    ...audit,
}
const options = {
    products: [{ itemId: 3, sku: "FG", name: "Finished", primaryUomName: "pc", hasFormula: false }],
    components: [{ itemId: 1, sku: "RM", name: "Raw", primaryUomId: 1, uomClassId: 1 }],
    uoms: [
        { uomId: 1, name: "kg", uomClassId: 1, factorToBase: "1.00000000" },
        { uomId: 2, name: "pc", uomClassId: 2, factorToBase: "1.00000000" },
    ],
}
const response = (data) => Response.json({ success: true, data })
test("brand and formula reads validate DTOs, forward cancellation and include credentials", async () => {
    const controller = new AbortController()
    for (const [path, data, invoke] of [
        ["/brands", [brand], () => brands.getBrands(controller.signal)],
        ["/brands/1", brand, () => brands.getBrand(1, controller.signal)],
        ["/packing-formulas", [formula], () => formulas.getFormulas(controller.signal)],
        ["/packing-formulas/options", options, () => formulas.getFormulaOptions(controller.signal)],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, "https://catalog.example.test/api" + path)
            assert.equal(request.credentials, "include")
            assert.equal(request.signal, controller.signal)
            return response(data)
        }
        assert.deepEqual(await invoke(), data)
    }
})
test("master data writes preserve exact strings and only send supplied writable fields", async () => {
    const input = {
        itemId: 3,
        components: [{ componentItemId: 1, quantity: "0.100000", uomId: 1 }],
    }
    for (const [path, method, body, data, invoke] of [
        [
            "/brands",
            "POST",
            { code: "KFF", name: "KFF", description: null, isActive: true },
            brand,
            () =>
                brands.createBrand({ code: "KFF", name: "KFF", description: null, isActive: true }),
        ],
        [
            "/brands/1",
            "PATCH",
            { isActive: false },
            brand,
            () => brands.updateBrand(1, { isActive: false }),
        ],
        ["/packing-formulas", "POST", input, formula, () => formulas.createFormula(input)],
        [
            "/packing-formulas/3",
            "PATCH",
            { components: input.components },
            formula,
            () => formulas.updateFormula(3, { components: input.components }),
        ],
    ]) {
        globalThis.fetch = async (url, request) => {
            assert.equal(url, "https://catalog.example.test/api" + path)
            assert.equal(request.method, method)
            assert.deepEqual(JSON.parse(request.body), body)
            return response(data)
        }
        assert.deepEqual(await invoke(), data)
    }
})
test("formula removal supports a bodyless 204", async () => {
    globalThis.fetch = async (url, request) => {
        assert.equal(url, "https://catalog.example.test/api/packing-formulas/3")
        assert.equal(request.method, "DELETE")
        return new Response(null, { status: 204 })
    }
    await formulas.removeFormula(3)
})
test("invalid responses and permission errors do not enter the feature cache", async () => {
    globalThis.fetch = async () =>
        response([{ ...formula, components: [{ ...formula.components[0], quantity: 0.1 }] }])
    await assert.rejects(formulas.getFormulas(), /invalid packing formulas/)
    globalThis.fetch = async () => response([{ ...brand, brandId: "1" }])
    await assert.rejects(brands.getBrands(), /invalid brand list/)
    globalThis.fetch = async () =>
        Response.json({ success: false, error: { message: "Permission revoked" } }, { status: 403 })
    await assert.rejects(formulas.createFormula({}), /Permission revoked/)
})
test("formula form validates compatible units, duplicate materials and precision", () => {
    const input = {
        itemId: 3,
        components: [{ componentItemId: 1, quantity: "0.000001", uomId: 1 }],
    }
    assert.equal(schema.validateFormula(input, options), undefined)
    assert.ok(
        schema.validateFormula(
            { ...input, components: [{ ...input.components[0], uomId: 2 }] },
            options,
        ),
    )
    assert.ok(
        schema.validateFormula(
            { ...input, components: [...input.components, ...input.components] },
            options,
        ),
    )
    assert.ok(
        schema.validateFormula(
            { ...input, components: [{ ...input.components[0], quantity: "0.0000001" }] },
            options,
        ),
    )
    assert.deepEqual(
        brandSchema.toBrandInput({
            code: " kff ",
            name: " KFF ",
            description: " ",
            isActive: false,
        }),
        { code: "KFF", name: "KFF", description: null, isActive: false },
    )
})
