import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { ReasonCodeService } from '../src/modules/reason-codes/reason-code.controller.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import { AppError } from '../src/errors/app-error.ts';
import {
    reasonInputSchema,
    reasonUpdateSchema,
} from '../src/modules/reason-codes/reason-code.schema.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-reason-code-signing-key-not-for-deployment';

const { createApp } = await import('../src/app.ts');
const { generateToken } = await import('../src/utils/jwtHandler.ts');

const manager: SessionUser = {
    userId: 7,
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'manager@example.com',
    roleId: 2,
    permissions: { canManageInventory: true },
};

const viewer: SessionUser = {
    ...manager,
    userId: 8,
    email: 'viewer@example.com',
    permissions: {},
};

const audit = {
    createdBy: 7,
    updatedBy: 7,
    createdAt: new Date('2026-10-27T00:00:00Z'),
    updatedAt: new Date('2026-10-27T00:00:00Z'),
};

const reasonRecord = {
    reasonId: 1,
    codeName: 'COUNT',
    category: 'Inventory Adjustment' as const,
    description: 'Physical count variance',
    isActive: true,
    ...audit,
};

const users: UserService = {
    listUsers: async () => [],
    getUserByID: async () => null,
    createUser: async () => {
        throw new Error('Unused');
    },
    updateUser: async () => null,
    deleteUser: async () => null,
};

function fakeReasonCodes(overrides: Partial<ReasonCodeService> = {}): ReasonCodeService {
    return {
        listReasonCodes: async () => [reasonRecord],
        createReasonCode: async (input, actorId) => ({
            ...reasonRecord,
            ...input,
            createdBy: actorId,
            updatedBy: actorId,
        }),
        updateReasonCode: async (id, input, actorId) =>
            id === 1
                ? {
                      ...reasonRecord,
                      ...input,
                      updatedBy: actorId,
                  }
                : null,
        ...overrides,
    };
}

async function runRequest(
    path: string,
    init: { method?: string; body?: unknown; user?: SessionUser | null } = {},
    overrides: Partial<ReasonCodeService> = {},
) {
    const activeUser = init.user === undefined ? manager : init.user;
    const app = createApp({
        userService: users,
        authService: {
            login: async () => null,
            getSessionUser: async (id) =>
                activeUser && id === activeUser.userId ? activeUser : null,
        },
        reasonCodeService: fakeReasonCodes(overrides),
    });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
        const { port } = server.address() as { port: number };
        const headers: Record<string, string> = {};
        if (activeUser) {
            headers.authorization = `Bearer ${await generateToken({ id: String(activeUser.userId) }, '1h')}`;
        }
        if (init.body !== undefined) headers['content-type'] = 'application/json';
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
            method: init.method ?? 'GET',
            headers,
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
        });
        return {
            status: response.status,
            payload: (await response.json()) as {
                success: boolean;
                data?: unknown;
                error?: { message: string };
            },
        };
    } finally {
        server.close();
        await once(server, 'close');
    }
}

test('reason schemas apply defaults only on create and preserve omissions on PATCH', () => {
    const created = reasonInputSchema.parse({
        codeName: '  DMG_BOX  ',
        category: 'Packing Damage',
        description: '   ',
    });
    assert.deepEqual(created, {
        codeName: 'DMG_BOX',
        category: 'Packing Damage',
        description: null,
        isActive: true,
    });

    const partial = reasonUpdateSchema.parse({ codeName: '  COUNT_FIX  ' });
    assert.deepEqual(partial, { codeName: 'COUNT_FIX' });
    assert.equal('description' in partial, false);
    assert.equal('isActive' in partial, false);

    assert.throws(() => reasonUpdateSchema.parse({}));
});

test('reason code routes enforce auth, permissions, and safe partial PATCH updates', async () => {
    assert.equal((await runRequest('/api/reason-codes', { user: null })).status, 401);

    const viewed = await runRequest('/api/reason-codes', { user: viewer });
    assert.equal(viewed.status, 200);

    const denied = await runRequest(
        '/api/reason-codes',
        {
            method: 'POST',
            user: viewer,
            body: { codeName: 'EXPIRED', category: 'Expired' },
        },
    );
    assert.equal(denied.status, 403);

    const created = await runRequest('/api/reason-codes', {
        method: 'POST',
        body: { codeName: 'EXPIRED', category: 'Expired', description: '  Past expiry  ' },
    });
    assert.equal(created.status, 201);
    assert.equal((created.payload.data as { description: string | null }).description, 'Past expiry');

    let patchedInput: Record<string, unknown> | undefined;
    const patched = await runRequest(
        '/api/reason-codes/1',
        {
            method: 'PATCH',
            body: { isActive: false },
        },
        {
            updateReasonCode: async (id, input, actorId) => {
                patchedInput = input as Record<string, unknown>;
                return { ...reasonRecord, reasonId: id, ...input, updatedBy: actorId };
            },
        },
    );
    assert.equal(patched.status, 200);
    assert.deepEqual(patchedInput, { isActive: false });
    assert.equal((patched.payload.data as { description: string | null }).description, 'Physical count variance');

    const missing = await runRequest('/api/reason-codes/999', {
        method: 'PATCH',
        body: { isActive: false },
    });
    assert.equal(missing.status, 404);

    const conflict = await runRequest(
        '/api/reason-codes/1',
        {
            method: 'PATCH',
            body: { category: 'Spoilage' },
        },
        {
            updateReasonCode: async () => {
                throw new AppError(409, 'The category of a referenced reason cannot be changed.');
            },
        },
    );
    assert.equal(conflict.status, 409);
    assert.equal(
        conflict.payload.error?.message,
        'The category of a referenced reason cannot be changed.',
    );
});

