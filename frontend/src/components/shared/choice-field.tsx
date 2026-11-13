"use client"
import { useId } from "react"
import { Field, FieldLabel } from "@/components/ui/field"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"
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
    choices: { value: string; label: string }[]
    disabled?: boolean
}) {
    const id = useId()
    return (
        <Field className="min-w-0">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Select
                items={choices}
                value={value || null}
                onValueChange={(v) => onChange(v ?? "")}
                disabled={disabled}
            >
                <SelectTrigger id={id} className="w-full min-w-0 overflow-hidden data-[size=default]:h-10">
                    <SelectValue className="min-w-0 truncate" placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                    {choices.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                            {c.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </Field>
    )
}
