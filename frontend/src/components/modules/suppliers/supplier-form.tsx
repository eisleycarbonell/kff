"use client"

import { useId, useState, type FormEvent } from "react"

import {
    validateSupplier,
    type Supplier,
    type SupplierFormErrors,
    type SupplierFormValues,
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

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    supplier: Supplier | null
    suppliers: Supplier[]
    onSave: (values: SupplierFormValues, supplier: Supplier | null) => Promise<boolean>
    isSaving: boolean
    saveError?: string | null
}

function SupplierFormContent({
    onOpenChange,
    supplier,
    suppliers,
    onSave,
    isSaving,
    saveError,
}: Omit<Props, "open">) {
    const id = useId()
    const [values, setValues] = useState<SupplierFormValues>(() => ({
        name: supplier?.name ?? "",
        email: supplier?.email ?? "",
        isActive: supplier?.isActive ?? true,
    }))
    const [errors, setErrors] = useState<SupplierFormErrors>({})

    function update<Key extends keyof SupplierFormValues>(
        key: Key,
        value: SupplierFormValues[Key],
    ) {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => ({ ...current, [key]: undefined }))
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        const normalized = {
            ...values,
            name: values.name.trim(),
            email: values.email.trim().toLowerCase(),
        }
        const nextErrors = validateSupplier(normalized, suppliers, supplier ?? undefined)
        setErrors(nextErrors)
        const first = Object.keys(nextErrors)[0]
        if (first) {
            document.getElementById(`${id}-${first}`)?.focus()
            return
        }
        if (await onSave(normalized, supplier)) onOpenChange(false)
    }

    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle>{supplier ? "Edit supplier" : "Add supplier"}</DialogTitle>
                <DialogDescription>
                    {supplier
                        ? "Update supplier details and purchasing availability."
                        : "Add a supplier for raw materials, packaging, and labels."}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-5" aria-busy={isSaving}>
                <FieldGroup className="gap-4">
                    <Field data-invalid={Boolean(errors.name)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={`${id}-name`}>Supplier name</FieldLabel>
                        <Input
                            id={`${id}-name`}
                            name="name"
                            autoComplete="organization"
                            value={values.name}
                            onChange={(event) => update("name", event.target.value)}
                            maxLength={100}
                            required
                            disabled={isSaving}
                            className="h-10"
                            aria-invalid={Boolean(errors.name)}
                            aria-describedby={`${id}-name-error`}
                        />
                        <FieldError id={`${id}-name-error`}>{errors.name}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.email)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={`${id}-email`}>
                            Email{" "}
                            <span className="font-normal text-muted-foreground">(optional)</span>
                        </FieldLabel>
                        <Input
                            id={`${id}-email`}
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={values.email}
                            onChange={(event) => update("email", event.target.value)}
                            maxLength={100}
                            disabled={isSaving}
                            className="h-10"
                            aria-invalid={Boolean(errors.email)}
                            aria-describedby={`${id}-email-error`}
                        />
                        <FieldError id={`${id}-email-error`}>{errors.email}</FieldError>
                    </Field>
                    <Field
                        orientation="horizontal"
                        data-disabled={
                            isSaving || (supplier?.isActive && supplier.hasOpenPurchaseOrders)
                        }
                    >
                        <Checkbox
                            id={`${id}-isActive`}
                            checked={values.isActive}
                            disabled={
                                isSaving ||
                                Boolean(supplier?.isActive && supplier.hasOpenPurchaseOrders)
                            }
                            onCheckedChange={(checked) => update("isActive", checked)}
                            aria-describedby={`${id}-status-help`}
                        />
                        <FieldContent>
                            <FieldLabel htmlFor={`${id}-isActive`}>Active supplier</FieldLabel>
                            <FieldDescription id={`${id}-status-help`}>
                                {supplier?.hasOpenPurchaseOrders
                                    ? "Complete or cancel open purchase orders before deactivating this supplier."
                                    : "Deactivating a supplier also disables its item offers and clears preferred status. Reactivation leaves offers disabled until you enable them individually."}
                            </FieldDescription>
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
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? "Saving..." : supplier ? "Save changes" : "Create supplier"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}

export function SupplierForm({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!props.isSaving) onOpenChange(value)
            }}
        >
            {open && (
                <SupplierFormContent
                    key={props.supplier?.supplierId ?? "new"}
                    onOpenChange={onOpenChange}
                    {...props}
                />
            )}
        </Dialog>
    )
}
