"use client"

import { useId, useState, type FormEvent } from "react"
import {
    ITEM_TYPES,
    validateItem,
    type Item,
    type ItemUom,
    type ItemFormValues,
    type ItemFormErrors,
} from "@/components/modules/items/item.schema"
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
    FieldLegend,
    FieldSet,
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
    item: Item | null
    items: Item[]
    uoms: ItemUom[]
    onSave: (values: ItemFormValues, item: Item | null) => Promise<boolean>
    isSaving: boolean
}
const typeItems = ITEM_TYPES.map((value) => ({ value, label: value }))
const textFields: {
    name: "sku" | "name" | "unitCost" | "netWeightG" | "shelfLifeDays"
    label: string
    maxLength?: number
    inputMode?: "decimal" | "numeric"
    description?: string
}[] = [
    { name: "sku", label: "SKU", maxLength: 50 },
    { name: "name", label: "Item / product name", maxLength: 120 },
    {
        name: "unitCost",
        label: "Reference cost",
        inputMode: "decimal",
        description: "Current cost per primary UOM; up to 4 decimal places.",
    },
    {
        name: "netWeightG",
        label: "Net weight (g)",
        inputMode: "decimal",
        description: "Optional net weight, commonly used for finished products.",
    },
    {
        name: "shelfLifeDays",
        label: "Shelf life (days)",
        inputMode: "numeric",
        description: "Optional. Leave empty for materials without a shelf life.",
    },
]

