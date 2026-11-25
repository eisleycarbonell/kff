"use client"
import { useState, useId, type FormEvent } from "react"
import { settingsInputSchema, type Settings, type SettingsInput } from "./company-setting.schema"
import { ComboboxSelect } from "@/components/shared/combobox-select"
import { NumericInput } from "@/components/shared/numeric-input"
import { ENTRY_CURRENCIES } from "@/lib/price-currency"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"

const CURRENCY_SETTING_OPTIONS = ENTRY_CURRENCIES.map((currency) => ({
    value: currency.value,
    label: `${currency.value} · ${currency.name} (${currency.symbol})`,
}))
export default function SettingsForm({
    settings,
    busy,
    error,
    canManage,
    onSave,
}: {
    settings: Settings
    busy: boolean
    error?: string
    canManage: boolean
    onSave: (v: SettingsInput) => Promise<unknown>
}) {
    const id = useId(),
        [v, set] = useState({
            ...settings,
            address: settings.address ?? "",
            email: settings.email ?? "",
            phone: settings.phone ?? "",
            expiryWarningDays: String(settings.expiryWarningDays),
            vatRatePercent: settings.vatRatePercent ?? "12.00",
        }),
        [validation, setValidation] = useState("")
    async function submit(e: FormEvent) {
        e.preventDefault()
        if (busy) return
        const parsed = settingsInputSchema.safeParse({
            expectedVersion: settings.version,
            companyName: v.companyName,
            address: v.address || null,
            email: v.email || null,
            phone: v.phone || null,
            currencyCode: v.currencyCode,
            defaultReorderLevel: v.defaultReorderLevel,
            expiryWarningDays:
                v.expiryWarningDays.trim() === "" ? Number.NaN : Number(v.expiryWarningDays),
            vatRatePercent: v.vatRatePercent,
        })
        if (!parsed.success) {
            setValidation(parsed.error.issues.map((r) => r.message).join(" "))
            return
        }
        setValidation("")
        try {
            await onSave(parsed.data)
        } catch { }
    }
    const currencyItems = CURRENCY_SETTING_OPTIONS.some(
        (option) => option.value === v.currencyCode,
    )
        ? CURRENCY_SETTING_OPTIONS
        : [
            ...CURRENCY_SETTING_OPTIONS,
            { value: v.currencyCode, label: v.currencyCode },
        ]
    return (
        <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
            <fieldset
                disabled={busy || !canManage}
                className="grid gap-5 @2xl/main:grid-cols-2 [&>*]:min-w-0"
            >
                {(
                    [
                        "companyName",
                        "address",
                        "email",
                        "phone",
                        "currencyCode",
                        "defaultReorderLevel",
                        "expiryWarningDays",
                        "vatRatePercent",
                    ] as const
                ).map((key) => (
                    <Field key={key} className="min-w-0">
                        <FieldLabel htmlFor={id + key}>
                            {
                                {
                                    companyName: "Company name",
                                    address: "Address",
                                    email: "Email",
                                    phone: "Phone",
                                    currencyCode: "Operating currency",
                                    defaultReorderLevel:
                                        "Default reorder level in each primary UOM",
                                    expiryWarningDays: "Expiry warning horizon (days)",
                                    vatRatePercent: "Default VAT rate (%)",
                                }[key]
                            }
                        </FieldLabel>
                        {key === "currencyCode" ? (
                            <ComboboxSelect
                                id={id + key}
                                items={currencyItems}
                                value={v.currencyCode}
                                onValueChange={(next) => {
                                    if (next) set((curr) => ({ ...curr, currencyCode: next }))
                                }}
                                disabled={busy || !canManage}
                                searchable={false}
                                className="h-9 w-full"
                            />
                        ) : key === "defaultReorderLevel" ||
                          key === "expiryWarningDays" ||
                          key === "vatRatePercent" ? (
                            <NumericInput
                                id={id + key}
                                value={v[key]}
                                allowDecimal={key !== "expiryWarningDays"}
                                maxWholeDigits={
                                    key === "vatRatePercent"
                                        ? 3
                                        : key === "expiryWarningDays"
                                          ? 4
                                          : 10
                                }
                                maxDecimalPlaces={
                                    key === "vatRatePercent"
                                        ? 2
                                        : key === "defaultReorderLevel"
                                          ? 4
                                          : 0
                                }
                                placeholder={key === "vatRatePercent" ? "12.00" : undefined}
                                onValueChange={(next) =>
                                    set((curr) => ({ ...curr, [key]: next }))
                                }
                            />
                        ) : (
                            <Input
                                id={id + key}
                                value={v[key]}
                                autoComplete={key === "phone" ? "tel" : undefined}
                                type={
                                    key === "email" ? "email" : key === "phone" ? "tel" : "text"
                                }
                                onChange={(e) => set((v) => ({ ...v, [key]: e.target.value }))}
                            />
                        )}
                    </Field>
                ))}
            </fieldset>
            <p className="text-sm text-muted-foreground">
                Currency is fixed after priced operational records exist. Reorder overrides take
                precedence over the default, and the VAT rate pre-fills VATable items on new
                orders without modifying existing documents.
            </p>
            {(validation || error) && (
                <p className="text-destructive" role="alert">
                    {validation || error}
                </p>
            )}
            {canManage && <Button disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>}
        </form>
    )
}
