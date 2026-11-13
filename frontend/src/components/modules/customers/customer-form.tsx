"use client"

import { useId, useState, type FormEvent } from "react"

import {
    validateCustomer,
    type Customer,
    type CustomerFormErrors,
    type CustomerFormValues,
} from "@/components/modules/customers/customer.schema"
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
import { Textarea } from "@/components/ui/textarea"

type CustomerFormProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    customer: Customer | null
    onSave: (values: CustomerFormValues, customer: Customer | null) => Promise<boolean>
    isSaving?: boolean
    error?: string | null
}

function CustomerFormContent({
    onOpenChange,
    customer,
    onSave,
    isSaving = false,
    error,
}: Omit<CustomerFormProps, "open">) {
    const id = useId()
    const [values, setValues] = useState<CustomerFormValues>(() => ({
        name: customer?.name ?? "",
        contactName: customer?.contactName ?? "",
        email: customer?.email ?? "",
        phone: customer?.phone ?? "",
        address: customer?.address ?? "",
        notes: customer?.notes ?? "",
        isActive: customer?.isActive ?? true,
    }))
    const [errors, setErrors] = useState<CustomerFormErrors>({})

    function update<Key extends keyof CustomerFormValues>(key: Key, value: CustomerFormValues[Key]) {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => ({ ...current, [key]: undefined }))
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        const normalized: CustomerFormValues = {
            ...values,
            name: values.name.trim(),
            contactName: values.contactName.trim(),
            email: values.email.trim().toLowerCase(),
            phone: values.phone.trim(),
            address: values.address.trim(),
            notes: values.notes.trim(),
        }
        const nextErrors = validateCustomer(normalized)
        setErrors(nextErrors)
        const firstInvalidField = Object.keys(nextErrors)[0]
        if (firstInvalidField) {
            document.getElementById(`${id}-${firstInvalidField}`)?.focus()
            return
        }
        if (await onSave(normalized, customer)) onOpenChange(false)
    }

    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle>{customer ? "Edit customer" : "Add customer"}</DialogTitle>
                <DialogDescription>
                    {customer
                        ? "Update customer details, contact information, and status."
                        : "Create a customer record with their contact information."}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-5" aria-busy={isSaving} noValidate>
                <FieldGroup className="gap-4">
                    <Field data-invalid={Boolean(errors.name)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={`${id}-name`}>Customer name</FieldLabel>
                        <Input
                            id={`${id}-name`}
                            name="name"
                            autoComplete="organization"
                            value={values.name}
                            onChange={(event) => update("name", event.target.value)}
                            maxLength={120}
                            required
                            disabled={isSaving}
                            className="h-10"
                            aria-invalid={Boolean(errors.name)}
                            aria-describedby={errors.name ? `${id}-name-error` : undefined}
                        />
                        <FieldError id={`${id}-name-error`}>{errors.name}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.contactName)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={`${id}-contactName`}>
                            Contact person <span className="font-normal text-muted-foreground">(optional)</span>
                        </FieldLabel>
                        <Input
                            id={`${id}-contactName`}
                            name="contactName"
                            autoComplete="name"
                            value={values.contactName}
                            onChange={(event) => update("contactName", event.target.value)}
                            maxLength={100}
                            disabled={isSaving}
                            className="h-10"
                            aria-invalid={Boolean(errors.contactName)}
                            aria-describedby={errors.contactName ? `${id}-contactName-error` : undefined}
                        />
                        <FieldError id={`${id}-contactName-error`}>{errors.contactName}</FieldError>
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field data-invalid={Boolean(errors.email)} data-disabled={isSaving}>
                            <FieldLabel htmlFor={`${id}-email`}>
                                Email <span className="font-normal text-muted-foreground">(optional)</span>
                            </FieldLabel>
                            <Input
                                id={`${id}-email`}
                                name="email"
                                type="email"
                                autoComplete="email"
                                value={values.email}
                                onChange={(event) => update("email", event.target.value)}
                                maxLength={254}
                                disabled={isSaving}
                                className="h-10"
                                aria-invalid={Boolean(errors.email)}
                                aria-describedby={errors.email ? `${id}-email-error` : undefined}
                            />
                            <FieldError id={`${id}-email-error`}>{errors.email}</FieldError>
                        </Field>
                        <Field data-invalid={Boolean(errors.phone)} data-disabled={isSaving}>
                            <FieldLabel htmlFor={`${id}-phone`}>
                                Phone <span className="font-normal text-muted-foreground">(optional)</span>
                            </FieldLabel>
                            <Input
                                id={`${id}-phone`}
                                name="phone"
                                type="tel"
                                autoComplete="tel"
                                value={values.phone}
                                onChange={(event) => update("phone", event.target.value)}
                                maxLength={40}
                                disabled={isSaving}
                                className="h-10"
                                aria-invalid={Boolean(errors.phone)}
                                aria-describedby={errors.phone ? `${id}-phone-error` : undefined}
                            />
                            <FieldError id={`${id}-phone-error`}>{errors.phone}</FieldError>
                        </Field>
                    </div>
                    <Field data-invalid={Boolean(errors.address)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={`${id}-address`}>
                            Address <span className="font-normal text-muted-foreground">(optional)</span>
                        </FieldLabel>
                        <Textarea
                            id={`${id}-address`}
                            name="address"
                            autoComplete="street-address"
                            value={values.address}
                            onChange={(event) => update("address", event.target.value)}
                            maxLength={500}
                            rows={2}
                            disabled={isSaving}
                            aria-invalid={Boolean(errors.address)}
                            aria-describedby={errors.address ? `${id}-address-error` : undefined}
                        />
                        <FieldError id={`${id}-address-error`}>{errors.address}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.notes)} data-disabled={isSaving}>
                        <FieldLabel htmlFor={`${id}-notes`}>
                            Notes <span className="font-normal text-muted-foreground">(optional)</span>
                        </FieldLabel>
                        <Textarea
                            id={`${id}-notes`}
                            name="notes"
                            value={values.notes}
                            onChange={(event) => update("notes", event.target.value)}
                            maxLength={2000}
                            rows={3}
                            disabled={isSaving}
                            aria-invalid={Boolean(errors.notes)}
                            aria-describedby={errors.notes ? `${id}-notes-error` : undefined}
                        />
                        <FieldError id={`${id}-notes-error`}>{errors.notes}</FieldError>
                    </Field>
                    <Field orientation="horizontal" data-disabled={isSaving} className="rounded-lg border p-3">
                        <Checkbox
                            id={`${id}-isActive`}
                            name="isActive"
                            checked={values.isActive}
                            disabled={isSaving}
                            onCheckedChange={(checked) => update("isActive", checked)}
                            aria-describedby={`${id}-status-help`}
                        />
                        <FieldContent>
                            <FieldLabel htmlFor={`${id}-isActive`}>Active customer</FieldLabel>
                            <FieldDescription id={`${id}-status-help`}>
                                Inactive customers stay in your directory and can be reactivated later.
                            </FieldDescription>
                        </FieldContent>
                    </Field>
                </FieldGroup>
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <DialogFooter>
                    <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? "Saving..." : customer ? "Save changes" : "Create customer"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}

export function CustomerForm({ open, onOpenChange, ...props }: CustomerFormProps) {
    return (
        <Dialog open={open} onOpenChange={(value) => {
            if (!props.isSaving) onOpenChange(value)
        }}>
            {open && (
                <CustomerFormContent
                    key={props.customer?.customerId ?? "new"}
                    onOpenChange={onOpenChange}
                    {...props}
                />
            )}
        </Dialog>
    )
}
