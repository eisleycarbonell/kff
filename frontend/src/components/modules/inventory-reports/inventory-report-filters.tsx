"use client"
import { useId, useState, type FormEvent } from "react"
import {
    ITEM_TYPES,
    QC_STATUSES,
    MOVEMENT_TYPES,
    type ReportFilters,
    type ReportOptions,
} from "./inventory-report.schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
type Props = {
    filters: ReportFilters
    options?: ReportOptions
    optionsError?: string
    retryOptions: () => void
    busy: boolean
    onApply: (value: ReportFilters) => void
}
function FilterSelect({
    label,
    value,
    onChange,
    choices,
    disabled,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    choices: { value: string; label: string }[]
    disabled?: boolean
}) {
    const id = useId()
    const all = [{ value: "all", label: "All" }, ...choices]
    return (
        <Field>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Select
                items={all}
                value={value || "all"}
                onValueChange={(value) => onChange(value === "all" ? "" : (value ?? ""))}
                disabled={disabled}
            >
                <SelectTrigger id={id} className="w-full data-[size=default]:h-10">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {all.map((choice) => (
                        <SelectItem key={choice.value} value={choice.value}>
                            {choice.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </Field>
    )
}
export function InventoryReportFilters({
    filters,
    options,
    optionsError,
    retryOptions,
    busy,
    onApply,
}: Props) {
    const id = useId()
    const [draft, setDraft] = useState<ReportFilters>(filters)
    const [error, setError] = useState<string>()
    const update = (patch: Partial<ReportFilters>) => {
        setDraft((current) => ({ ...current, ...patch }))
        setError(undefined)
    }
    function submit(event: FormEvent) {
        event.preventDefault()
        if (busy) return
        if (
            draft.report === "movement" &&
            draft.fromDate &&
            draft.toDate &&
            draft.fromDate > draft.toDate
        ) {
            setError("End date must be on or after start date.")
            return
        }
        if (
            draft.report === "low-stock" &&
            draft.threshold &&
            !/^\d{1,10}(?:\.\d{1,4})?$/.test(draft.threshold ?? "10")
        ) {
            setError("Use a nonnegative threshold with up to four decimal places.")
            return
        }
        if (
            draft.report === "near-expiry" &&
            (!Number.isInteger(draft.expiryDays ?? 30) ||
                (draft.expiryDays ?? 30) < 0 ||
                (draft.expiryDays ?? 30) > 3650)
        ) {
            setError("Expiry window must be 0 to 3650 days.")
            return
        }
        onApply({ ...draft, q: draft.q?.trim() })
    }
    return (
        <form
            onSubmit={submit}
            className="space-y-4 border-b bg-card p-4"
            aria-label="Inventory report filters"
        >
            {optionsError && (
                <div role="alert" className="text-sm text-destructive">
                    {optionsError}
                    <Button type="button" variant="outline" onClick={retryOptions} className="ml-3">
                        Retry options
                    </Button>
                </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Field>
                    <FieldLabel htmlFor={`${id}-search`}>Search report</FieldLabel>
                    <Input
                        id={`${id}-search`}
                        className="h-10"
                        placeholder="Item, brand, lot or document..."
                        maxLength={200}
                        value={draft.q ?? ""}
                        onChange={(e) => update({ q: e.target.value })}
                    />
                </Field>
                <FilterSelect
                    label="Item / Product"
                    value={String(draft.itemId ?? "")}
                    choices={(options?.items ?? []).map((row) => ({
                        value: String(row.itemId),
                        label: `${row.sku} - ${row.name}`,
                    }))}
                    disabled={!options}
                    onChange={(value) => update({ itemId: value ? Number(value) : undefined })}
                />
                <FilterSelect
                    label="Location"
                    value={String(draft.locationId ?? "")}
                    choices={(options?.locations ?? []).map((row) => ({
                        value: String(row.locationId),
                        label: `${row.code} - ${row.name}`,
                    }))}
                    disabled={!options}
                    onChange={(value) => update({ locationId: value ? Number(value) : undefined })}
                />
                <FilterSelect
                    label="Brand"
                    value={String(draft.brandId ?? "")}
                    choices={(options?.brands ?? []).map((row) => ({
                        value: String(row.brandId),
                        label: row.name,
                    }))}
                    disabled={!options}
                    onChange={(value) => update({ brandId: value ? Number(value) : undefined })}
                />
                <FilterSelect
                    label="Item type"
                    value={draft.itemType ?? ""}
                    choices={ITEM_TYPES.map((value) => ({ value, label: value }))}
                    onChange={(value) =>
                        update({
                            itemType: value ? (value as ReportFilters["itemType"]) : undefined,
                        })
                    }
                />
                {draft.report !== "movement" && (
                    <FilterSelect
                        label="Lot QC status"
                        value={draft.qcStatus ?? ""}
                        choices={QC_STATUSES.map((value) => ({ value, label: value }))}
                        onChange={(value) =>
                            update({
                                qcStatus: value ? (value as ReportFilters["qcStatus"]) : undefined,
                            })
                        }
                    />
                )}
                {draft.report === "low-stock" && (
                    <Field>
                        <FieldLabel htmlFor={`${id}-threshold`}>
                            Available quantity at or below
                        </FieldLabel>
                        <Input
                            id={`${id}-threshold`}
                            inputMode="decimal"
                            value={draft.threshold ?? ""}
                            placeholder="Company / item default"
                            onChange={(e) => update({ threshold: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                            Threshold in each item&apos;s primary unit; active items include those
                            with no stock.
                        </p>
                    </Field>
                )}
                {draft.report === "near-expiry" && (
                    <>
                        <Field>
                            <FieldLabel htmlFor={`${id}-expiry`}>
                                Expiry window override in days (UTC)
                            </FieldLabel>
                            <Input
                                id={`${id}-expiry`}
                                type="number"
                                min={0}
                                max={3650}
                                value={
                                    Number.isNaN(draft.expiryDays) ? "" : (draft.expiryDays ?? "")
                                }
                                placeholder="Company default"
                                onChange={(e) =>
                                    update({
                                        expiryDays:
                                            e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                            />
                        </Field>
                        <Field orientation="horizontal">
                            <Checkbox
                                id={`${id}-expired`}
                                checked={draft.includeExpired ?? true}
                                onCheckedChange={(value) => update({ includeExpired: value })}
                            />
                            <FieldLabel htmlFor={`${id}-expired`}>
                                Include already expired stock
                            </FieldLabel>
                        </Field>
                    </>
                )}
                {draft.report === "movement" && (
                    <>
                        <FilterSelect
                            label="Movement type"
                            value={draft.transactionType ?? ""}
                            choices={MOVEMENT_TYPES.map((value) => ({ value, label: value }))}
                            onChange={(value) =>
                                update({
                                    transactionType: value
                                        ? (value as ReportFilters["transactionType"])
                                        : undefined,
                                })
                            }
                        />
                        {(["fromDate", "toDate"] as const).map((key) => (
                            <Field key={key}>
                                <FieldLabel htmlFor={`${id}-${key}`}>
                                    {key === "fromDate" ? "From date (UTC)" : "Through date (UTC)"}
                                </FieldLabel>
                                <Input
                                    id={`${id}-${key}`}
                                    type="date"
                                    value={draft[key] ?? ""}
                                    onChange={(e) => update({ [key]: e.target.value || undefined })}
                                />
                            </Field>
                        ))}
                    </>
                )}
            </div>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
                <Button className="h-10" disabled={busy} type="submit">
                    {busy ? "Loading..." : "Apply filters"}
                </Button>
                <Button
                    className="h-10"
                    variant="outline"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                        const empty = { report: filters.report }
                        setDraft(empty)
                        setError(undefined)
                        onApply(empty)
                    }}
                >
                    Reset filters
                </Button>
                <p className="text-sm text-muted-foreground">
                    {draft.report === "movement"
                        ? "Dates include the full UTC day. Transfer pairs remain separate ledger entries."
                        : "Current stock only. Available = on hand minus all active outstanding reservations."}
                </p>
            </div>
        </form>
    )
}
