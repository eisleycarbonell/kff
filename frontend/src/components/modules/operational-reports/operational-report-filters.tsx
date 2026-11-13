"use client"
import { useId, useState, type FormEvent } from "react"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChoiceField } from "@/components/shared/choice-field"
import type { Filters, ReportKind } from "./operational-report.schema"
export function ReportFilters({
    kind,
    filters,
    lots,
    busy,
    onApply,
}: {
    kind: ReportKind
    filters: Filters
    lots: { lotId: number; lotNumber: string }[]
    busy: boolean
    onApply: (v: Filters) => void
}) {
    const id = useId(),
        [draft, setDraft] = useState(filters),
        [error, setError] = useState("")
    function submit(e: FormEvent) {
        e.preventDefault()
        if (draft.fromDate && draft.toDate && draft.fromDate > draft.toDate) {
            setError("End date must follow start date.")
            return
        }
        setError("")
        onApply(draft)
    }
    return (
        <form
            onSubmit={submit}
            className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4"
        >
            {kind === "genealogy" ? (
                <ChoiceField
                    label="Trace lot"
                    value={draft.lotId || "all"}
                    onChange={(v) => setDraft((d) => ({ ...d, lotId: v === "all" ? "" : v }))}
                    choices={[
                        { value: "all", label: "All lots" },
                        ...lots.map((r) => ({ value: String(r.lotId), label: r.lotNumber })),
                    ]}
                />
            ) : (
                ["fromDate", "toDate"].map((key) => (
                    <Field key={key}>
                        <FieldLabel htmlFor={id + key}>
                            {key === "fromDate" ? "From date" : "To date"}
                        </FieldLabel>
                        <Input
                            id={id + key}
                            type="date"
                            value={draft[key as keyof Filters]}
                            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                        />
                    </Field>
                ))
            )}
            <Button disabled={busy}>Apply filters</Button>
            <Button
                type="button"
                variant="outline"
                onClick={() => {
                    const empty = { fromDate: "", toDate: "", lotId: "" }
                    setDraft(empty)
                    onApply(empty)
                    setError("")
                }}
            >
                Reset
            </Button>
            {error && (
                <p role="alert" className="text-destructive">
                    {error}
                </p>
            )}
        </form>
    )
}
