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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
    const uid = useId()
    const [v, set] = useState({
        codeName: p.record?.codeName ?? "",
        category: p.record?.category ?? ("Inventory Adjustment" as InputDto["category"]),
        description: p.record?.description ?? "",
        isActive: p.record?.isActive ?? true,
    })
    const [error, setError] = useState("")

    async function submit(e: FormEvent) {
        e.preventDefault()
        if (p.busy) return
        const parsed = inputSchema.safeParse({
            codeName: v.codeName,
            category: v.category,
            description: v.description.trim() || null,
            isActive: v.isActive,
        })
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
                <Field>
                    <FieldLabel htmlFor={`${uid}codeName`}>Reason code</FieldLabel>
                    <Input
                        id={`${uid}codeName`}
                        value={v.codeName}
                        maxLength={50}
                        placeholder="e.g. Physical Count"
                        required
                        onChange={(e) => set((prev) => ({ ...prev, codeName: e.target.value }))}
                    />
                </Field>
                <div className="min-w-0 space-y-1">
                    <ChoiceField
                        label="Category"
                        value={v.category}
                        onChange={(value) =>
                            set((prev) => ({
                                ...prev,
                                category: value as InputDto["category"],
                            }))
                        }
                        choices={CATEGORIES.map((value) => ({ value, label: value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                        Use Inventory Adjustment for stock count corrections and other categories
                        for Scrap & Disposal. Referenced categories cannot be changed later.
                    </p>
                </div>
                <Field>
                    <FieldLabel htmlFor={`${uid}description`}>Description</FieldLabel>
                    <Textarea
                        id={`${uid}description`}
                        value={v.description}
                        maxLength={2000}
                        rows={3}
                        placeholder="Optional guidance on when operators should choose this reason"
                        onChange={(e) => set((prev) => ({ ...prev, description: e.target.value }))}
                    />
                    <FieldDescription>Optional (up to 2000 characters).</FieldDescription>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={v.isActive}
                        onCheckedChange={(value) =>
                            set((prev) => ({ ...prev, isActive: value === true }))
                        }
                    />
                    Active (available for new adjustments and scrap requests)
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
                <Button type="submit" disabled={p.busy}>
                    {p.busy ? "Saving…" : "Save"}
                </Button>
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
                    <DialogTitle>{p.record ? "Edit reason code" : "Add reason code"}</DialogTitle>
                    <DialogDescription>
                        Configure reason codes for stock adjustments and scrap disposals.
                    </DialogDescription>
                </DialogHeader>
                {p.open && <Content key={p.record?.reasonId ?? "new"} {...p} />}
            </DialogContent>
        </Dialog>
    )
}
