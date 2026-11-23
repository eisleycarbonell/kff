export type ComboboxValueType = string | number

export type ComboboxOption<TValue extends ComboboxValueType = string> = {
    value: TValue
    label: string
    disabled?: boolean
    searchText?: string
}

export type ComboboxInputOption<TValue extends ComboboxValueType = string> = {
    value: TValue | null
    label: string
    disabled?: boolean
    searchText?: string
}

export type IndexedComboboxOption<TValue extends ComboboxValueType = string> = {
    option: ComboboxOption<TValue>
    normalizedText: string
}

export type FilteredComboboxOptions<TValue extends ComboboxValueType = string> = {
    visible: ComboboxOption<TValue>[]
    totalMatches: number
    truncatedCount: number
}

export const DEFAULT_MAX_VISIBLE_COMBOBOX_OPTIONS = 80
export const AUTO_SEARCH_COMBOBOX_THRESHOLD = 6

export function resolveComboboxSearchable(
    itemCount: number,
    searchable: boolean | "auto" = "auto",
): boolean {
    return searchable === "auto"
        ? itemCount >= AUTO_SEARCH_COMBOBOX_THRESHOLD
        : searchable
}

export function normalizeComboboxOptions<TValue extends ComboboxValueType>(
    items: readonly ComboboxInputOption<TValue>[],
): {
    options: ComboboxOption<TValue>[]
    nullPlaceholder?: string
} {
    const options: ComboboxOption<TValue>[] = []
    let nullPlaceholder: string | undefined

    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.value === null || item.value === undefined) {
            if (nullPlaceholder === undefined) {
                nullPlaceholder = item.label
            }
            continue
        }
        options.push(item as ComboboxOption<TValue>)
    }

    return { options, nullPlaceholder }
}

export function indexComboboxOptions<TValue extends ComboboxValueType>(
    items: readonly ComboboxOption<TValue>[],
): IndexedComboboxOption<TValue>[] {
    return items.map((option) => ({
        option,
        normalizedText: (
            option.searchText
                ? `${option.label} ${option.searchText}`
                : option.label
        ).toLowerCase(),
    }))
}

export function filterIndexedComboboxOptions<TValue extends ComboboxValueType>(
    indexed: readonly IndexedComboboxOption<TValue>[],
    query: string,
    {
        maxVisible = DEFAULT_MAX_VISIBLE_COMBOBOX_OPTIONS,
        selectedValue,
    }: {
        maxVisible?: number
        selectedValue?: TValue | null
    } = {},
): FilteredComboboxOptions<TValue> {
    const limit = Math.max(1, maxVisible)
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

    if (tokens.length === 0) {
        const totalMatches = indexed.length
        if (totalMatches <= limit) {
            return {
                visible: indexed.map((entry) => entry.option),
                totalMatches,
                truncatedCount: 0,
            }
        }

        const selectedIndex =
            selectedValue == null
                ? -1
                : indexed.findIndex((entry) => entry.option.value === selectedValue)

        if (selectedIndex >= limit) {
            const visible = indexed
                .slice(0, limit - 1)
                .map((entry) => entry.option)
            visible.push(indexed[selectedIndex].option)
            return {
                visible,
                totalMatches,
                truncatedCount: totalMatches - visible.length,
            }
        }

        return {
            visible: indexed.slice(0, limit).map((entry) => entry.option),
            totalMatches,
            truncatedCount: totalMatches - limit,
        }
    }

    const visible: ComboboxOption<TValue>[] = []
    let totalMatches = 0

    for (let i = 0; i < indexed.length; i++) {
        const entry = indexed[i]
        let matches = true
        for (let t = 0; t < tokens.length; t++) {
            if (!entry.normalizedText.includes(tokens[t])) {
                matches = false
                break
            }
        }
        if (!matches) continue
        totalMatches += 1
        if (visible.length < limit) {
            visible.push(entry.option)
        }
    }

    return {
        visible,
        totalMatches,
        truncatedCount: Math.max(0, totalMatches - visible.length),
    }
}
