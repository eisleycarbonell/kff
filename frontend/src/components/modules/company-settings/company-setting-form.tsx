"use client"
import { useState, useId, type FormEvent } from "react"
import { settingsInputSchema, type Settings, type SettingsInput } from "./company-setting.schema"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
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
            expiryWarningDays: Number(v.expiryWarningDays),
        })
        if (!parsed.success) {
            setValidation(parsed.error.issues.map((r) => r.message).join(" "))
            return
        }
        setValidation("")
        try {
            await onSave(parsed.data)
        } catch {}
    }
    return (
        <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-5">
            <fieldset disabled={busy || !canManage} className="grid gap-5 sm:grid-cols-2">
                {(
                    [
                        "companyName",
                        "address",
                        "email",
                        "phone",
                        "currencyCode",
                        "defaultReorderLevel",
                        "expiryWarningDays",
                    ] as const
                ).map((key) => (
                    <Field key={key}>
                        <FieldLabel htmlFor={id + key}>
                            {
                                {
                                    companyName: "Company name",
                                    address: "Address",
                                    email: "Email",
                                    phone: "Phone",
                                    currencyCode: "Currency (ISO code)",
                                    defaultReorderLevel:
                                        "Default reorder level in each primary UOM",
                                    expiryWarningDays: "Expiry warning horizon (days)",
                                }[key]
                            }
                        </FieldLabel>
                        <Input
                            id={id + key}
                            value={v[key]}
                            type={
                                key === "email"
                                    ? "email"
                                    : key === "expiryWarningDays"
                                      ? "number"
                                      : "text"
                            }
                            onChange={(e) => set((v) => ({ ...v, [key]: e.target.value }))}
                        />
                    </Field>
                ))}
            </fieldset>
            <p className="text-sm text-muted-foreground">
                Currency is fixed after priced operational records exist. Reorder overrides take
                precedence over the default.
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
