"use client"
import { useState, useId, type FormEvent } from "react"
import { inputSchema, type RecordDto, type InputDto, type Options } from "./reorder-policy.schema"
import { ChoiceField } from "@/components/shared/choice-field"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Props = {
    record: RecordDto | null
    options: Options
    open: boolean
    onOpenChange: (v: boolean) => void
    busy: boolean
    error?: string
    onSave: (v: InputDto) => Promise<boolean>
}
function Content(p: Props) {
    const uid = useId(),
        [v, set] = useState({
            itemId: p.record?.itemId ?? 0,
            reorderLevel: p.record?.reorderLevel ?? "",
        }),
        [error, setError] = useState("")
    const item = p.options.items.find((r) => r.itemId === v.itemId)
    function field(key: keyof typeof v, label: string, required = true) {
        return (
            <Field>
                <FieldLabel htmlFor={uid + key}>{label}</FieldLabel>
                <Input
                    id={uid + key}
                    value={String(v[key])}
                    required={required}
                    onChange={(e) => set((v) => ({ ...v, [key]: e.target.value }))}
                />
            </Field>
        )
    }
    async function submit(e: FormEvent) {
        e.preventDefault()
        if (p.busy) return
        const parsed = inputSchema.safeParse(v)
        if (!parsed.success) {
            setError(parsed.error.issues.map((r) => r.message).join(" "))
            return
        }
        setError("")
        await p.onSave(parsed.data)
    }
    return (
        <form onSubmit={submit} className="min-w-0 space-y-4">
            <fieldset className="min-w-0 space-y-4" disabled={p.busy}>
                <ChoiceField
                    label="Item"
                    value={String(v.itemId || "")}
                    disabled={Boolean(p.record)}
                    onChange={(value) => set((v) => ({ ...v, itemId: Number(value) }))}
                    choices={p.options.items
                        .filter((r) => r.isActive || r.itemId === v.itemId)
                        .map((r) => ({ value: String(r.itemId), label: r.sku + " · " + r.name }))}
                />
                {field("reorderLevel", "Reorder level in primary UOM")}
                <p className="text-sm text-muted-foreground">
                    Primary UOM: {item?.primaryUomName ?? "Select an item"}. Items without an
                    override use the company default.
                </p>
            </fieldset>
            {(error || p.error) && (
                <p role="alert" className="text-sm text-destructive">
                    {error || p.error}
                </p>
            )}
            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    disabled={p.busy}
                    onClick={() => p.onOpenChange(false)}
                >
                    Cancel
                </Button>
                <Button disabled={p.busy}>{p.busy ? "Saving…" : "Save"}</Button>
            </DialogFooter>
        </form>
    )
}
export default function Form(p: Props) {
    return (
        <Dialog
            open={p.open}
            onOpenChange={(v) => {
                if (!p.busy) p.onOpenChange(v)
            }}
        >
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{p.record ? "Edit" : "Add"} Reorder Levels</DialogTitle>
                    <DialogDescription>Maintain operational master data.</DialogDescription>
                </DialogHeader>
                {p.open && <Content key={p.record?.itemId ?? "new"} {...p} />}
            </DialogContent>
        </Dialog>
    )
}
