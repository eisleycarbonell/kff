export const ENTRY_CURRENCIES = [
    { value: "PHP", label: "PHP (₱)", triggerLabel: "PHP ₱", symbol: "₱", name: "Peso" },
    { value: "USD", label: "USD ($)", triggerLabel: "USD $", symbol: "$", name: "Dollar" },
] as const

export type EntryCurrencyCode = (typeof ENTRY_CURRENCIES)[number]["value"]

const DECIMAL_SCALE = 4
const SCALE_FACTOR = BigInt(10_000)
const MAX_10_DIGIT_SCALED = BigInt("99999999999999")

export function normalizeCurrencyCode(code?: string | null): string {
    const normalized = code?.trim().toUpperCase()
    return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : "PHP"
}

export function resolveBaseEntryCurrency(baseCurrency?: string | null): EntryCurrencyCode {
    return normalizeCurrencyCode(baseCurrency) === "USD" ? "USD" : "PHP"
}

export function isForeignCurrency(
    entryCurrency: EntryCurrencyCode,
    baseCurrency?: string | null,
): boolean {
    return entryCurrency !== normalizeCurrencyCode(baseCurrency)
}

export function currencySymbol(currencyCode?: string | null): string {
    const normalized = normalizeCurrencyCode(currencyCode)
    if (normalized === "PHP") return "₱"
    if (normalized === "USD") return "$"
    return `${normalized} `
}

export function parseScaledDecimal(
    value: string,
    places = DECIMAL_SCALE,
    wholeDigits = 10,
): bigint | null {
    const trimmed = value.trim()
    if (!new RegExp(`^\\d{1,${wholeDigits}}(?:\\.\\d{1,${places}})?$`).test(trimmed)) {
        return null
    }
    const [whole, fraction = ""] = trimmed.split(".")
    return BigInt(whole + fraction.padEnd(places, "0"))
}

export function formatScaledDecimal(value: bigint, places = DECIMAL_SCALE): string {
    const negative = value < BigInt(0)
    const abs = negative ? -value : value
    const digits = abs.toString().padStart(places + 1, "0")
    const whole = digits.slice(0, -places)
    const fraction = digits.slice(-places).replace(/0+$/, "")
    const formatted = fraction ? `${whole}.${fraction}` : whole
    return negative ? `-${formatted}` : formatted
}

export function validateExchangeRate(exchangeRate: string): string | undefined {
    const trimmed = exchangeRate.trim()
    if (!trimmed) return "Enter an exchange rate."
    const units = parseScaledDecimal(trimmed, DECIMAL_SCALE, 10)
    if (units === null || units <= BigInt(0)) {
        return "Enter a positive exchange rate with up to 4 decimal places."
    }
    return undefined
}

export function getExchangeRateLabel(
    baseCurrency?: string | null,
    entryCurrencies: readonly EntryCurrencyCode[] = [],
): string {
    const base = normalizeCurrencyCode(baseCurrency)
    if (base === "PHP" || base === "USD") {
        return "Exchange rate (1 USD = PHP)"
    }
    const foreign = entryCurrencies.find((code) => code !== base) ?? "USD"
    return `Exchange rate (1 ${foreign} = ${base})`
}

export function convertCurrencyAmount({
    amount,
    fromCurrency,
    baseCurrency,
    exchangeRate,
}: {
    amount: string
    fromCurrency: EntryCurrencyCode
    baseCurrency?: string | null
    exchangeRate: string
}): string | null {
    const trimmed = amount.trim()
    if (!trimmed) return ""

    const amountUnits = parseScaledDecimal(trimmed, DECIMAL_SCALE, 10)
    if (amountUnits === null) return null

    const base = normalizeCurrencyCode(baseCurrency)
    if (fromCurrency === base) {
        return formatScaledDecimal(amountUnits, DECIMAL_SCALE)
    }

    const rateUnits = parseScaledDecimal(exchangeRate, DECIMAL_SCALE, 10)
    if (rateUnits === null || rateUnits <= BigInt(0)) {
        return null
    }

    let convertedUnits: bigint
    if (fromCurrency === "PHP" && base === "USD") {
        convertedUnits = (amountUnits * SCALE_FACTOR + rateUnits / BigInt(2)) / rateUnits
    } else {
        convertedUnits = (amountUnits * rateUnits + BigInt(5000)) / SCALE_FACTOR
    }

    if (convertedUnits > MAX_10_DIGIT_SCALED) {
        return null
    }
    return formatScaledDecimal(convertedUnits, DECIMAL_SCALE)
}
