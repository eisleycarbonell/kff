import { z } from "zod"

export const PERMISSIONS = [
    {
        key: "canManageInventory",
        label: "Inventory",
        description: "Manage stock, adjustments, and inventory master data.",
    },
    {
        key: "canManagePurchasing",
        label: "Purchasing",
        description: "Manage suppliers and purchase orders.",
    },
    {
        key: "canManagePacking",
        label: "Packing",
        description: "Plan, reserve materials, and complete packing orders.",
    },
    {
        key: "canManageTransfers",
        label: "Transfers",
        description: "Create, dispatch, and receive stock transfers.",
    },
    {
        key: "canManageUsers",
        label: "Users & roles",
        description: "Manage user accounts, roles, and permissions.",
    },
] as const
const settingsSchema = z.object({
    canManageInventory: z.boolean().default(false),
    canManagePurchasing: z.boolean().default(false),
    canManagePacking: z.boolean().default(false),
    canManageTransfers: z.boolean().default(false),
    canManageUsers: z.boolean().default(false),
})
export const EMPTY_SETTINGS = settingsSchema.parse({})
export const roleSchema = z.object({
    roleId: z.int().positive().max(2_147_483_647),
    name: z.string(),
    description: z.string().nullable(),
    settings: settingsSchema,
    userCount: z.int().nonnegative(),
    activeUserCount: z.int().nonnegative(),
    createdBy: z.int().positive().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedBy: z.int().positive().nullable(),
    updatedAt: z.iso.datetime({ offset: true }),
})
export type Role = z.output<typeof roleSchema>
export type RoleInput = { name: string; description: string | null; settings: Role["settings"] }
export type RoleUpdateInput = Partial<Omit<RoleInput, "settings">> & {
    settings?: Partial<Role["settings"]>
}
export type RoleFormValues = Omit<RoleInput, "description"> & { description: string }
export type RoleFormErrors = Partial<Record<"name" | "description" | "settings", string>>
export function toRoleInput(values: RoleFormValues): RoleInput {
    return {
        name: values.name.trim(),
        description: values.description.trim() || null,
        settings: { ...values.settings },
    }
}
export function toRoleUpdate(values: RoleFormValues, role: Role): RoleUpdateInput {
    const input = toRoleInput(values)
    const changes: RoleUpdateInput = {}
    if (input.name !== role.name) changes.name = input.name
    if (input.description !== role.description) changes.description = input.description
    for (const { key } of PERMISSIONS) {
        if (input.settings[key] !== role.settings[key])
            (changes.settings ??= {})[key] = input.settings[key]
    }
    return changes
}
export function validateRole(
    values: RoleFormValues,
    roles: Role[],
    role?: Role | null,
): RoleFormErrors {
    const errors: RoleFormErrors = {}
    const name = values.name.trim()
    if (!name) errors.name = "Enter a role name."
    else if (name.length > 80) errors.name = "Use 80 characters or fewer."
    else if (
        roles.some(
            (row) =>
                row.roleId !== role?.roleId && row.name.trim().toLowerCase() === name.toLowerCase(),
        )
    )
        errors.name = "A role with this name already exists."
    if (values.description.trim().length > 500) errors.description = "Use 500 characters or fewer."
    if (role && Object.keys(toRoleUpdate(values, role)).length === 0)
        errors.settings = "Make a change before saving."
    return errors
}
