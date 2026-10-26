"use client"

import { useId, useState, type FormEvent } from "react"

import {
    USER_ROLES,
    validateUser,
    type User,
    type UserFormErrors,
    type UserFormValues,
} from "@/components/modules/users/user.schema"
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

type UserFormProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: User | null
    users: User[]
    onSave: (values: UserFormValues, user: User | null) => Promise<boolean>
    isSaving?: boolean
}

const roleItems = USER_ROLES.map((role) => ({
    value: role.id,
    label: role.name,
}))

function UserFormContent({
    onOpenChange,
    user,
    users,
    onSave,
    isSaving = false,
}: Omit<UserFormProps, "open">) {
    const id = useId()
    const [values, setValues] = useState<UserFormValues>(() => ({
        firstName: user?.firstName ?? "",
        lastName: user?.lastName ?? "",
        email: user?.email ?? "",
        mobileNumber: user?.mobileNumber ?? "",
        roleId: user?.roleId ?? USER_ROLES[USER_ROLES.length - 1].id,
        isEmailVerified: user?.isEmailVerified ?? false,
        password: "",
    }))
    const [errors, setErrors] = useState<UserFormErrors>({})
    const availableRoles = roleItems.some((role) => role.value === values.roleId)
        ? roleItems
        : [...roleItems, { value: values.roleId, label: `Role ${values.roleId}` }]

    function updateField<Key extends keyof UserFormValues>(name: Key, value: UserFormValues[Key]) {
        setValues((current) => ({ ...current, [name]: value }))
        setErrors((current) => {
            const next = { ...current }
            delete next[name]
            return next
        })
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isSaving) return

        const normalized: UserFormValues = {
            ...values,
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            email: values.email.trim().toLowerCase(),
            mobileNumber: values.mobileNumber.trim(),
        }
        const nextErrors = validateUser(normalized, users, user?.userId)
        setErrors(nextErrors)

        const firstInvalidField = Object.keys(nextErrors)[0]

        if (firstInvalidField) {
            const field = event.currentTarget.elements.namedItem(firstInvalidField)
            if (field instanceof HTMLElement) field.focus()
            return
        }

        if (await onSave(normalized, user)) onOpenChange(false)
    }

    return (
        <DialogContent
            className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
            showCloseButton={!isSaving}
        >
            <DialogHeader>
                <DialogTitle>{user ? "Edit user" : "Add user"}</DialogTitle>
                <DialogDescription>
                    {user
                        ? "Update this user's profile and access level."
                        : "Create a user profile and assign their access level."}
                </DialogDescription>
            </DialogHeader>
            <form
                onSubmit={handleSubmit}
                className="space-y-5"
                aria-busy={isSaving}
            >
                <FieldGroup className="gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field data-invalid={Boolean(errors.firstName)}>
                            <FieldLabel htmlFor={`${id}-first-name`}>First name</FieldLabel>
                            <Input
                                id={`${id}-first-name`}
                                name="firstName"
                                autoComplete="given-name"
                                required
                                disabled={isSaving}
                                maxLength={80}
                                value={values.firstName}
                                onChange={(event) => updateField("firstName", event.target.value)}
                                aria-invalid={Boolean(errors.firstName)}
                                aria-describedby={
                                    errors.firstName ? `${id}-first-name-error` : undefined
                                }
                                className="h-9"
                            />
                            <FieldError id={`${id}-first-name-error`}>
                                {errors.firstName}
                            </FieldError>
                        </Field>
                        <Field data-invalid={Boolean(errors.lastName)}>
                            <FieldLabel htmlFor={`${id}-last-name`}>Last name</FieldLabel>
                            <Input
                                id={`${id}-last-name`}
                                name="lastName"
                                autoComplete="family-name"
                                required
                                disabled={isSaving}
                                maxLength={80}
                                value={values.lastName}
                                onChange={(event) => updateField("lastName", event.target.value)}
                                aria-invalid={Boolean(errors.lastName)}
                                aria-describedby={
                                    errors.lastName ? `${id}-last-name-error` : undefined
                                }
                                className="h-9"
                            />
                            <FieldError id={`${id}-last-name-error`}>{errors.lastName}</FieldError>
                        </Field>
                    </div>
                    <Field data-invalid={Boolean(errors.email)}>
                        <FieldLabel htmlFor={`${id}-email`}>Email address</FieldLabel>
                        <Input
                            id={`${id}-email`}
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            disabled={isSaving}
                            maxLength={254}
                            placeholder="name@company.com"
                            value={values.email}
                            onChange={(event) => updateField("email", event.target.value)}
                            aria-invalid={Boolean(errors.email)}
                            aria-describedby={errors.email ? `${id}-email-error` : undefined}
                            className="h-9"
                        />
                        <FieldError id={`${id}-email-error`}>{errors.email}</FieldError>
                    </Field>
                    {!user && (
                        <Field data-invalid={Boolean(errors.password)}>
                            <FieldLabel htmlFor={`${id}-password`}>Password</FieldLabel>
                            <Input
                                id={`${id}-password`}
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                disabled={isSaving}
                                minLength={8}
                                maxLength={128}
                                value={values.password}
                                onChange={(event) => updateField("password", event.target.value)}
                                aria-invalid={Boolean(errors.password)}
                                aria-describedby={errors.password ? `${id}-password-error` : undefined}
                                className="h-9"
                            />
                            <FieldError id={`${id}-password-error`}>{errors.password}</FieldError>
                        </Field>
                    )}
                    <Field data-invalid={Boolean(errors.mobileNumber)}>
                        <FieldLabel htmlFor={`${id}-mobile`}>
                            Mobile number{" "}
                            <span className="font-normal text-muted-foreground">(optional)</span>
                        </FieldLabel>
                        <Input
                            id={`${id}-mobile`}
                            name="mobileNumber"
                            type="tel"
                            autoComplete="tel"
                            disabled={isSaving}
                            maxLength={30}
                            placeholder="Enter a mobile number"
                            value={values.mobileNumber}
                            onChange={(event) => updateField("mobileNumber", event.target.value)}
                            aria-invalid={Boolean(errors.mobileNumber)}
                            aria-describedby={
                                errors.mobileNumber ? `${id}-mobile-error` : undefined
                            }
                            className="h-9"
                        />
                        <FieldError id={`${id}-mobile-error`}>{errors.mobileNumber}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.roleId)}>
                        <FieldLabel htmlFor={`${id}-role`}>Role</FieldLabel>
                        <Select
                            name="roleId"
                            items={availableRoles}
                            value={values.roleId}
                            disabled={isSaving}
                            onValueChange={(value) => {
                                if (value !== null) updateField("roleId", value)
                            }}
                            required
                        >
                            <SelectTrigger
                                id={`${id}-role`}
                                aria-invalid={Boolean(errors.roleId)}
                                aria-describedby={errors.roleId ? `${id}-role-error` : undefined}
                                className="h-9 w-full"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableRoles.map((role) => (
                                    <SelectItem
                                        key={role.value}
                                        value={role.value}
                                    >
                                        {role.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FieldError id={`${id}-role-error`}>{errors.roleId}</FieldError>
                    </Field>
                    <Field
                        orientation="horizontal"
                        className="rounded-lg border p-3"
                    >
                        <Checkbox
                            id={`${id}-verified`}
                            name="isEmailVerified"
                            checked={values.isEmailVerified}
                            disabled={isSaving}
                            onCheckedChange={(checked) => updateField("isEmailVerified", checked)}
                            aria-describedby={`${id}-verified-description`}
                        />
                        <FieldContent>
                            <FieldLabel htmlFor={`${id}-verified`}>Email verified</FieldLabel>
                            <FieldDescription id={`${id}-verified-description`}>
                                Mark this user&apos;s email address as verified.
                            </FieldDescription>
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
                        {isSaving ? "Saving..." : user ? "Save changes" : "Create user"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}

export function UserForm({ open, onOpenChange, ...props }: UserFormProps) {
    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!props.isSaving) onOpenChange(nextOpen)
            }}
        >
            {open && (
                <UserFormContent
                    key={props.user?.userId ?? "new"}
                    onOpenChange={onOpenChange}
                    {...props}
                />
            )}
        </Dialog>
    )
}
