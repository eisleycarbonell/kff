"use client"
import { useId, useState, type FormEvent } from "react"
import {
    LOCATION_TYPES,
    validateLocation,
    type Location,
    type LocationInput,
    type LocationFormErrors,
} from "@/components/modules/locations/location.schema"
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
    location: Location | null
    locations: Location[]
    isSaving: boolean
    onSave: (values: LocationInput, location: Location | null) => Promise<boolean>
}
const typeItems = LOCATION_TYPES.map((value) => ({ value, label: value }))
function LocationFormContent({
    onOpenChange,
    location,
    locations,
    isSaving,
    onSave,
}: Omit<Props, "open">) {
    const id = useId()
    const [values, setValues] = useState<LocationInput>(() => ({
        code: location?.code ?? "",
        name: location?.name ?? "",
        locationType: location?.locationType ?? "Warehouse",
        isActive: location?.isActive ?? true,
    }))
    const [errors, setErrors] = useState<LocationFormErrors>({})
    function update<K extends keyof LocationInput>(field: K, value: LocationInput[K]) {
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
        const next = validateLocation(values, locations, location)
        setErrors(next)
        const first = Object.keys(next)[0]
        if (first) {
            document.getElementById(id + "-" + first)?.focus()
            return
        }
        if (await onSave(values, location)) onOpenChange(false)
    }
    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle>{location ? "Edit location" : "Add location"}</DialogTitle>
                <DialogDescription>
                    Configure a warehouse, packing area, branch, store, or inventory holding
                    location.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} aria-busy={isSaving} className="flex flex-col gap-5">
                <FieldGroup className="gap-4">
                    {(["code", "name"] as const).map((field) => (
                        <Field
                            key={field}
                            data-invalid={Boolean(errors[field])}
                            data-disabled={isSaving}
                        >
                            <FieldLabel htmlFor={id + "-" + field}>
                                {field === "code" ? "Location code" : "Location name"}
                            </FieldLabel>
                            <Input
                                id={id + "-" + field}
                                name={field}
                                value={values[field]}
                                maxLength={field === "code" ? 30 : 100}
                                required
                                disabled={isSaving}
                                onChange={(event) => update(field, event.target.value)}
                                aria-invalid={Boolean(errors[field])}
                                aria-describedby={id + "-" + field + "-error"}
                                className="h-10"
                            />
                            <FieldError id={id + "-" + field + "-error"}>
                                {errors[field]}
                            </FieldError>
                        </Field>
                    ))}
                    <Field
                        data-invalid={Boolean(errors.locationType)}
                        data-disabled={isSaving || location?.isInUse}
                    >
                        <FieldLabel htmlFor={id + "-locationType"}>Location type</FieldLabel>
                        <Select
                            name="locationType"
                            items={typeItems}
                            value={values.locationType}
                            disabled={isSaving || location?.isInUse}
                            onValueChange={(value) => {
                                if (value) update("locationType", value)
                            }}
                        >
                            <SelectTrigger
                                id={id + "-locationType"}
                                className="w-full data-[size=default]:h-10"
                                aria-invalid={Boolean(errors.locationType)}
                                aria-describedby={id + "-type-feedback"}
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
                        <div id={id + "-type-feedback"}>
                            {location?.isInUse && (
                                <FieldDescription>
                                    Type is locked because this location is referenced by inventory
                                    or operational records.
                                </FieldDescription>
                            )}
                            <FieldError>{errors.locationType}</FieldError>
                        </div>
                    </Field>
                    <Field
                        orientation="horizontal"
                        data-invalid={Boolean(errors.isActive)}
                        data-disabled={
                            isSaving ||
                            Boolean(location?.isActive && location.hasOperationalActivity)
                        }
                    >
                        <Checkbox
                            id={id + "-isActive"}
                            name="isActive"
                            checked={values.isActive}
                            disabled={
                                isSaving ||
                                Boolean(location?.isActive && location.hasOperationalActivity)
                            }
                            onCheckedChange={(checked) => update("isActive", checked)}
                            aria-describedby={id + "-active-feedback"}
                        />
                        <FieldContent>
                            <FieldLabel htmlFor={id + "-isActive"}>Active location</FieldLabel>
                            <div id={id + "-active-feedback"}>
                                <FieldDescription>
                                    {location?.hasOperationalActivity
                                        ? "Move stock, release reservations, and finish open packing orders or transfers before deactivating."
                                        : "Enable for inventory operations. Historical records remain available when inactive."}
                                </FieldDescription>
                                <FieldError>{errors.isActive}</FieldError>
                            </div>
                        </FieldContent>
                    </Field>
                </FieldGroup>
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
                        {isSaving ? "Saving..." : location ? "Save changes" : "Create location"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}
export function LocationForm({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!props.isSaving) onOpenChange(value)
            }}
        >
            {open && (
                <LocationFormContent
                    key={props.location?.locationId ?? "new"}
                    onOpenChange={onOpenChange}
                    {...props}
                />
            )}
        </Dialog>
    )
}
