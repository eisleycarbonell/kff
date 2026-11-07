"use client"
import { useId, useState, type FormEvent } from "react"
import {
    validateBrand,
    type Brand,
    type BrandFormErrors,
    type BrandFormValues,
} from "@/components/modules/brands/brand.schema"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    brand: Brand | null
    isSaving: boolean
    error: string | null
    onSave: (values: BrandFormValues, brand: Brand | null) => Promise<boolean>
}
function Form({ brand, onSave, isSaving, error, onOpenChange }: Omit<Props, "open">) {
    const id = useId()
    const [values, setValues] = useState<BrandFormValues>({
        code: brand?.code ?? "",
        name: brand?.name ?? "",
        description: brand?.description ?? "",
        isActive: brand?.isActive ?? true,
    })
    const [errors, setErrors] = useState<BrandFormErrors>({})
    async function submit(event: FormEvent) {
        event.preventDefault()
        if (isSaving) return
        const next = validateBrand(values)
        setErrors(next)
        if (Object.keys(next).length) return
        if (await onSave(values, brand)) onOpenChange(false)
    }
    return (
        <DialogContent
            showCloseButton={!isSaving}
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
        >
            <DialogHeader>
                <DialogTitle>{brand ? "Edit brand" : "Add brand"}</DialogTitle>
                <DialogDescription>Organize products under a commercial brand.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-5" aria-busy={isSaving}>
                {(
                    [
                        ["code", "Brand code", 30],
                        ["name", "Brand name", 120],
                    ] as const
                ).map(([key, label, max]) => (
                    <Field key={key} data-invalid={Boolean(errors[key])}>
                        <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
                        <Input
                            id={`${id}-${key}`}
                            name={key}
                            value={values[key]}
                            maxLength={max}
                            required
                            disabled={isSaving}
                            aria-invalid={Boolean(errors[key])}
                            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                        />
                        <FieldError>{errors[key]}</FieldError>
                    </Field>
                ))}
                <Field>
                    <FieldLabel htmlFor={`${id}-description`}>Description (optional)</FieldLabel>
                    <Textarea
                        id={`${id}-description`}
                        value={values.description}
                        maxLength={2000}
                        disabled={isSaving}
                        onChange={(e) => setValues({ ...values, description: e.target.value })}
                    />
                    <FieldError>{errors.description}</FieldError>
                </Field>
                <Field orientation="horizontal">
                    <Checkbox
                        id={`${id}-active`}
                        checked={values.isActive}
                        disabled={isSaving}
                        onCheckedChange={(isActive) => setValues({ ...values, isActive })}
                    />
                    <FieldLabel htmlFor={`${id}-active`}>Active brand</FieldLabel>
                </Field>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
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
                        {isSaving ? "Saving..." : brand ? "Save changes" : "Create brand"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}
export function BrandForm(props: Props) {
    return (
        <Dialog
            open={props.open}
            onOpenChange={(value) => {
                if (!props.isSaving) props.onOpenChange(value)
            }}
        >
            {props.open && <Form key={props.brand?.brandId ?? "new"} {...props} />}
        </Dialog>
    )
}
