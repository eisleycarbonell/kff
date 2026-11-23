/** Strip UTF-8 BOM and normalize CSV headers so `Item Type`, `item_type`, and `itemType` all match. */
export function normalizeCsvKey(key: string): string {
    return key
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "")
}

/** Parse RFC 4180 CSV text into non-empty string rows, supporting quoted commas, newlines, and `""` escapes. */
export function parseCsvRows(text: string): string[][] {
    const input = text.replace(/^\uFEFF/, "")
    const rows: string[][] = []
    let row: string[] = []
    let field = ""
    let inQuotes = false

    for (let i = 0; i < input.length; i++) {
        const ch = input[i]
        if (inQuotes) {
            if (ch === '"') {
                if (input[i + 1] === '"') {
                    field += '"'
                    i++
                } else {
                    inQuotes = false
                }
            } else {
                field += ch
            }
            continue
        }

        if (ch === '"' && field.length === 0) {
            inQuotes = true
            continue
        }
        if (ch === ",") {
            row.push(field)
            field = ""
            continue
        }
        if (ch === "\r" || ch === "\n") {
            if (ch === "\r" && input[i + 1] === "\n") i++
            row.push(field)
            if (row.some((cell) => cell.trim() !== "")) rows.push(row)
            row = []
            field = ""
            continue
        }
        field += ch
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field)
        if (row.some((cell) => cell.trim() !== "")) rows.push(row)
    }

    return rows
}

/** Parse CSV text into trimmed header names and key-normalized row objects. */
export function parseCsvRecords(text: string): {
    headers: string[]
    rows: Record<string, string>[]
} {
    const parsed = parseCsvRows(text)
    if (parsed.length === 0) return { headers: [], rows: [] }

    const headers = parsed[0].map((header) => header.replace(/^\uFEFF/, "").trim())
    const normalizedHeaders = headers.map(normalizeCsvKey)
    const rows: Record<string, string>[] = []

    for (let r = 1; r < parsed.length; r++) {
        const cells = parsed[r]
        const record: Record<string, string> = {}
        let hasContent = false
        for (let c = 0; c < headers.length; c++) {
            const rawHeader = headers[c]
            const normHeader = normalizedHeaders[c]
            const val = (cells[c] ?? "").trim()
            if (val !== "") hasContent = true
            if (rawHeader) record[rawHeader] = val
            if (normHeader && !(normHeader in record)) record[normHeader] = val
        }
        if (hasContent) rows.push(record)
    }

    return { headers, rows }
}

export function getCsvValue(row: Record<string, string>, key: string): string {
    if (key in row) return (row[key] ?? "").trim()
    const normalized = normalizeCsvKey(key)
    if (normalized in row) return (row[normalized] ?? "").trim()
    for (const [k, v] of Object.entries(row)) {
        if (normalizeCsvKey(k) === normalized) return (v ?? "").trim()
    }
    return ""
}

export function hasCsvValue(row: Record<string, string>, key: string): boolean {
    if (key in row) return true
    const normalized = normalizeCsvKey(key)
    if (normalized in row) return true
    return Object.keys(row).some((k) => normalizeCsvKey(k) === normalized)
}

export function requiredCsvString(
    row: Record<string, string>,
    key: string,
    label?: string,
): string {
    const value = getCsvValue(row, key)
    if (!value) throw new Error(`${label ?? key} is required.`)
    return value
}

export function optionalCsvString(row: Record<string, string>, key: string): string | null {
    const value = getCsvValue(row, key)
    return value || null
}

export function parseCsvBoolean(value: string, defaultValue = true): boolean {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return defaultValue
    if (["true", "1", "yes", "y", "active", "on"].includes(normalized)) return true
    if (["false", "0", "no", "n", "inactive", "off"].includes(normalized)) return false
    throw new Error(`Invalid boolean "${value}". Use true/false or yes/no.`)
}
