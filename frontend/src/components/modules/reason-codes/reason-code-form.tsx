"use client"
import { useState, useId, type FormEvent } from "react"
import {
    inputSchema,
    CATEGORIES,
    type RecordDto,
    type InputDto,
} from "./reason-code.schema"
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
import { Checkbox } from "@/components/ui/checkbox"
type Props = {
    record: RecordDto | null
    open: boolean
    onOpenChange: (v: boolean) => void
    busy: boolean
    error?: string
    onSave: (v: InputDto) => Promise<boolean>
}
function Content(p: Props) {
    const uid = useId(),
        [v, set] = useState({
            codeName: p.record?.codeName ?? "",
            category: p.record?.category ?? "Other",
            description: p.record?.description ?? "",
            isActive: p.record?.isActive ?? true,
        }),
        [error, setError] = useState("")
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
        const parsed = inputSchema.safeParse({ ...v, description: v.description || null })
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
                {field("codeName", "Reason code")}
                {field("description", "Description", false)}
                <ChoiceField
                    label="Category"
                    value={v.category}
                    onChange={(value) =>
                        set((v) => ({ ...v, category: value as typeof v.category }))
                    }
                    choices={CATEGORIES.map((value) => ({ value, label: value }))}
                />
                <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={v.isActive}
                        onCheckedChange={(value) =>
                            set((v) => ({ ...v, isActive: value === true }))
                        }
                    />
                    Active
                </label>
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
                    <DialogTitle>{p.record ? "Edit" : "Add"} Reason Codes</DialogTitle>
                    <DialogDescription>Maintain operational master data.</DialogDescription>
                </DialogHeader>
                {p.open && <Content key={p.record?.reasonId ?? "new"} {...p} />}
            </DialogContent>
        </Dialog>
    )
}
