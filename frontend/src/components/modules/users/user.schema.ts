import { z } from "zod"

export const USER_ROLES = [
    { id: 1, name: "Administrator" },
    { id: 2, name: "Warehouse Manager" },
    { id: 3, name: "Purchasing" },
] as const

const idSchema = z.int().positive()
const timestampSchema = z.iso.datetime({ offset: true })

export const userSchema = z.object({
    userId: idSchema,
    firstName: z.string(),
    middleName: z.string().nullable(),
    lastName: z.string(),
    /** Calendar date in YYYY-MM-DD format. */
    dateOfBirth: z.iso.date().nullable(),
    avatarUrl: z.string().nullable(),
    mobileNumber: z.string().nullable(),
    address: z.string().nullable(),
    email: z.string(),
    roleId: idSchema,
    isEmailVerified: z.boolean(),
    lastLoginAt: timestampSchema.nullable(),
    deletedAt: timestampSchema.nullable(),
    createdBy: idSchema.nullable(),
    createdAt: timestampSchema,
    updatedBy: idSchema.nullable(),
    updatedAt: timestampSchema,
})

export type User = z.infer<typeof userSchema>

export type UserWriteInput = Pick<
    User,
    "firstName" | "lastName" | "email" | "mobileNumber" | "roleId" | "isEmailVerified"
> &
    Partial<Pick<User, "middleName" | "dateOfBirth" | "avatarUrl" | "address">>

export type CreateUserInput = UserWriteInput & { password: string }

export type UpdateUserInput = Partial<UserWriteInput>

export type UserFormValues = Pick<
    User,
    "firstName" | "lastName" | "email" | "roleId" | "isEmailVerified"
> & {
    mobileNumber: string
    password: string
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>

export function getUserName(user: Pick<User, "firstName" | "lastName">) {
    return `${user.firstName} ${user.lastName}`.trim()
}

export function getRoleName(roleId: number) {
    return USER_ROLES.find((role) => role.id === roleId)?.name ?? "Unknown role"
}

export function validateUser(
    values: UserFormValues,
    users: User[],
    excludeId?: number,
): UserFormErrors {
    const errors: UserFormErrors = {}
    const email = values.email.trim()

    if (!values.firstName.trim()) {
        errors.firstName = "Enter a first name."
    } else if (values.firstName.trim().length > 80) {
        errors.firstName = "Use 80 characters or fewer."
    }

    if (!values.lastName.trim()) {
        errors.lastName = "Enter a last name."
    } else if (values.lastName.trim().length > 80) {
        errors.lastName = "Use 80 characters or fewer."
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = "Enter a valid email address."
    } else if (email.length > 254) {
        errors.email = "Use an email address with 254 characters or fewer."
    } else if (
        users.some(
            (user) =>
                user.userId !== excludeId &&
                user.email.trim().toLowerCase() === email.toLowerCase(),
        )
    ) {
        errors.email = "A user with this email address already exists."
    }

    if (values.mobileNumber.trim().length > 30) {
        errors.mobileNumber = "Use 30 characters or fewer."
    }

    if (!Number.isInteger(values.roleId) || values.roleId <= 0) {
        errors.roleId = "Select a valid role."
    }

    if (excludeId === undefined) {
        if (values.password.length < 8) {
            errors.password = "Use a password with at least 8 characters."
        } else if (values.password.length > 128) {
            errors.password = "Use a password with 128 characters or fewer."
        }
    }

    return errors
}
