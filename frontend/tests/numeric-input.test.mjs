import assert from "node:assert/strict"
import { test } from "node:test"
import { sanitizeNumericInput } from "../src/lib/numeric-input.ts"

test("sanitizeNumericInput keeps clean decimals and strips letters, currency symbols, commas, and exponents", () => {
    assert.equal(sanitizeNumericInput("₱1,250.50abc"), "1250.50")
    assert.equal(sanitizeNumericInput("$ 99.95 USD"), "99.95")
    assert.equal(sanitizeNumericInput("1e3"), "13")
    assert.equal(sanitizeNumericInput("1E+5"), "15")
    assert.equal(sanitizeNumericInput("-5.25"), "5.25")
    assert.equal(sanitizeNumericInput(""), "")
})

test("sanitizeNumericInput normalizes leading dots and ignores extra decimal points", () => {
    assert.equal(sanitizeNumericInput(".5"), "0.5")
    assert.equal(sanitizeNumericInput("."), "0.")
    assert.equal(sanitizeNumericInput("12.34.56"), "12.3456")
})

test("sanitizeNumericInput caps whole digits and decimal places per schema precision", () => {
    assert.equal(
        sanitizeNumericInput("123456789012.123456", {
            maxWholeDigits: 10,
            maxDecimalPlaces: 4,
        }),
        "1234567890.1234",
    )
    assert.equal(
        sanitizeNumericInput("12.1234567", {
            maxWholeDigits: 8,
            maxDecimalPlaces: 6,
        }),
        "12.123456",
    )
    assert.equal(
        sanitizeNumericInput("1.000000009", {
            maxWholeDigits: 10,
            maxDecimalPlaces: 8,
        }),
        "1.00000000",
    )
    assert.equal(
        sanitizeNumericInput("100.129", {
            maxWholeDigits: 3,
            maxDecimalPlaces: 2,
        }),
        "100.12",
    )
})

test("sanitizeNumericInput integer mode strips non-digits and truncates pasted decimals cleanly", () => {
    assert.equal(sanitizeNumericInput("30.00", { allowDecimal: false }), "30")
    assert.equal(sanitizeNumericInput("365.75", { allowDecimal: false }), "365")
    assert.equal(sanitizeNumericInput("1,200d", { allowDecimal: false }), "1200")
    assert.equal(
        sanitizeNumericInput("123456", { allowDecimal: false, maxWholeDigits: 4 }),
        "1234",
    )
    assert.equal(
        sanitizeNumericInput("12.34", { maxDecimalPlaces: 0 }),
        "12",
    )
})

test("sanitizeNumericInput supports optional leading minus only when allowNegative is enabled", () => {
    assert.equal(sanitizeNumericInput("-12.5", { allowNegative: true }), "-12.5")
    assert.equal(sanitizeNumericInput(" -0.5", { allowNegative: true }), "-0.5")
    assert.equal(sanitizeNumericInput("-.5", { allowNegative: true }), "-0.5")
    assert.equal(sanitizeNumericInput("12-34", { allowNegative: true }), "1234")
    assert.equal(sanitizeNumericInput("a-12", { allowNegative: true }), "12")
})
