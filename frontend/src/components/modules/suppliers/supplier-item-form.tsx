"use client"

import { useId, useState, type FormEvent } from "react"

import {
    validateSupplierItem,
    type Supplier,
    type SupplierItem,
    type SupplierItemFormErrors,
    type SupplierItemFormValues,
    type SupplierOptions,
} from "@/components/modules/suppliers/supplier.schema"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    supplier: Supplier
    item: SupplierItem | null
    items: SupplierItem[]
    options: SupplierOptions
    onSave: (values: SupplierItemFormValues, item: SupplierItem | null) => Promise<boolean>
    isSaving: boolean
    saveError?: string | null
}

function SupplierItemFormContent({
    onOpenChange,
    supplier,
    item,
    items,
    options,
    onSave,
    isSaving,
    saveError,
}: Omit<Props, "open">) {
    const id = useId()
    const [values, setValues] = useState<SupplierItemFormValues>(() => ({
        itemId: item?.itemId ?? null,
        supplierItemCode: item?.supplierItemCode ?? "",
        defaultUomId: item?.defaultUomId ?? null,
        defaultPrice: item?.defaultPrice ?? "",
        leadTimeDays: item?.leadTimeDays == null ? "" : String(item.leadTimeDays),
        isPreferred: item?.isPreferred ?? false,
        isActive: item?.isActive ?? true,
    }))
    const [errors, setErrors] = useState<SupplierItemFormErrors>({})
    const selectedItem = options.items.find((option) => option.itemId === values.itemId)
    const itemOptions = options.items
        .filter(
            (option) =>
                option.itemId === item?.itemId ||
                (option.isActive &&
                    option.itemType !== "Finished Good" &&
                    !items.some((linked) => linked.itemId === option.itemId)),
        )
        .map((option) => ({ value: option.itemId, label: `${option.sku} · ${option.name}` }))
    const primaryUomName = selectedItem?.primaryUomName ?? item?.primaryUomName
    const uomClassId = selectedItem?.uomClassId ?? item?.uomClassId
    const uomOptions = [
        {
            value: "primary",
            label: primaryUomName ? `Primary unit (${primaryUomName})` : "Item primary unit",
        },
        ...options.uoms
            .filter((unit) => unit.uomClassId === uomClassId)
            .map((unit) => ({ value: String(unit.uomId), label: unit.name })),
    ]
    const canActivate =
        supplier.isActive &&
        selectedItem?.isActive === true &&
        selectedItem.itemType !== "Finished Good"

    function update<Key extends keyof SupplierItemFormValues>(
        key: Key,
        value: SupplierItemFormValues[Key],
    ) {
        setValues((current) => ({
            ...current,
            [key]: value,
            ...(key === "isActive" && !value ? { isPreferred: false } : {}),
            ...(key === "itemId" ? { defaultUomId: null } : {}),
        }))
        setErrors((current) => ({ ...current, [key]: undefined }))
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        const normalized = {
            ...values,
            supplierItemCode: values.supplierItemCode.trim(),
            defaultPrice: values.defaultPrice.trim(),
            leadTimeDays: values.leadTimeDays.trim(),
            isPreferred: values.isActive && values.isPreferred,
        }
        const nextErrors = validateSupplierItem(normalized, options, items, item ?? undefined)
        if (normalized.isActive && !canActivate)
            nextErrors.isActive =
                "Active offers require an active supplier and an active material item."
        setErrors(nextErrors)
        const first = Object.keys(nextErrors)[0]
        if (first) {
            document.getElementById(`${id}-${first}`)?.focus()
            return
        }
        if (await onSave(normalized, item)) onOpenChange(false)
    }

    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle>{item ? "Edit item offer" : "Add supplied item"}</DialogTitle>
                <DialogDescription className="break-words">
                    Set {supplier.name}&apos;s purchasing price, unit, and delivery lead time.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-5" aria-busy={isSaving}>
                <FieldGroup className="gap-4">
                    <Field
                        data-invalid={Boolean(errors.itemId)}
                        data-disabled={isSaving || Boolean(item)}
                    >
                        <FieldLabel htmlFor={`${id}-itemId`}>Material item</FieldLabel>
                        <Select
                            items={itemOptions}
                            value={values.itemId}
                            disabled={isSaving || Boolean(item)}
                            onValueChange={(value) => update("itemId", value)}
                        >
                            <SelectTrigger
                                id={`${id}-itemId`}
                                className="w-full data-[size=default]:h-10"
                                aria-invalid={Boolean(errors.itemId)}
                                aria-describedby={`${id}-item-help`}
                            >
                                <SelectValue
                                    className="min-w-0"
                                    placeholder="Choose a material item"
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {itemOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div id={`${id}-item-help`}>
                            <FieldDescription>
                                {item
                                    ? "The linked item is fixed. Edit this offer to reactivate it or update its terms."
                                    : "Already-linked items can be updated or reactivated from the item list."}
                            </FieldDescription>
                            <FieldError>{errors.itemId}</FieldError>
                        </div>
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                            data-invalid={Boolean(errors.supplierItemCode)}
                            data-disabled={isSaving}
                        >
                            <FieldLabel htmlFor={`${id}-supplierItemCode`}>
                                Supplier item code{" "}
                                <span className="font-normal text-muted-foreground">
                                    (optional)
                                </span>
                            </FieldLabel>
                            <Input
                                id={`${id}-supplierItemCode`}
                                name="supplierItemCode"
                                value={values.supplierItemCode}
                                maxLength={100}
                                disabled={isSaving}
                                onChange={(event) => update("supplierItemCode", event.target.value)}
                                className="h-10"
                                aria-invalid={Boolean(errors.supplierItemCode)}
                                aria-describedby={`${id}-supplierItemCode-error`}
                            />
                            <FieldError id={`${id}-supplierItemCode-error`}>
                                {errors.supplierItemCode}
                            </FieldError>
                        </Field>
                        <Field
                            data-invalid={Boolean(errors.defaultUomId)}
                            data-disabled={isSaving || !values.itemId}
                        >
                            <FieldLabel htmlFor={`${id}-defaultUomId`}>Purchase unit</FieldLabel>
                            <Select
                                items={uomOptions}
                                value={
                                    values.defaultUomId == null
                                        ? "primary"
                                        : String(values.defaultUomId)
                                }
                                disabled={isSaving || !values.itemId}
                                onValueChange={(value) =>
                                    update(
                                        "defaultUomId",
                                        !value || value === "primary" ? null : Number(value),
                                    )
                                }
                            >
                                <SelectTrigger
                                    id={`${id}-defaultUomId`}
                                    className="w-full data-[size=default]:h-10"
                                    aria-invalid={Boolean(errors.defaultUomId)}
                                    aria-describedby={`${id}-uom-help`}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {uomOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div id={`${id}-uom-help`}>
                                <FieldDescription>
                                    Only units compatible with this item are available.
                                </FieldDescription>
                                <FieldError>{errors.defaultUomId}</FieldError>
                            </div>
                        </Field>
                        <Field data-invalid={Boolean(errors.defaultPrice)} data-disabled={isSaving}>
                            <FieldLabel htmlFor={`${id}-defaultPrice`}>
                                Price per purchase unit{" "}
                                <span className="font-normal text-muted-foreground">
                                    (optional)
                                </span>
                            </FieldLabel>
                            <Input
                                id={`${id}-defaultPrice`}
                                name="defaultPrice"
                                inputMode="decimal"
                                value={values.defaultPrice}
                                placeholder="0.0000"
                                maxLength={15}
                                disabled={isSaving}
                                onChange={(event) => update("defaultPrice", event.target.value)}
                                className="h-10"
                                aria-invalid={Boolean(errors.defaultPrice)}
                                aria-describedby={`${id}-defaultPrice-error`}
                            />
                            <FieldError id={`${id}-defaultPrice-error`}>
                                {errors.defaultPrice}
                            </FieldError>
                        </Field>
                        <Field data-invalid={Boolean(errors.leadTimeDays)} data-disabled={isSaving}>
                            <FieldLabel htmlFor={`${id}-leadTimeDays`}>
                                Lead time in days{" "}
                                <span className="font-normal text-muted-foreground">
                                    (optional)
                                </span>
                            </FieldLabel>
                            <Input
                                id={`${id}-leadTimeDays`}
                                name="leadTimeDays"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={2147483647}
                                step={1}
                                value={values.leadTimeDays}
                                disabled={isSaving}
                                onChange={(event) => update("leadTimeDays", event.target.value)}
                                className="h-10"
                                aria-invalid={Boolean(errors.leadTimeDays)}
                                aria-describedby={`${id}-leadTimeDays-error`}
                            />
                            <FieldError id={`${id}-leadTimeDays-error`}>
                                {errors.leadTimeDays}
                            </FieldError>
                        </Field>
                    </div>
                    <Field
                        orientation="horizontal"
                        data-disabled={isSaving || (!canActivate && !values.isActive)}
                    >
                        <Checkbox
                            id={`${id}-isActive`}
                            checked={values.isActive}
                            disabled={isSaving || (!canActivate && !values.isActive)}
                            onCheckedChange={(checked) => update("isActive", checked)}
                            aria-describedby={`${id}-active-help`}
                        />
                        <FieldContent>
                            <FieldLabel htmlFor={`${id}-isActive`}>Active offer</FieldLabel>
                            <FieldDescription id={`${id}-active-help`}>
                                Enable this item for purchasing. The supplier and item must also be
                                active.
                            </FieldDescription>
                            <FieldError>{errors.isActive}</FieldError>
                        </FieldContent>
                    </Field>
                    <Field
                        orientation="horizontal"
                        data-disabled={isSaving || !values.isActive || !canActivate}
                    >
                        <Checkbox
                            id={`${id}-isPreferred`}
                            checked={values.isPreferred}
                            disabled={isSaving || !values.isActive || !canActivate}
                            onCheckedChange={(checked) => update("isPreferred", checked)}
                            aria-describedby={`${id}-preferred-help`}
                        />
                        <FieldContent>
                            <FieldLabel htmlFor={`${id}-isPreferred`}>
                                Preferred supplier for this item
                            </FieldLabel>
                            <FieldDescription id={`${id}-preferred-help`}>
                                An item can have one active preferred supplier. Disable the other
                                preference before switching suppliers.
                            </FieldDescription>
                            <FieldError>{errors.isPreferred}</FieldError>
                        </FieldContent>
                    </Field>
                </FieldGroup>
                {saveError && (
                    <Alert variant="destructive">
                        <AlertDescription>{saveError}</AlertDescription>
                    </Alert>
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
                    <Button type="submit" disabled={isSaving || (!item && !itemOptions.length)}>
                        {isSaving ? "Saving..." : item ? "Save changes" : "Add supplied item"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}

export function SupplierItemForm({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!props.isSaving) onOpenChange(value)
            }}
        >
            {open && (
                <SupplierItemFormContent
                    key={props.item?.supplierItemId ?? "new"}
                    onOpenChange={onOpenChange}
                    {...props}
                />
            )}
        </Dialog>
    )
}
