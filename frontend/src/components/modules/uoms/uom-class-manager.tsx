"use client"
import { useId, useState, type FormEvent } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { uomClassInputSchema, type UomClass } from "@/components/modules/uoms/uom.schema"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    classes: UomClass[]
    isSaving: boolean
    isDeleting: boolean
    onSave: (name: string, group: UomClass | null) => Promise<boolean>
    onDelete: (group: UomClass) => void
}
function ClassManagerContent({
    onOpenChange,
    classes,
    isSaving,
    isDeleting,
    onSave,
    onDelete,
}: Omit<Props, "open">) {
    const id = useId()
    const [editingId, setEditingId] = useState<number | null>(null)
    const [name, setName] = useState("")
    const [error, setError] = useState("")
    const busy = isSaving || isDeleting
    const editing = classes.find((group) => group.uomClassId === editingId) ?? null
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy) return
        const parsed = uomClassInputSchema.safeParse({ name })
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Enter a class name.")
            return
        }
        if (
            classes.some(
                (group) => group.uomClassId !== editingId && group.name === parsed.data.name,
            )
        ) {
            setError("A class with this name already exists.")
            return
        }
        if (await onSave(parsed.data.name, editing)) {
            setName("")
            setEditingId(null)
            setError("")
        }
    }
    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
            showCloseButton={!busy}
        >
            <DialogHeader>
                <DialogTitle>Unit classes</DialogTitle>
                <DialogDescription>
                    Keep compatible units in the same class. Add a class, then create its base unit
                    before adding conversions.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} aria-busy={isSaving} className="flex flex-col gap-3">
                <Field data-invalid={Boolean(error)} data-disabled={busy}>
                    <FieldLabel htmlFor={id + "-name"}>
                        {editing ? "Rename " + editing.name : "New class name"}
                    </FieldLabel>
                    <Input
                        id={id + "-name"}
                        name="name"
                        required
                        maxLength={30}
                        value={name}
                        disabled={busy}
                        onChange={(event) => {
                            setName(event.target.value)
                            setError("")
                        }}
                        aria-invalid={Boolean(error)}
                        aria-describedby={id + "-error"}
                        className="h-10"
                    />
                    <FieldError id={id + "-error"}>{error}</FieldError>
                </Field>
                <div className="flex gap-2">
                    <Button type="submit" disabled={busy}>
                        {isSaving ? "Saving..." : editing ? "Save class" : "Add class"}
                    </Button>
                    {editing && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                                setEditingId(null)
                                setName("")
                                setError("")
                            }}
                        >
                            Cancel rename
                        </Button>
                    )}
                </div>
            </form>
            <div className="overflow-hidden rounded-lg border">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>Class</TableHead>
                            <TableHead>Units</TableHead>
                            <TableHead>Base unit</TableHead>
                            <TableHead>
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {classes.length ? (
                            classes.map((group) => (
                                <TableRow key={group.uomClassId}>
                                    <TableCell className="font-medium">{group.name}</TableCell>
                                    <TableCell>{group.unitCount}</TableCell>
                                    <TableCell>
                                        {group.baseUomName ?? "Awaiting base unit"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={"Rename " + group.name}
                                            disabled={busy}
                                            onClick={() => {
                                                setEditingId(group.uomClassId)
                                                setName(group.name)
                                                setError("")
                                                document.getElementById(id + "-name")?.focus()
                                            }}
                                        >
                                            <Pencil />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={"Delete " + group.name}
                                            disabled={busy || group.unitCount > 0}
                                            onClick={() => onDelete(group)}
                                        >
                                            <Trash2 />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    No unit classes yet. Add the first class above.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <FieldDescription>
                Only empty classes can be deleted. Renaming a class keeps existing unit conversions.
            </FieldDescription>
            <DialogFooter>
                <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
                    Done
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}
export function UomClassManager({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!props.isSaving && !props.isDeleting) onOpenChange(value)
            }}
        >
            {open && <ClassManagerContent onOpenChange={onOpenChange} {...props} />}
        </Dialog>
    )
}
