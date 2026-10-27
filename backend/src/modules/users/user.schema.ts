import { z } from 'zod';

const positiveId = z.int().positive().max(2_147_483_647);
const nullableText = (maxLength?: number) => {
    const text = z.string().trim();
    return (maxLength ? text.max(maxLength) : text)
        .transform((value) => value || null)
        .nullable()
        .optional();
};

const writableUserFields = {
    firstName: z.string().trim().min(1).max(80),
    middleName: nullableText(80),
    lastName: z.string().trim().min(1).max(80),
    dateOfBirth: z
        .string()
        .trim()
        .pipe(z.union([z.iso.date(), z.literal('')]))
        .transform((value) => value || null)
        .nullable()
        .optional(),
    avatarUrl: nullableText(),
    mobileNumber: nullableText(30),
    address: nullableText(),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    isEmailVerified: z.boolean().optional(),
    roleId: positiveId,
};

export const createUserSchema = z.strictObject({
    ...writableUserFields,
    password: z.string().min(8).max(128),
});

export const updateUserSchema = z
    .strictObject(writableUserFields)
    .partial()
    .refine((input) => Object.values(input).some((value) => value !== undefined), {
        message: 'Provide at least one user field to update.',
    });

export const userIdParamsSchema = z.object({
    id: z.string().regex(/^\d+$/, 'Use a positive integer ID.').transform(Number).pipe(positiveId),
});

export const createUserRequestSchema = z.object({ body: createUserSchema });
export const userIdRequestSchema = z.object({ params: userIdParamsSchema });
export const updateUserRequestSchema = z.object({
    params: userIdParamsSchema,
    body: updateUserSchema,
});

export type CreateUserInput = z.output<typeof createUserSchema>;
export type UpdateUserInput = z.output<typeof updateUserSchema>;
