import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { registerHooks } from "node:module"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"
import { getModuleGuide, moduleGuides } from "../src/lib/module-guides.ts"

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "next/navigation") {
            return { url: "data:text/javascript,export const usePathname = () => globalThis.__moduleGuidePath", shortCircuit: true }
        }
        if (specifier === "next/link") return nextResolve("next/link.js", context)
        if (specifier.startsWith("@/")) {
            const base = new URL(`../src/${specifier.slice(2)}`, import.meta.url)
            for (const extension of [".ts", ".tsx"]) {
                const candidate = new URL(base.href + extension)
                if (existsSync(candidate)) return nextResolve(candidate.href, context)
            }
        }
        return nextResolve(specifier, context)
    },
    load(url, context, nextLoad) {
        if (url.endsWith(".tsx")) {
            return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
                fileName: fileURLToPath(url), compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
            }).outputText }
        }
        return nextLoad(url, context)
    },
})
const { PageHeader } = await import("../src/components/shared/page-header.tsx")

const text = html => html.replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#x27);/g, entity => ({
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'",
})[entity])

test("every active sidebar module has a complete guide and valid connected-module links", () => {
    const sidebar = readFileSync(new URL("../src/components/layout/app-sidebar.tsx", import.meta.url), "utf8")
    const routes = [...sidebar.matchAll(/\burl:\s*["'](\/[^"']+)["']/g)].map(match => match[1])
    assert.ok(routes.length > 0, "the sidebar must expose active module links")
    assert.deepEqual(Object.keys(moduleGuides).sort(), routes.sort())
    for (const [path, guide] of Object.entries(moduleGuides)) {
        assert.ok(guide.purpose.trim(), path + " needs a purpose")
        assert.ok(guide.steps.length >= 3, path + " needs actionable instructions")
        assert.ok(guide.steps.every(step => step.trim()), path)
        assert.ok(guide.workflow.length > 0, path + " needs workflow context")
        for (const link of guide.workflow) assert.ok(getModuleGuide(link.href), path + " has an unknown workflow destination: " + link.href)
    }
})

test("all modules actually render visible purpose text and accessible usage steps through PageHeader", () => {
    for (const [path, guide] of Object.entries(moduleGuides)) {
        globalThis.__moduleGuidePath = path
        const html = renderToStaticMarkup(createElement(PageHeader, {
            title: guide.title, description: "Generic old module description",
            actions: createElement("button", { type: "button" }, "Existing primary action"),
        }))
        const content = text(html)
        assert.ok(content.includes("Purpose: " + guide.purpose), path + " must visibly explain its purpose")
        assert.ok(content.includes("How to use this module"), path)
        for (const step of guide.steps) assert.ok(content.includes(step), path + " is missing a usage step")
        assert.match(html, /<details[^>]*>/)
        assert.match(html, /<summary[^>]*>/)
        assert.match(html, /<ol[^>]*>/)
        assert.ok(content.includes("Existing primary action"), path + " must retain its page action")
        assert.ok(!content.includes("Generic old module description"), path + " must replace generic descriptions")
        for (const link of guide.workflow) assert.ok(html.includes(`href="${link.href}"`), path)
    }
})

test("guide routing preserves nested modules, trailing slashes and the In Transit view", () => {
    assert.equal(getModuleGuide("/items/"), moduleGuides["/items"])
    assert.equal(getModuleGuide("/packing-orders/reservations"), moduleGuides["/packing-orders/reservations"])
    assert.notEqual(getModuleGuide("/packing-orders/reservations"), moduleGuides["/packing-orders"])
    assert.equal(getModuleGuide("/transfers/in-transit"), moduleGuides["/transfers"])
    for (const path of ["/", "/brands", "/inventory/count-sessions", "/unknown"]) assert.equal(getModuleGuide(path), undefined)
    globalThis.__moduleGuidePath = "/transfers/in-transit"
    assert.ok(text(renderToStaticMarkup(createElement(PageHeader, { title: "Stock Transfers" }))).includes(moduleGuides["/transfers"].purpose))
})

test("non-module headers retain their own description without adding unrelated instructions", () => {
    globalThis.__moduleGuidePath = "/unknown"
    const html = renderToStaticMarkup(createElement(PageHeader, { title: "Custom page", description: "Custom explanation" }))
    assert.ok(text(html).includes("Custom explanation"))
    assert.ok(!html.includes("<details"))
})
