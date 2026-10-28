import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from './index.ts';
import { roles, users, type RoleSettings } from './schema.ts';
import { getSessionUser, login } from '../modules/auth/auth.service.ts';
import { createUserSchema } from '../modules/users/user.schema.ts';
import { comparePasswords, hashPassword } from '../utils/hashHandler.ts';

class DemoAccountError extends Error {}

const permissions = {
    canManageInventory: true,
    canManagePurchasing: true,
    canManagePacking: true,
    canManageTransfers: true,
    canManageUsers: true,
} as const;

const hasAdminPermissions = (settings: RoleSettings) =>
    (Object.keys(permissions) as (keyof typeof permissions)[]).every(
        (permission) => settings[permission] === true,
    );

async function createDemoUser() {
    if (process.env.NODE_ENV === 'production') {
        throw new DemoAccountError('Refusing to create a demo account in production.');
    }

    const email = (process.env.DEMO_USER_EMAIL ?? 'demo@spice.local').trim().toLowerCase();
    const password = process.env.DEMO_USER_PASSWORD ?? 'KffDemo123!';
    const parsed = createUserSchema.omit({ roleId: true }).safeParse({
        firstName: 'Demo',
        lastName: 'Administrator',
        email,
        password,
    });
    if (!parsed.success) {
        throw new DemoAccountError(
            'Use a valid DEMO_USER_EMAIL and a DEMO_USER_PASSWORD containing 8 to 128 characters.',
        );
    }
    const input = parsed.data;
    const passwordHash = await hashPassword(input.password);

    await db.transaction(async (transaction) => {
        const [existing] = await transaction
            .select({ passwordHash: users.passwordHash, permissions: roles.settings })
            .from(users)
            .innerJoin(roles, eq(users.roleId, roles.roleId))
            .where(and(sql`lower(${users.email}) = ${input.email}`, isNull(users.deletedAt)))
            .limit(1);

        if (existing) {
            if (!(await comparePasswords(input.password, existing.passwordHash))) {
                throw new DemoAccountError(
                    'This email already has a different password. Set DEMO_USER_EMAIL to an unused email.',
                );
            }
            if (!hasAdminPermissions(existing.permissions)) {
                throw new DemoAccountError(
                    'This email already belongs to a user without administrator permissions. Set DEMO_USER_EMAIL to an unused email.',
                );
            }
            return;
        }

        const availableRoles = await transaction
            .select({ roleId: roles.roleId, settings: roles.settings })
            .from(roles);
        let role = availableRoles.find((candidate) => hasAdminPermissions(candidate.settings));

        if (!role) {
            await transaction
                .insert(roles)
                .values({
                    name: 'Demo Administrator',
                    description: 'Sample account administrator',
                    settings: permissions,
                })
                .onConflictDoNothing();
            [role] = await transaction
                .select({ roleId: roles.roleId, settings: roles.settings })
                .from(roles)
                .where(eq(roles.name, 'Demo Administrator'));
            if (!role || !hasAdminPermissions(role.settings)) {
                throw new DemoAccountError(
                    'The Demo Administrator role does not have administrator permissions.',
                );
            }
        }

        await transaction.insert(users).values({
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            passwordHash,
            isEmailVerified: true,
            roleId: role.roleId,
        });
    });

    const user = await login({ username: input.email, password: input.password });
    if (!user || !(await getSessionUser(user.userId))) {
        throw new DemoAccountError('The sample account could not be authenticated.');
    }

    console.log('Sample login verified.');
    console.log('Login: http://localhost:3000/');
    console.log(`Username: ${input.email}`);
    console.log(`Password: ${input.password}`);
}

createDemoUser()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
        if (error instanceof DemoAccountError) {
            console.error(error.message);
        } else {
            console.error(
                'Cannot connect to the database or create the sample account. Check DATABASE_URL and database availability.',
            );
        }
        process.exit(1);
    });