function ItemFormContent({
    onOpenChange,
    item,
    items,
    uoms,
    onSave,
    isSaving,
}: Omit<Props, "open">) {
    const id = useId()
    const [values, setValues] = useState<ItemFormValues>(() => ({
        sku: item?.sku ?? "",
        name: item?.name ?? "",
        itemType: item?.itemType ?? ITEM_TYPES[0],
        primaryUomId: item?.primaryUomId ?? null,
        unitCost: item?.unitCost ?? "0",
        netWeightG: item?.netWeightG ?? "",
        shelfLifeDays: item?.shelfLifeDays?.toString() ?? "",
        requiresQc: item?.requiresQc ?? false,
        isActive: item?.isActive ?? true,
    }))
    const [errors, setErrors] = useState<ItemFormErrors>({})
    const uomItems = [
        { value: null, label: "Select a primary UOM" },
        ...uoms.map((unit) => ({
            value: unit.uomId,
            label: `${unit.name} (${unit.uomClassName})`,
        })),
    ]
    function update<Key extends keyof ItemFormValues>(name: Key, value: ItemFormValues[Key]) {
        setValues((current) => ({ ...current, [name]: value }))
        setErrors((current) => {
            const next = { ...current }
            delete next[name]
            return next
        })
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        const next = validateItem(values, items, uoms, item)
        setErrors(next)
        const first = Object.keys(next)[0]
        if (first) {
            document.getElementById(`${id}-${first}`)?.focus()
            return
        }
        if (await onSave(values, item)) onOpenChange(false)
    }
    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
                <DialogDescription>
                    {item
                        ? "Update catalog details, cost, and availability."
                        : "Add a raw material, packaging item, label, or finished product."}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="flex flex-col gap-5" aria-busy={isSaving}>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    {textFields.map((field) => (
                        <Field
                            key={field.name}
                            data-invalid={Boolean(errors[field.name])}
                            data-disabled={isSaving}
                        >
                            <FieldLabel htmlFor={`${id}-${field.name}`}>{field.label}</FieldLabel>
                            <Input
                                id={`${id}-${field.name}`}
                                name={field.name}
                                value={values[field.name]}
                                inputMode={field.inputMode}
                                type={field.name === "shelfLifeDays" ? "number" : "text"}
                                min={field.name === "shelfLifeDays" ? 1 : undefined}
                                step={field.name === "shelfLifeDays" ? 1 : undefined}
                                maxLength={field.maxLength}
                                required={
                                    field.name === "sku" ||
                                    field.name === "name" ||
                                    field.name === "unitCost"
                                }
                                disabled={isSaving}
                                onChange={(event) => update(field.name, event.target.value)}
                                aria-invalid={Boolean(errors[field.name])}
                                aria-describedby={`${id}-${field.name}-feedback`}
                                className="h-10"
                            />
                            <div id={`${id}-${field.name}-feedback`}>
                                {field.description && (
                                    <FieldDescription>{field.description}</FieldDescription>
                                )}
                                <FieldError>{errors[field.name]}</FieldError>
                            </div>
                        </Field>
                    ))}
                    <Field
                        data-invalid={Boolean(errors.itemType)}
                        data-disabled={isSaving || item?.isInUse}
                    >
                        <FieldLabel htmlFor={`${id}-itemType`}>Item type</FieldLabel>
                        <Select
                            name="itemType"
                            items={typeItems}
                            value={values.itemType}
                            disabled={isSaving || item?.isInUse}
                            onValueChange={(value) => {
                                if (value) update("itemType", value)
                            }}
                        >
                            <SelectTrigger
                                id={`${id}-itemType`}
                                className="w-full data-[size=default]:h-10"
                                aria-invalid={Boolean(errors.itemType)}
                                aria-describedby={`${id}-itemType-feedback`}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {typeItems.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <FieldError id={`${id}-itemType-feedback`}>{errors.itemType}</FieldError>
                    </Field>
                    <Field
                        data-invalid={Boolean(errors.primaryUomId)}
                        data-disabled={isSaving || item?.isInUse}
                    >
                        <FieldLabel htmlFor={`${id}-primaryUomId`}>
                            Primary unit of measure
                        </FieldLabel>
                        <Select
                            name="primaryUomId"
                            items={uomItems}
                            value={values.primaryUomId}
                            disabled={isSaving || item?.isInUse}
                            onValueChange={(value) => update("primaryUomId", value)}
                        >
                            <SelectTrigger
                                id={`${id}-primaryUomId`}
                                className="w-full data-[size=default]:h-10"
                                aria-invalid={Boolean(errors.primaryUomId)}
                                aria-describedby={`${id}-primaryUomId-feedback`}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {uomItems
                                        .filter((option) => option.value !== null)
                                        .map((option) => (
                                            <SelectItem key={option.value} value={option.value!}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <FieldError id={`${id}-primaryUomId-feedback`}>
                            {errors.primaryUomId}
                        </FieldError>
                    </Field>
                </FieldGroup>
                {item?.isInUse && (
                    <FieldDescription>
                        Type and primary UOM are locked because this item is referenced by other
                        records.
                    </FieldDescription>
                )}
                <FieldSet>
                    <FieldLegend variant="label">Availability and quality</FieldLegend>
                    <FieldGroup className="gap-4">
                        <Field orientation="horizontal" data-disabled={isSaving}>
                            <Checkbox
                                id={`${id}-active`}
                                name="isActive"
                                checked={values.isActive}
                                disabled={isSaving}
                                onCheckedChange={(checked) => update("isActive", checked)}
                                aria-describedby={`${id}-active-description`}
                            />
                            <FieldContent>
                                <FieldLabel htmlFor={`${id}-active`}>Active item</FieldLabel>
                                <FieldDescription id={`${id}-active-description`}>
                                    Enable this item for operational use. Inactive items remain in
                                    historical records.
                                </FieldDescription>
                            </FieldContent>
                        </Field>
                        <Field orientation="horizontal" data-disabled={isSaving}>
                            <Checkbox
                                id={`${id}-qc`}
                                name="requiresQc"
                                checked={values.requiresQc}
                                disabled={isSaving}
                                onCheckedChange={(checked) => update("requiresQc", checked)}
                                aria-describedby={`${id}-qc-description`}
                            />
                            <FieldContent>
                                <FieldLabel htmlFor={`${id}-qc`}>Requires quality check</FieldLabel>
                                <FieldDescription id={`${id}-qc-description`}>
                                    Received lots require quality approval before use.
                                </FieldDescription>
                            </FieldContent>
                        </Field>
                    </FieldGroup>
                </FieldSet>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? "Saving..." : item ? "Save changes" : "Create item"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}
export function ItemForm({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!props.isSaving) onOpenChange(value)
            }}
        >
            {open && (
                <ItemFormContent
                    key={props.item?.itemId ?? "new"}
                    onOpenChange={onOpenChange}
                    {...props}
                />
            )}
        </Dialog>
    )
}
