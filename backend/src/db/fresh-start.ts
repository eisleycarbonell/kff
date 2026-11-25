import { resolve } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { getSessionUser, login } from '../modules/auth/auth.service.ts';
import { createUserSchema } from '../modules/users/user.schema.ts';
import { hashPassword } from '../utils/hashHandler.ts';
import { resolveDirectDatabaseUrl } from './connection.ts';
import { db } from './index.ts';
import { roles, users, type RoleSettings } from './schema.ts';
import {
    databaseTarget,
    exportApplicationSchema,
    rebuildApplicationSchema,
    TestDatabaseError,
    type Database,
} from './test-database.ts';

export const FRESH_ADMIN_PERMISSIONS = {
    canManageInventory: true,
    canManagePurchasing: true,
    canManagePacking: true,
    canManageTransfers: true,
    canManageUsers: true,
    canManageAccounting: true,
} as const satisfies RoleSettings;

export type FreshStartFlags = {
    help: boolean;
    yes: boolean;
    noAdmin: boolean;
    noStart: boolean;
};

export type FreshAdminInput = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
};

const adminInputSchema = createUserSchema.omit({ roleId: true }).pick({
    firstName: true,
    lastName: true,
    email: true,
    password: true,
});

export function parseFreshStartArgs(argv: readonly string[]): FreshStartFlags {
    return {
        help: argv.includes('--help') || argv.includes('-h'),
        yes: argv.includes('--yes'),
        noAdmin: argv.includes('--no-admin'),
        noStart: argv.includes('--no-start'),
    };
}

export function requireFreshRebuildOptIn(environment: NodeJS.ProcessEnv = process.env) {
    if (
        environment.KFF_ALLOW_FRESH_REBUILD !== 'true' &&
        environment.KFF_ALLOW_TEST_DATA !== 'true'
    ) {
        throw new TestDatabaseError(
            'Fresh rebuild is disabled. Use backend\\fresh-start.cmd or set KFF_ALLOW_FRESH_REBUILD=true.',
        );
    }
}

export function validateAdminInput(raw: FreshAdminInput): FreshAdminInput {
    const parsed = adminInputSchema.safeParse(raw);
    if (!parsed.success) {
        throw new TestDatabaseError(
            'Provide a non-empty first/last name, a valid email, and a password of 8 to 128 characters.',
        );
    }
    return parsed.data;
}

export async function createInitialAdmin(database: Database, input: FreshAdminInput) {
    const validated = validateAdminInput(input);
    const passwordHash = await hashPassword(validated.password);

    await database.transaction(async (transaction) => {
        const [existingRole] = await transaction
            .select({ roleId: roles.roleId })
            .from(roles)
            .where(eq(roles.name, 'Administrator'))
            .limit(1);

        const roleId =
            existingRole?.roleId ??
            (
                await transaction
                    .insert(roles)
                    .values({
                        name: 'Administrator',
                        description: 'Full system access for business administration',
                        settings: FRESH_ADMIN_PERMISSIONS,
                    })
                    .returning({ roleId: roles.roleId })
            )[0]!.roleId;

        await transaction.insert(users).values({
            firstName: validated.firstName,
            lastName: validated.lastName,
            email: validated.email,
            passwordHash,
            isEmailVerified: true,
            roleId,
        });
    });

    if (database === db) {
        const sessionUser = await login({
            username: validated.email,
            password: validated.password,
        });
        if (!sessionUser || !(await getSessionUser(sessionUser.userId))) {
            throw new TestDatabaseError('The initial administrator account could not be verified.');
        }
    }

    return validated;
}

function printHelp() {
    console.log(
        'Rebuild all KFF application tables empty (NO sample data) and optionally create one initial Administrator account.',
    );
    console.log('');
    console.log('Usage: npm run fresh-start          (rebuild empty DB + build & start backend)');
    console.log('       npm run fresh-start:dev      (rebuild empty DB + start dev watch server)');
    console.log('       npm run db:fresh-start -- [options]');
    console.log('       backend\\fresh-start.cmd [options]');
    console.log('');
    console.log('Options:');
    console.log('  --yes        Skip interactive REBUILD confirmation (requires ADMIN_PASSWORD or --no-admin)');
    console.log('  --no-admin   Leave roles and users completely empty');
    console.log('  --no-start   Rebuild database only; do not build or start the backend (.cmd)');
    console.log('  --help, -h   Show this help without connecting to the database');
    console.log('');
    console.log('Optional env vars:');
    console.log('  ADMIN_FIRST_NAME  Default: System');
    console.log('  ADMIN_LAST_NAME   Default: Admin');
    console.log('  ADMIN_EMAIL       Default: admin@kff.local');
    console.log('  ADMIN_PASSWORD    8-128 chars (required in non-interactive --yes mode unless --no-admin)');
}

