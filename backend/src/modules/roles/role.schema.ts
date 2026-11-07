import { z } from 'zod';

export const permissionFields = {
    canManageInventory: z.boolean(),
    canManagePurchasing: z.boolean(),
    canManagePacking: z.boolean(),
    canManageTransfers: z.boolean(),
    canManageUsers: z.boolean(),
};
export const roleSettingsSchema = z.strictObject(permissionFields);
export const emptyRoleSettings = {
    canManageInventory: false,
    canManagePurchasing: false,
    canManagePacking: false,
    canManageTransfers: false,
    canManageUsers: false,
};
const name = z.string().trim().min(1).max(80);
const description = z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null)
    .nullable();
export const createRoleSchema = z.strictObject({
    name,
    description: description.optional().default(null),
    settings: roleSettingsSchema
        .partial()
        .optional()
        .transform((value) => ({ ...emptyRoleSettings, ...value })),
});
export const updateRoleSchema = z
    .strictObject({
        name: name.optional(),
        description: description.optional(),
        settings: roleSettingsSchema
            .partial()
            .refine(
                (value) => Object.values(value).some((entry) => entry !== undefined),
                'Choose at least one permission to update.',
            )
            .optional(),
    })
    .refine(
        (value) => Object.values(value).some((entry) => entry !== undefined),
        'Provide at least one role field to update.',
    );
const params = z.object({
    id: z.string().regex(/^\d+$/).transform(Number).pipe(z.int().positive().max(2_147_483_647)),
});
export const roleIdRequestSchema = z.object({ params });
export const createRoleRequestSchema = z.object({ body: createRoleSchema });
export const updateRoleRequestSchema = z.object({ params, body: updateRoleSchema });
export type CreateRoleInput = z.output<typeof createRoleSchema>;
export type UpdateRoleInput = z.output<typeof updateRoleSchema>;
