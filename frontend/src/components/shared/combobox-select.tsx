"use client"

import * as React from "react"
import { useDeferredValue, useMemo, useState } from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
    ComboboxValue,
} from "@/components/ui/combobox"
import {
    DEFAULT_MAX_VISIBLE_COMBOBOX_OPTIONS,
    filterIndexedComboboxOptions,
    indexComboboxOptions,
    normalizeComboboxOptions,
    resolveComboboxSearchable,
    type ComboboxInputOption,
    type ComboboxOption,
    type ComboboxValueType,
    type FilteredComboboxOptions,
} from "@/components/shared/combobox-filter"

export type { ComboboxInputOption, ComboboxOption, ComboboxValueType }

export type ComboboxSelectProps<TValue extends ComboboxValueType = string> = {
    items: readonly ComboboxInputOption<TValue>[]
    value: TValue | null | undefined
    onValueChange: (value: TValue | null) => void
    placeholder?: string
    searchPlaceholder?: string
    emptyMessage?: string
    disabled?: boolean
    required?: boolean
    readOnly?: boolean
    name?: string
    id?: string
    size?: "sm" | "default"
    searchable?: boolean | "auto"
    maxVisible?: number
    className?: string
    contentClassName?: string
    side?: React.ComponentProps<typeof ComboboxContent>["side"]
    align?: React.ComponentProps<typeof ComboboxContent>["align"]
    sideOffset?: number
    startIcon?: React.ReactNode
    "aria-label"?: string
    "aria-invalid"?: boolean | "true" | "false"
    "aria-describedby"?: string
    "aria-labelledby"?: string
}

export function ComboboxSelect<TValue extends ComboboxValueType = string>({
    items,
    value,
    onValueChange,
    placeholder,
    searchPlaceholder = "Search…",
    emptyMessage = "No matching options.",
    disabled = false,
    required = false,
    readOnly = false,
    name,
    id,
    size = "default",
    searchable = "auto",
    maxVisible = DEFAULT_MAX_VISIBLE_COMBOBOX_OPTIONS,
    className,
    contentClassName,
    side = "bottom",
    align = "start",
    sideOffset = 6,
    startIcon,
    "aria-label": ariaLabel,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    "aria-labelledby": ariaLabelledBy,
}: ComboboxSelectProps<TValue>) {
    const [open, setOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [query, setQuery] = useState("")
    const deferredQuery = useDeferredValue(query)

    const { options, nullPlaceholder } = useMemo(
        () => normalizeComboboxOptions(items),
        [items],
    )
    const resolvedPlaceholder = placeholder ?? nullPlaceholder ?? "Choose…"

    const hasEmptyOption = useMemo(
        () => options.some((item) => item.value === ""),
        [options],
    )
    const normalizedValue: TValue | null =
        value === undefined || value === null || (value === "" && !hasEmptyOption)
            ? null
            : value

    const collection = useMemo(
        () =>
            ComboboxPrimitive.createItems(options, {
                getValue: (item) => item.value,
                getLabel: (item) => item.label,
            }),
        [options],
    )

    const indexedItems = useMemo(() => indexComboboxOptions(options), [options])
    const isSearchable = resolveComboboxSearchable(options.length, searchable)

    const filterResult = useMemo<FilteredComboboxOptions<TValue>>(() => {
        if (!open && !mounted) {
            return { visible: [], totalMatches: 0, truncatedCount: 0 }
        }
        return filterIndexedComboboxOptions(indexedItems, deferredQuery, {
            maxVisible,
            selectedValue: normalizedValue,
        })
    }, [open, mounted, indexedItems, deferredQuery, maxVisible, normalizedValue])

    return (
        <Combobox
            items={collection}
            filteredItems={filterResult.visible}
            filter={null}
            value={normalizedValue}
            onValueChange={(nextValue) =>
                onValueChange((nextValue ?? null) as TValue | null)
            }
            onInputValueChange={(nextInput) => setQuery(nextInput)}
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen)
                if (nextOpen) {
                    setMounted(true)
                } else {
                    setQuery("")
                }
            }}
            onOpenChangeComplete={(nextOpen) => {
                if (!nextOpen) {
                    setMounted(false)
                    setQuery("")
                }
            }}
            autoHighlight={isSearchable}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            name={name}
        >
            <ComboboxTrigger
                id={id}
                aria-label={ariaLabel}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedBy}
                aria-labelledby={ariaLabelledBy}
                data-slot="combobox-select-trigger"
                data-size={size}
                disabled={disabled}
                className={cn(
                    "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                    size === "sm"
                        ? "h-7 rounded-[min(var(--radius-md),10px)]"
                        : "h-8",
                    className,
                )}
            >
                {startIcon}
                <span className="min-w-0 flex-1 truncate text-left">
                    <ComboboxValue placeholder={resolvedPlaceholder} />
                </span>
            </ComboboxTrigger>
            <ComboboxContent
                side={side}
                align={align}
                sideOffset={sideOffset}
                className={cn(
                    isSearchable
                        ? "w-auto min-w-[max(13rem,var(--anchor-width))] max-w-[min(28rem,var(--available-width))]"
                        : "w-(--anchor-width) min-w-[calc(var(--anchor-width)+--spacing(7))] max-w-(--available-width)",
                    contentClassName,
                )}
            >
                {isSearchable && (
                    <ComboboxInput
                        showTrigger={false}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                    />
                )}
                <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
                <ComboboxList>
                    {(item: ComboboxOption<TValue>) => (
                        <ComboboxItem
                            key={String(item.value)}
                            value={item.value}
                            disabled={item.disabled}
                        >
                            <span className="min-w-0 wrap-break-word leading-snug">
                                {item.label}
                            </span>
                        </ComboboxItem>
                    )}
                </ComboboxList>
                {filterResult.truncatedCount > 0 && (
                    <div className="border-t px-2.5 py-1.5 text-xs text-muted-foreground">
                        Showing {filterResult.visible.length} of{" "}
                        {filterResult.totalMatches} matches — type to filter
                    </div>
                )}
            </ComboboxContent>
        </Combobox>
    )
}
