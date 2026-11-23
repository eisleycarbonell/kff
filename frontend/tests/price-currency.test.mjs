import assert from "node:assert/strict"
import { test } from "node:test"
import {
    convertCurrencyAmount,
    getExchangeRateLabel,
    isForeignCurrency,
    validateExchangeRate,
} from "../src/lib/price-currency.ts"

test("convertCurrencyAmount keeps same-currency amounts exact without an exchange rate", () => {
    assert.equal(
        convertCurrencyAmount({
            amount: "125.5000",
            fromCurrency: "PHP",
            baseCurrency: "PHP",
            exchangeRate: "",
        }),
        "125.5",
    )
    assert.equal(
        convertCurrencyAmount({
            amount: "0",
            fromCurrency: "USD",
            baseCurrency: "USD",
            exchangeRate: "",
        }),
        "0",
    )
})

test("convertCurrencyAmount converts USD to PHP and PHP to USD with 4-decimal rounding", () => {
    assert.equal(
        convertCurrencyAmount({
            amount: "12.50",
            fromCurrency: "USD",
            baseCurrency: "PHP",
            exchangeRate: "58",
        }),
        "725",
    )
    assert.equal(
        convertCurrencyAmount({
            amount: "1.25",
            fromCurrency: "USD",
            baseCurrency: "PHP",
            exchangeRate: "58.125",
        }),
        "72.6563",
    )
    assert.equal(
        convertCurrencyAmount({
            amount: "580",
            fromCurrency: "PHP",
            baseCurrency: "USD",
            exchangeRate: "58",
        }),
        "10",
    )
    assert.equal(
        convertCurrencyAmount({
            amount: "100",
            fromCurrency: "PHP",
            baseCurrency: "USD",
            exchangeRate: "58",
        }),
        "1.7241",
    )
})

test("convertCurrencyAmount handles invalid rates, blanks, and 10-digit bounds", () => {
    assert.equal(
        convertCurrencyAmount({
            amount: "",
            fromCurrency: "USD",
            baseCurrency: "PHP",
            exchangeRate: "58",
        }),
        "",
    )
    assert.equal(
        convertCurrencyAmount({
            amount: "10",
            fromCurrency: "USD",
            baseCurrency: "PHP",
            exchangeRate: "0",
        }),
        null,
    )
    assert.equal(
        convertCurrencyAmount({
            amount: "1000000000",
            fromCurrency: "USD",
            baseCurrency: "PHP",
            exchangeRate: "58",
        }),
        null,
    )
})

test("exchange rate helpers validate positive decimals and format labels clearly", () => {
    assert.equal(validateExchangeRate(""), "Enter an exchange rate.")
    assert.equal(
        validateExchangeRate("0"),
        "Enter a positive exchange rate with up to 4 decimal places.",
    )
    assert.equal(
        validateExchangeRate("-58"),
        "Enter a positive exchange rate with up to 4 decimal places.",
    )
    assert.equal(validateExchangeRate("58.25"), undefined)
    assert.equal(isForeignCurrency("USD", "PHP"), true)
    assert.equal(isForeignCurrency("PHP", "PHP"), false)
    assert.equal(getExchangeRateLabel("PHP", ["USD"]), "Exchange rate (1 USD = PHP)")
    assert.equal(getExchangeRateLabel("USD", ["PHP"]), "Exchange rate (1 USD = PHP)")
})
