import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { users } from '../../db/schema.ts';
import { hashPassword } from '../../utils/hashHandler.ts';
import type { CreateUserInput, UpdateUserInput } from './user.schema.ts';

const publicUserFields = {
    userId: users.userId,
    firstName: users.firstName,
    middleName: users.middleName,
    lastName: users.lastName,
    dateOfBirth: users.dateOfBirth,
    avatarUrl: users.avatarUrl,
    mobileNumber: users.mobileNumber,
    address: users.address,
    email: users.email,
    roleId: users.roleId,
    isEmailVerified: users.isEmailVerified,
    lastLoginAt: users.lastLoginAt,
    deletedAt: users.deletedAt,
    createdBy: users.createdBy,
    createdAt: users.createdAt,
    updatedBy: users.updatedBy,
    updatedAt: users.updatedAt,
};

const parseUserId = (id: string | number) => {
    const userId = Number(id);
    return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
};

const nullableText = (value: string | null | undefined) => {
    if (value === undefined) return undefined;
    return value?.trim() || null;
};

export const listUsers = async () => {
    return db
        .select(publicUserFields)
        .from(users)
        .where(isNull(users.deletedAt))
        .orderBy(asc(users.lastName), asc(users.firstName), asc(users.userId));
};

export const getUserByID = async (id: string | number) => {
    const userId = parseUserId(id);
    if (userId === null) return null;

    const [user] = await db
        .select(publicUserFields)
        .from(users)
        .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
        .limit(1);

    return user ?? null;
};

export const createUser = async (input: CreateUserInput) => {
    const passwordHash = await hashPassword(input.password);
    const [user] = await db
        .insert(users)
        .values({
            firstName: input.firstName.trim(),
            middleName: nullableText(input.middleName),
            lastName: input.lastName.trim(),
            dateOfBirth: nullableText(input.dateOfBirth),
            avatarUrl: nullableText(input.avatarUrl),
            mobileNumber: nullableText(input.mobileNumber),
            address: nullableText(input.address),
            email: input.email.trim().toLowerCase(),
            passwordHash,
            isEmailVerified: input.isEmailVerified ?? false,
            roleId: input.roleId,
        })
        .returning(publicUserFields);

    if (!user) throw new Error('The user could not be created.');
    return user;
};

export const updateUser = async (id: string | number, input: UpdateUserInput) => {
    const userId = parseUserId(id);
    if (userId === null) return null;

    const changes: Partial<typeof users.$inferInsert> = {};

    if (input.firstName !== undefined) changes.firstName = input.firstName.trim();
    if (input.middleName !== undefined) changes.middleName = nullableText(input.middleName);
    if (input.lastName !== undefined) changes.lastName = input.lastName.trim();
    if (input.dateOfBirth !== undefined) changes.dateOfBirth = nullableText(input.dateOfBirth);
    if (input.avatarUrl !== undefined) changes.avatarUrl = nullableText(input.avatarUrl);
    if (input.mobileNumber !== undefined) changes.mobileNumber = nullableText(input.mobileNumber);
    if (input.address !== undefined) changes.address = nullableText(input.address);
    if (input.email !== undefined) changes.email = input.email.trim().toLowerCase();
    if (input.isEmailVerified !== undefined) {
        changes.isEmailVerified = input.isEmailVerified;
    }
    if (input.roleId !== undefined) changes.roleId = input.roleId;

    if (Object.keys(changes).length === 0) return getUserByID(id);

    changes.updatedAt = new Date();

    const [user] = await db
        .update(users)
        .set(changes)
        .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
        .returning(publicUserFields);

    return user ?? null;
};

export const deleteUser = async (id: string | number) => {
    const userId = parseUserId(id);
    if (userId === null) return null;

    const now = new Date();
    const [user] = await db
        .update(users)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
        .returning({ userId: users.userId });

    return user ?? null;
};

export const getUserByUsername = async (username: string) => {
    if (typeof username !== 'string') return null;

    const email = username.trim().toLowerCase();
    if (!email) return null;

    const [user] = await db
        .select({
            id: users.userId,
            roleId: users.roleId,
            firstName: users.firstName,
            middleName: users.middleName,
            lastName: users.lastName,
            email: users.email,
            password: users.passwordHash,
        })
        .from(users)
        .where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
        .limit(1);

    if (!user) return null;

    return {
        id: String(user.id),
        roleId: user.roleId,
        username: user.email,
        email: user.email,
        fullName: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' '),
        password: user.password,
    };
};
