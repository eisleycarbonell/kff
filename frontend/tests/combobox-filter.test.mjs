import assert from "node:assert/strict"
import { test } from "node:test"
import {
    AUTO_SEARCH_COMBOBOX_THRESHOLD,
    filterIndexedComboboxOptions,
    indexComboboxOptions,
    normalizeComboboxOptions,
    resolveComboboxSearchable,
} from "../src/components/shared/combobox-filter.ts"

test("normalizeComboboxOptions extracts null placeholders and strips nullish entries", () => {
    const result = normalizeComboboxOptions([
        { value: null, label: "Select unit" },
        { value: 1, label: "Kilogram" },
        { value: 2, label: "Gram" },
    ])

    assert.equal(result.nullPlaceholder, "Select unit")
    assert.deepEqual(result.options, [
        { value: 1, label: "Kilogram" },
        { value: 2, label: "Gram" },
    ])
})

test("resolveComboboxSearchable enables search automatically once option count reaches threshold", () => {
    assert.equal(resolveComboboxSearchable(3), false)
    assert.equal(
        resolveComboboxSearchable(AUTO_SEARCH_COMBOBOX_THRESHOLD - 1),
        false,
    )
    assert.equal(resolveComboboxSearchable(AUTO_SEARCH_COMBOBOX_THRESHOLD), true)
    assert.equal(resolveComboboxSearchable(2, true), true)
    assert.equal(resolveComboboxSearchable(100, false), false)
})

test("filterIndexedComboboxOptions supports multi-token matching and searchText", () => {
    const indexed = indexComboboxOptions([
        { value: "1", label: "SP-001 · Organic Turmeric 100g", searchText: "curcuma" },
        { value: "2", label: "SP-002 · Tellicherry Black Pepper 500g" },
        { value: "3", label: "PK-010 · Pouch Label 100g" },
    ])

    const multi = filterIndexedComboboxOptions(indexed, "100g turm")
    assert.equal(multi.totalMatches, 1)
    assert.equal(multi.truncatedCount, 0)
    assert.deepEqual(
        multi.visible.map((o) => o.value),
        ["1"],
    )

    const byExtraText = filterIndexedComboboxOptions(indexed, "CURCUMA")
    assert.equal(byExtraText.totalMatches, 1)
    assert.equal(byExtraText.visible[0]?.value, "1")
})

test("filterIndexedComboboxOptions caps visible items and retains selected item past window", () => {
    const items = Array.from({ length: 120 }, (_, i) => ({
        value: String(i + 1),
        label: `Item ${i + 1}`,
    }))
    const indexed = indexComboboxOptions(items)

    const result = filterIndexedComboboxOptions(indexed, "", {
        maxVisible: 20,
        selectedValue: "95",
    })

    assert.equal(result.totalMatches, 120)
    assert.equal(result.visible.length, 20)
    assert.equal(result.truncatedCount, 100)
    assert.equal(result.visible.some((o) => o.value === "95"), true)
})
