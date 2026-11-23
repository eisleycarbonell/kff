"use client"

import { ComboboxSelect } from "@/components/shared/combobox-select"
import { NumericInput } from "@/components/shared/numeric-input"
import {
    ENTRY_CURRENCIES,
    currencySymbol,
    isForeignCurrency,
    normalizeCurrencyCode,
    type EntryCurrencyCode,
} from "@/lib/price-currency"
import { cn } from "cn"

const CURRENCY_SELECT_ITEMS = ENTRY_CURRENCIES.map((entry) => ({
    value: entry.value,
    label: entry.label,
}))

type PriceCurrencyInputProps = {
    id: string
    name?: string
    value: string
    currency: EntryCurrencyCode
    baseCurrency?: string | null
    convertedValue: string | null
    onValueChange: (value: string) => void
    onCurrencyChange: (currency: EntryCurrencyCode) => void
    disabled?: boolean
    required?: boolean
    maxLength?: number
    placeholder?: string
    currencyAriaLabel?: string
    className?: string
    "aria-invalid"?: boolean | "true" | "false"
    "aria-describedby"?: string
}

export function PriceCurrencyInput({
    id,
    name,
    value,
    currency,
    baseCurrency,
    convertedValue,
    onValueChange,
    onCurrencyChange,
    disabled = false,
    required = false,
    maxLength = 15,
    placeholder = "0.00",
    currencyAriaLabel = "Price currency",
    className,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
}: PriceCurrencyInputProps) {
    const normalizedBase = normalizeCurrencyCode(baseCurrency)
    const foreign = isForeignCurrency(currency, normalizedBase)
    const trimmed = value.trim()

    return (
        <div className={cn("min-w-0 space-y-1.5", className)}>
            <div className="flex min-w-0 items-center gap-2">
                <ComboboxSelect
                    aria-label={currencyAriaLabel}
                    items={CURRENCY_SELECT_ITEMS}
                    value={currency}
                    onValueChange={(next) => {
                        if (next) onCurrencyChange(next)
                    }}
                    disabled={disabled}
                    searchable={false}
                    className="h-10 w-28 shrink-0"
                />
                <NumericInput
                    id={id}
                    name={name}
                    allowDecimal
                    maxWholeDigits={10}
                    maxDecimalPlaces={4}
                    maxLength={maxLength}
                    required={required}
                    placeholder={placeholder}
                    value={value}
                    disabled={disabled}
                    onValueChange={onValueChange}
                    aria-invalid={ariaInvalid}
                    aria-describedby={ariaDescribedBy}
                    className="h-10 min-w-0 flex-1"
                />
            </div>
            {foreign && (
                <p className="text-xs text-muted-foreground tabular-nums">
                    {trimmed === ""
                        ? `Will convert from ${currency} to ${normalizedBase}.`
                        : convertedValue
                          ? `Converted: ${currencySymbol(normalizedBase)}${convertedValue} (${normalizedBase})`
                          : `Enter a valid exchange rate to convert to ${normalizedBase}.`}
                </p>
            )}
        </div>
    )
}
