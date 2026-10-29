import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { users, roles } from '../../db/schema.ts';
import { comparePasswords } from '../../utils/hashHandler.ts';
import type { LoginInput, SessionUser } from './auth.schema.ts';

const sessionFields = {
    userId: users.userId,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
    roleId: users.roleId,
    permissions: roles.settings,
};
export async function getSessionUser(userId: number): Promise<SessionUser | null> {
    const [user] = await db
        .select(sessionFields)
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.roleId))
        .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
        .limit(1);
    return user ?? null;
}
export async function login(input: LoginInput): Promise<SessionUser | null> {
    const [user] = await db
        .select({ ...sessionFields, passwordHash: users.passwordHash })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.roleId))
        .where(and(sql`lower(${users.email}) = ${input.username}`, isNull(users.deletedAt)))
        .limit(1);
    if (!user || !(await comparePasswords(input.password, user.passwordHash))) return null;
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.userId, user.userId));
    const { passwordHash: _hash, ...session } = user;
    return session;
}
