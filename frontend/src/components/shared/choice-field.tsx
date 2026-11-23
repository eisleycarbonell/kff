"use client"
import { useId } from "react"
import { Field, FieldLabel } from "@/components/ui/field"
import { ComboboxSelect, type ComboboxOption } from "@/components/shared/combobox-select"
export function ChoiceField({
    label,
    value,
    onChange,
    choices,
    disabled = false,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    choices: ComboboxOption[]
    disabled?: boolean
}) {
    const id = useId()
    return (
        <Field className="min-w-0">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <ComboboxSelect
                id={id}
                items={choices}
                value={value || null}
                onValueChange={(v) => onChange(v ?? "")}
                disabled={disabled}
                placeholder="Choose…"
                className="h-10 w-full min-w-0 overflow-hidden"
            />
        </Field>
    )
}