async function resolveInteractiveOrEnvAdmin(
    flags: FreshStartFlags,
    environment: NodeJS.ProcessEnv,
): Promise<FreshAdminInput | null> {
    if (flags.noAdmin) {
        return null;
    }

    const defaultFirst = (environment.ADMIN_FIRST_NAME ?? 'System').trim() || 'System';
    const defaultLast = (environment.ADMIN_LAST_NAME ?? 'Admin').trim() || 'Admin';
    const defaultEmail =
        (environment.ADMIN_EMAIL ?? 'admin@kff.local').trim().toLowerCase() || 'admin@kff.local';
    const envPassword = environment.ADMIN_PASSWORD;

    if (flags.yes || !stdin.isTTY) {
        if (!envPassword) {
            throw new TestDatabaseError(
                'Set ADMIN_PASSWORD (8-128 chars) or pass --no-admin when running non-interactively.',
            );
        }
        return validateAdminInput({
            firstName: defaultFirst,
            lastName: defaultLast,
            email: defaultEmail,
            password: envPassword,
        });
    }

    const prompt = createInterface({ input: stdin, output: stdout });
    try {
        console.log('');
        console.log('Initial Administrator account (no sample data will be loaded):');
        const firstIn = environment.ADMIN_FIRST_NAME
            ? defaultFirst
            : (await prompt.question(`First name [${defaultFirst}]: `)).trim() || defaultFirst;
        const lastIn = environment.ADMIN_LAST_NAME
            ? defaultLast
            : (await prompt.question(`Last name [${defaultLast}]: `)).trim() || defaultLast;
        const emailIn = environment.ADMIN_EMAIL
            ? defaultEmail
            : (await prompt.question(`Email [${defaultEmail}]: `)).trim() || defaultEmail;

        let password = envPassword;
        if (!password) {
            const answer = await prompt.question(
                'Password (8-128 chars, or type "skip" to leave DB empty): ',
            );
            if (answer.trim().toLowerCase() === 'skip') {
                return null;
            }
            password = answer;
        }

        return validateAdminInput({
            firstName: firstIn,
            lastName: lastIn,
            email: emailIn,
            password,
        });
    } finally {
        prompt.close();
    }
}

async function runCli() {
    const flags = parseFreshStartArgs(process.argv.slice(2));
    if (flags.help) {
        printHelp();
        return;
    }

    if (process.argv.includes('--allow')) {
        process.env.KFF_ALLOW_FRESH_REBUILD = 'true';
        delete process.env.KFF_SAMPLE_DATA_ON_START;
    }

    requireFreshRebuildOptIn();
    console.log(`Database to rebuild (FRESH START - NO SAMPLE DATA): ${databaseTarget(resolveDirectDatabaseUrl())}`);
    console.log(
        'All KFF application records (users, master data, inventory, orders, ledger) will be deleted.',
    );
    console.log('Stop any running backend before continuing.');

    if (!flags.yes) {
        if (!stdin.isTTY) {
            throw new TestDatabaseError(
                'Interactive confirmation is required. Pass --yes with ADMIN_PASSWORD or --no-admin for unattended runs.',
            );
        }
        const prompt = createInterface({ input: stdin, output: stdout });
        try {
            if ((await prompt.question('Type REBUILD to continue: ')) !== 'REBUILD') {
                throw new TestDatabaseError('Fresh start cancelled. No database changes were made.');
            }
        } finally {
            prompt.close();
        }
    }

    const adminInput = await resolveInteractiveOrEnvAdmin(flags, process.env);

    const ddl = await exportApplicationSchema();
    await rebuildApplicationSchema(db, ddl, 'public', {
        ...process.env,
        KFF_ALLOW_TEST_DATA: 'true',
    });
    console.log('Application database rebuilt empty (no sample data loaded).');

    if (adminInput) {
        const created = await createInitialAdmin(db, adminInput);
        console.log('Initial Administrator account created and verified.');
        console.log('Login: http://localhost:3000/');
        console.log(`Username: ${created.email}`);
    } else {
        console.log('No initial user was created (--no-admin / skipped).');
    }
}

const isMain = Boolean(
    process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url),
);

if (isMain) {
    let ranDb = false;
    try {
        const flags = parseFreshStartArgs(process.argv.slice(2));
        ranDb = !flags.help;
        await runCli();
    } catch (error) {
        console.error(
            error instanceof TestDatabaseError
                ? error.message
                : 'Fresh start failed. Check DATABASE_URL, permissions, and database availability.',
        );
        process.exitCode = 1;
    } finally {
        if (ranDb) {
            await db.$client.end({ timeout: 5 });
        }
    }
}
