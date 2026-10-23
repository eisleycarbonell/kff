export const USER_ROLES = [
    { id: 1, name: "Administrator" },
    { id: 2, name: "Warehouse Manager" },
    { id: 3, name: "Purchasing" },
] as const

export type User = {
    userId: number
    firstName: string
    lastName: string
    email: string
    mobileNumber: string
    roleId: number
    isEmailVerified: boolean
    createdAt: string
    lastLoginAt: string | null
}

export type UserFormValues = Pick<
    User,
    "firstName" | "lastName" | "email" | "mobileNumber" | "roleId" | "isEmailVerified"
>

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

    if (!USER_ROLES.some((role) => role.id === values.roleId)) {
        errors.roleId = "Select a valid role."
    }

    return errors
}
