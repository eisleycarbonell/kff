"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { sanitizeNumericInput } from "@/lib/numeric-input"

export type NumericInputProps = Omit<
    React.ComponentProps<typeof Input>,
    "type" | "inputMode" | "onChange"
> & {
    allowDecimal?: boolean
    allowNegative?: boolean
    maxWholeDigits?: number
    maxDecimalPlaces?: number
    onValueChange?: (value: string) => void
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function NumericInput({
    allowDecimal = true,
    allowNegative = false,
    maxWholeDigits,
    maxDecimalPlaces,
    autoCorrect,
    autoCapitalize,
    spellCheck,
    onValueChange,
    onChange,
    onKeyDown,
    ...props
}: NumericInputProps) {
    const decimalEnabled =
        allowDecimal && (maxDecimalPlaces === undefined || maxDecimalPlaces > 0)

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
            return
        }
        if (event.key.length !== 1) return
        if (/^[0-9]$/.test(event.key)) return

        const input = event.currentTarget
        const start = input.selectionStart ?? input.value.length
        const end = input.selectionEnd ?? start

        if (event.key === "." && decimalEnabled) {
            const existingDot = input.value.indexOf(".")
            if (existingDot === -1 || (existingDot >= start && existingDot < end)) {
                return
            }
        }

        if (event.key === "-" && allowNegative) {
            const existingMinus = input.value.indexOf("-")
            if (start === 0 && (existingMinus === -1 || (existingMinus >= start && existingMinus < end))) {
                return
            }
        }

        event.preventDefault()
    }

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        const sanitized = sanitizeNumericInput(event.target.value, {
            allowDecimal,
            allowNegative,
            maxWholeDigits,
            maxDecimalPlaces,
        })
        if (event.target.value !== sanitized) {
            event.target.value = sanitized
        }
        onValueChange?.(sanitized)
        onChange?.(event)
    }

    return (
        <Input
            {...props}
            type="text"
            inputMode={decimalEnabled ? "decimal" : "numeric"}
            autoCorrect={autoCorrect ?? "off"}
            autoCapitalize={autoCapitalize ?? "none"}
            spellCheck={spellCheck ?? false}
            onKeyDown={handleKeyDown}
            onChange={handleChange}
        />
    )
}
