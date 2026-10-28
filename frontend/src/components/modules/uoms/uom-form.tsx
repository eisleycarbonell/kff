"use client"
import { useId, useState, type FormEvent } from "react"
import {
    validateUom,
    type Uom,
    type UomClass,
    type UomFormValues,
    type UomFormErrors,
} from "@/components/modules/uoms/uom.schema"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    unit: Uom | null
    units: Uom[]
    classes: UomClass[]
    isSaving: boolean
    onSave: (values: UomFormValues, unit: Uom | null) => Promise<boolean>
}
function UomFormContent({
    onOpenChange,
    unit,
    units,
    classes,
    isSaving,
    onSave,
}: Omit<Props, "open">) {
    const id = useId()
    const locked = Boolean(unit && (unit.isInUse || unit.isClassAnchor))
    const [values, setValues] = useState<UomFormValues>(() => ({
        name: unit?.name ?? "",
        uomClassId: unit?.uomClassId ?? null,
        factorToBase: unit?.factorToBase ?? "1",
        isBase: unit?.isBase ?? false,
    }))
    const [errors, setErrors] = useState<UomFormErrors>({})
    const classItems = [
        { value: null, label: "Select a unit class" },
        ...classes.map((group) => ({ value: group.uomClassId, label: group.name })),
    ]
    const base = units.find(
        (existing) => existing.uomClassId === values.uomClassId && existing.isBase,
    )
    const otherBase = base && base.uomId !== unit?.uomId
    function update<K extends keyof UomFormValues>(field: K, value: UomFormValues[K]) {
        setValues((current) => ({ ...current, [field]: value }))
        setErrors((current) => {
            const next = { ...current }
            delete next[field]
            return next
        })
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        const next = validateUom(values, units, classes, unit)
        setErrors(next)
        const first = Object.keys(next)[0]
        if (first) {
            document.getElementById(id + "-" + first)?.focus()
            return
        }
        if (await onSave(values, unit)) onOpenChange(false)
    }
    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle>{unit ? "Edit unit of measure" : "Add unit of measure"}</DialogTitle>
                <DialogDescription>
                    Group compatible units into a class and define their conversion to its base
                    unit.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} aria-busy={isSaving} className="flex flex-col gap-5">
                <FieldGroup className="gap-4">
                    <Field data-invalid={Boolean(errors.name)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={id + "-name"}>Unit name</FieldLabel>
                        <Input
                            id={id + "-name"}
                            name="name"
                            value={values.name}
                            maxLength={20}
                            required
                            disabled={isSaving}
                            onChange={(event) => update("name", event.target.value)}
                            aria-invalid={Boolean(errors.name)}
                            aria-describedby={id + "-name-error"}
                            className="h-10"
                        />
                        <FieldError id={id + "-name-error"}>{errors.name}</FieldError>
                    </Field>
                    <Field
                        data-invalid={Boolean(errors.uomClassId)}
                        data-disabled={isSaving || locked}
                    >
                        <FieldLabel htmlFor={id + "-uomClassId"}>Unit class</FieldLabel>
                        <Select
                            name="uomClassId"
                            items={classItems}
                            value={values.uomClassId}
                            disabled={isSaving || locked}
                            onValueChange={(value) => {
                                const hasBase = units.some(
                                    (existing) =>
                                        existing.uomClassId === value &&
                                        existing.uomId !== unit?.uomId &&
                                        existing.isBase,
                                )
                                setValues((current) => ({
                                    ...current,
                                    uomClassId: value,
                                    isBase: !hasBase,
                                    factorToBase: "1",
                                }))
                                setErrors({})
                            }}
                        >
                            <SelectTrigger
                                id={id + "-uomClassId"}
                                className="w-full data-[size=default]:h-10"
                                aria-invalid={Boolean(errors.uomClassId)}
                                aria-describedby={id + "-class-error"}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {classes.map((group) => (
                                        <SelectItem key={group.uomClassId} value={group.uomClassId}>
                                            {group.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <FieldError id={id + "-class-error"}>{errors.uomClassId}</FieldError>
                    </Field>
                    <Field
                        orientation="horizontal"
                        data-invalid={Boolean(errors.isBase)}
                        data-disabled={isSaving || locked || Boolean(otherBase)}
                    >
                        <Checkbox
                            id={id + "-isBase"}
                            name="isBase"
                            checked={values.isBase}
                            disabled={isSaving || locked || Boolean(otherBase)}
                            onCheckedChange={(checked) => {
                                update("isBase", checked)
                                if (checked) update("factorToBase", "1")
                            }}
                            aria-describedby={id + "-base-feedback"}
                        />
                        <FieldContent>
                            <FieldLabel htmlFor={id + "-isBase"}>
                                Base unit for this class
                            </FieldLabel>
                            <div id={id + "-base-feedback"}>
                                <FieldDescription>
                                    {otherBase
                                        ? "Base unit: " +
                                          base.name +
                                          ". Other units convert into this unit."
                                        : "Each class starts with one base unit, with a conversion factor of 1."}
                                </FieldDescription>
                                <FieldError>{errors.isBase}</FieldError>
                            </div>
                        </FieldContent>
                    </Field>
                    <Field
                        data-invalid={Boolean(errors.factorToBase)}
                        data-disabled={isSaving || locked || values.isBase}
                    >
                        <FieldLabel htmlFor={id + "-factorToBase"}>Factor to base unit</FieldLabel>
                        <Input
                            id={id + "-factorToBase"}
                            name="factorToBase"
                            value={values.factorToBase}
                            inputMode="decimal"
                            required
                            disabled={isSaving || locked || values.isBase}
                            onChange={(event) => update("factorToBase", event.target.value)}
                            aria-invalid={Boolean(errors.factorToBase)}
                            aria-describedby={id + "-factor-feedback"}
                            className="h-10"
                        />
                        <div id={id + "-factor-feedback"}>
                            <FieldDescription>
                                {base && !values.isBase
                                    ? "1 " +
                                      (values.name || "unit") +
                                      " = " +
                                      (values.factorToBase || "…") +
                                      " " +
                                      base.name
                                    : "Use a positive decimal with up to 8 decimal places."}
                            </FieldDescription>
                            <FieldError>{errors.factorToBase}</FieldError>
                        </div>
                    </Field>
                </FieldGroup>
                {locked && (
                    <FieldDescription>
                        Conversion settings are locked because this unit is referenced or anchors
                        other units in its class. You can correct its name.
                    </FieldDescription>
                )}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving || !classes.length}>
                        {isSaving ? "Saving..." : unit ? "Save changes" : "Create unit"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}
export function UomForm({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!props.isSaving) onOpenChange(value)
            }}
        >
            {open && (
                <UomFormContent
                    key={props.unit?.uomId ?? "new"}
                    onOpenChange={onOpenChange}
                    {...props}
                />
            )}
        </Dialog>
    )
}
