"use client"

import { useId, useState, type FormEvent } from "react"
import {
    PERMISSIONS,
    NOTIFICATION_TAGS,
    EMPTY_SETTINGS,
    validateRole,
    type Role,
    type RoleFormValues,
    type RoleFormErrors,
} from "@/components/modules/roles/role.schema"
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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    role: Role | null
    roles: Role[]
    isSaving: boolean
    saveError: Error | null
    onSave: (values: RoleFormValues, role: Role | null) => Promise<boolean>
}
function RoleFormContent({
    onOpenChange,
    role,
    roles,
    isSaving,
    saveError,
    onSave,
}: Omit<Props, "open">) {
    const id = useId()
    const [values, setValues] = useState<RoleFormValues>(() => ({
        name: role?.name ?? "",
        description: role?.description ?? "",
        settings: { ...(role?.settings ?? EMPTY_SETTINGS) },
    }))
    const [errors, setErrors] = useState<RoleFormErrors>({})
    const [suppressedSaveError, setSuppressedSaveError] = useState<Error | null>(null)
    const activeSaveError =
        saveError && saveError !== suppressedSaveError ? saveError.message : undefined
    const nameError = errors.name ?? activeSaveError
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return
        setSuppressedSaveError(null)
        const next = validateRole(values, roles, role)
        setErrors(next)
        const first = Object.keys(next)[0]
        if (first) {
            document.getElementById(`${id}-${first}`)?.focus()
            return
        }
        if (await onSave(values, role)) onOpenChange(false)
    }
    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle>{role ? "Edit role" : "Add role"}</DialogTitle>
                <DialogDescription>
                    Choose what users assigned to this role can manage. Changes apply to everyone
                    with this role.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} aria-busy={isSaving} className="space-y-5">
                <FieldGroup className="gap-4">
                    <Field data-invalid={Boolean(nameError)}>
                        <FieldLabel htmlFor={`${id}-name`}>Role name</FieldLabel>
                        <Input
                            id={`${id}-name`}
                            value={values.name}
                            maxLength={80}
                            disabled={isSaving}
                            required
                            className="h-10"
                            aria-invalid={Boolean(nameError)}
                            aria-describedby={`${id}-name-error`}
                            onChange={(event) => {
                                setValues((current) => ({ ...current, name: event.target.value }))
                                setErrors((current) => ({ ...current, name: undefined }))
                                if (saveError) setSuppressedSaveError(saveError)
                            }}
                        />
                        <FieldError id={`${id}-name-error`}>{nameError}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.description)}>
                        <FieldLabel htmlFor={`${id}-description`}>
                            Description (optional)
                        </FieldLabel>
                        <Textarea
                            id={`${id}-description`}
                            value={values.description}
                            maxLength={500}
                            disabled={isSaving}
                            aria-invalid={Boolean(errors.description)}
                            aria-describedby={`${id}-description-error`}
                            onChange={(event) => {
                                setValues((current) => ({
                                    ...current,
                                    description: event.target.value,
                                }))
                                setErrors((current) => ({ ...current, description: undefined }))
                            }}
                        />
                        <FieldError id={`${id}-description-error`}>{errors.description}</FieldError>
                    </Field>
                    <fieldset
                        id={`${id}-settings`}
                        tabIndex={-1}
                        disabled={isSaving}
                        className="space-y-3"
                        aria-describedby={`${id}-settings-help`}
                    >
                        <legend className="mb-1 text-sm font-medium">Permissions</legend>
                        <p id={`${id}-settings-help`} className="text-sm text-muted-foreground">
                            Leave all permissions off for a view-only role. Reading some
                            administrative screens still requires user management access.
                        </p>
                        {PERMISSIONS.map(({ key, label, description }) => (
                            <Field
                                key={key}
                                orientation="horizontal"
                                className="rounded-lg border p-3"
                            >
                                <Checkbox
                                    id={`${id}-${key}`}
                                    checked={values.settings[key]}
                                    disabled={isSaving}
                                    onCheckedChange={(checked) => {
                                        setValues((current) => ({
                                            ...current,
                                            settings: { ...current.settings, [key]: checked },
                                        }))
                                        setErrors((current) => ({
                                            ...current,
                                            settings: undefined,
                                        }))
                                    }}
                                />
                                <FieldContent>
                                    <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
                                    <FieldDescription>{description}</FieldDescription>
                                </FieldContent>
                            </Field>
                        ))}
                        <FieldError>{errors.settings}</FieldError>
                    </fieldset>
                    <fieldset
                        id={`${id}-notifications`}
                        disabled={isSaving}
                        className="space-y-3"
                        aria-describedby={`${id}-notifications-help`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <legend className="text-sm font-medium">
                                Notification routing tags
                            </legend>
                            <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                disabled={isSaving}
                                onClick={() => {
                                    const allTagged = NOTIFICATION_TAGS.every(
                                        ({ key }) => values.settings[key],
                                    )
                                    setValues((current) => {
                                        const nextSettings = { ...current.settings }
                                        for (const { key } of NOTIFICATION_TAGS) {
                                            nextSettings[key] = !allTagged
                                        }
                                        return { ...current, settings: nextSettings }
                                    })
                                    setErrors((current) => ({ ...current, settings: undefined }))
                                }}
                            >
                                {NOTIFICATION_TAGS.every(({ key }) => values.settings[key])
                                    ? "Clear"
                                    : "Tag all"}
                            </Button>
                        </div>
                        <p id={`${id}-notifications-help`} className="text-sm text-muted-foreground">
                            Tag which specific workflow notifications should be sent to this role.
                            Data synchronization remains global for all users and roles.
                        </p>
                        {NOTIFICATION_TAGS.map(({ key, label, description }) => (
                            <Field
                                key={key}
                                orientation="horizontal"
                                className="rounded-lg border p-3"
                            >
                                <Checkbox
                                    id={`${id}-${key}`}
                                    checked={values.settings[key]}
                                    disabled={isSaving}
                                    onCheckedChange={(checked) => {
                                        setValues((current) => ({
                                            ...current,
                                            settings: { ...current.settings, [key]: checked },
                                        }))
                                        setErrors((current) => ({
                                            ...current,
                                            settings: undefined,
                                        }))
                                    }}
                                />
                                <FieldContent>
                                    <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
                                    <FieldDescription>{description}</FieldDescription>
                                </FieldContent>
                            </Field>
                        ))}
                    </fieldset>
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
                        {isSaving ? "Saving..." : role ? "Save changes" : "Create role"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}
export function RoleForm({ open, onOpenChange, ...props }: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!props.isSaving) onOpenChange(next)
            }}
        >
            {open && (
                <RoleFormContent
                    key={props.role?.roleId ?? "new"}
                    onOpenChange={onOpenChange}
                    {...props}
                />
            )}
        </Dialog>
    )
}
