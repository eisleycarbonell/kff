export type NumericInputOptions = {
    allowDecimal?: boolean
    allowNegative?: boolean
    maxWholeDigits?: number
    maxDecimalPlaces?: number
}

export function sanitizeNumericInput(
    raw: string,
    options: NumericInputOptions = {},
): string {
    const {
        allowDecimal = true,
        allowNegative = false,
        maxWholeDigits,
        maxDecimalPlaces,
    } = options

    if (!raw) return ""

    const trimmedStart = raw.trimStart()
    const isNegative = allowNegative && trimmedStart.startsWith("-")
    const unsigned = isNegative ? trimmedStart.slice(1) : raw
    const sign = isNegative ? "-" : ""
    const effectiveAllowDecimal =
        allowDecimal && (maxDecimalPlaces === undefined || maxDecimalPlaces > 0)

    if (!effectiveAllowDecimal) {
        const wholeSource = unsigned.split(".")[0] ?? ""
        let digits = wholeSource.replace(/\D/g, "")
        if (maxWholeDigits !== undefined) {
            digits = digits.slice(0, Math.max(0, maxWholeDigits))
        }
        return `${sign}${digits}`
    }

    let whole = ""
    let fraction = ""
    let hasDot = false

    for (const ch of unsigned) {
        if (ch >= "0" && ch <= "9") {
            if (hasDot) {
                fraction += ch
            } else {
                whole += ch
            }
        } else if (ch === "." && !hasDot) {
            hasDot = true
        }
    }

    if (maxWholeDigits !== undefined) {
        whole = whole.slice(0, Math.max(0, maxWholeDigits))
    }

    if (hasDot && whole === "") {
        whole = "0"
    }

    if (maxDecimalPlaces !== undefined) {
        fraction = fraction.slice(0, Math.max(0, maxDecimalPlaces))
    }

    return `${sign}${whole}${hasDot ? `.${fraction}` : ""}`
}
