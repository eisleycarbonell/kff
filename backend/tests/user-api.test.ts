import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';

import type { UserService } from '../src/modules/users/user.controller.ts';
import type { CreateUserInput, UpdateUserInput } from '../src/modules/users/user.schema.ts';

// These environment changes are isolated to this test worker. No database module is imported.
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
const { createApp } = await import('../src/app.ts');

const user: Awaited<ReturnType<UserService['createUser']>> = {
    userId: 42,
    firstName: 'Maria',
    middleName: null,
    lastName: 'Santos',
    dateOfBirth: null,
    avatarUrl: null,
    mobileNumber: null,
    address: null,
    email: 'maria@example.com',
    roleId: 2,
    isEmailVerified: true,
    lastLoginAt: null,
    deletedAt: null,
    createdBy: null,
    createdAt: new Date('2026-10-27T00:00:00Z'),
    updatedBy: null,
    updatedAt: new Date('2026-10-27T00:00:00Z'),
};

function fakeService(overrides: Partial<UserService> = {}): UserService {
    return {
        listUsers: async () => [user],
        getUserByID: async () => user,
        createUser: async () => user,
        updateUser: async () => user,
        deleteUser: async () => ({ userId: user.userId }),
        ...overrides,
    };
}

async function withApi(service: UserService, run: (origin: string) => Promise<void>) {
    const server = createApp(service).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    try {
        await run(`http://127.0.0.1:${address.port}`);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
        });
    }
}

function jsonRequest(method: string, body: unknown): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

test('GET preserves the public user envelope and serializes dates', async () => {
    await withApi(fakeService(), async (origin) => {
        const response = await fetch(`${origin}/api/user`);
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.deepEqual(payload, { success: true, data: JSON.parse(JSON.stringify([user])) });
        assert.equal('passwordHash' in payload.data[0], false);
    });
});

test('POST passes normalized, validated input to the service and returns 201', async () => {
    let received: CreateUserInput | undefined;
    await withApi(
        fakeService({
            createUser: async (input) => {
                received = input;
                return user;
            },
        }),
        async (origin) => {
            const response = await fetch(
                `${origin}/api/user`,
                jsonRequest('POST', {
                    firstName: ' Maria ',
                    lastName: ' Santos ',
                    email: ' MARIA@EXAMPLE.COM ',
                    roleId: 2,
                    password: ' password123 ',
                    mobileNumber: '',
                }),
            );
            assert.equal(response.status, 201);
            assert.equal((await response.json()).data.userId, 42);
            assert.deepEqual(received, {
                firstName: 'Maria',
                lastName: 'Santos',
                email: 'maria@example.com',
                roleId: 2,
                password: ' password123 ',
                mobileNumber: null,
            });
        },
    );
});

test('validation errors expose field paths and stop before service calls', async () => {
    let calls = 0;
    await withApi(
        fakeService({
            createUser: async () => {
                calls++;
                return user;
            },
        }),
        async (origin) => {
            const response = await fetch(
                `${origin}/api/user`,
                jsonRequest('POST', { email: 'invalid' }),
            );
            assert.equal(response.status, 400);
            const payload = await response.json();
            assert.equal(payload.success, false);
            assert.ok(
                payload.error.details.some(
                    (detail: { path: string }) => detail.path === 'body.email',
                ),
            );
            assert.equal(calls, 0);
        },
    );
});

test('invalid GET, PATCH, and DELETE IDs are rejected before service calls', async () => {
    let calls = 0;
    const service = fakeService({
        getUserByID: async () => {
            calls++;
            return user;
        },
        updateUser: async () => {
            calls++;
            return user;
        },
        deleteUser: async () => {
            calls++;
            return { userId: 42 };
        },
    });
    await withApi(service, async (origin) => {
        for (const method of ['GET', 'PATCH', 'DELETE']) {
            const response = await fetch(
                `${origin}/api/user/1e2`,
                method === 'PATCH' ? jsonRequest(method, { firstName: 'Carlo' }) : { method },
            );
            assert.equal(response.status, 400);
            assert.equal((await response.json()).error.details[0].path, 'params.id');
        }
        assert.equal(calls, 0);
    });
});

test('PATCH preserves partial-update semantics and passes a numeric ID', async () => {
    let received: { id: string | number; input: UpdateUserInput } | undefined;
    await withApi(
        fakeService({
            updateUser: async (id, input) => {
                received = { id, input };
                return user;
            },
        }),
        async (origin) => {
            const response = await fetch(
                `${origin}/api/user/42`,
                jsonRequest('PATCH', {
                    mobileNumber: null,
                    isEmailVerified: false,
                }),
            );
            assert.equal(response.status, 200);
            await response.json();
            assert.deepEqual(received, {
                id: 42,
                input: { mobileNumber: null, isEmailVerified: false },
            });
            const empty = await fetch(`${origin}/api/user/42`, jsonRequest('PATCH', {}));
            assert.equal(empty.status, 400);
            await empty.json();
        },
    );
});

test('GET, PATCH, and DELETE return 404 when a validated record does not exist', async () => {
    await withApi(
        fakeService({
            getUserByID: async () => null,
            updateUser: async () => null,
            deleteUser: async () => null,
        }),
        async (origin) => {
            for (const method of ['GET', 'PATCH', 'DELETE']) {
                const response = await fetch(
                    `${origin}/api/user/42`,
                    method === 'PATCH' ? jsonRequest(method, { firstName: 'Carlo' }) : { method },
                );
                assert.equal(response.status, 404);
                assert.deepEqual(await response.json(), {
                    success: false,
                    error: { message: 'User not found.' },
                });
            }
        },
    );
});

test('DELETE returns 204 with no response body', async () => {
    await withApi(fakeService(), async (origin) => {
        const response = await fetch(`${origin}/api/user/42`, { method: 'DELETE' });
        assert.equal(response.status, 204);
        assert.equal(await response.text(), '');
    });
});

test('shared middleware handles wrapped database failures from any async route', async () => {
    const failure = new Error('private SQL and parameters', {
        cause: { code: '23505', detail: 'secret value' },
    });
    const fail = async (): Promise<never> => {
        throw failure;
    };
    await withApi(
        fakeService({ listUsers: fail, createUser: fail, deleteUser: fail }),
        async (origin) => {
            for (const [path, options] of [
                ['/api/user', undefined],
                [
                    '/api/user',
                    jsonRequest('POST', {
                        firstName: 'Maria',
                        lastName: 'Santos',
                        email: 'maria@example.com',
                        roleId: 2,
                        password: 'password123',
                    }),
                ],
                ['/api/user/42', { method: 'DELETE' }],
            ] as const) {
                const response = await fetch(`${origin}${path}`, options);
                assert.equal(response.status, 409);
                const payload = await response.json();
                assert.equal(payload.success, false);
                assert.doesNotMatch(JSON.stringify(payload), /private|SQL|secret|parameters/);
            }
        },
    );
});

test('unexpected errors return a generic 500 without leaking their messages', async () => {
    await withApi(
        fakeService({
            listUsers: async () => {
                throw new Error('secret internal SQL');
            },
        }),
        async (origin) => {
            const response = await fetch(`${origin}/api/user`);
            assert.equal(response.status, 500);
            assert.deepEqual(await response.json(), {
                success: false,
                error: { message: 'Internal Server Error' },
            });
        },
    );
});

test('invalid JSON, oversized bodies, and unknown routes use JSON error envelopes', async () => {
    await withApi(fakeService(), async (origin) => {
        for (const [body, status] of [
            ['{broken', 400],
            [JSON.stringify({ value: 'x'.repeat(110_000) }), 413],
        ] as const) {
            const response = await fetch(`${origin}/api/user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            assert.equal(response.status, status);
            assert.equal((await response.json()).success, false);
        }
        const missing = await fetch(`${origin}/api/missing`);
        assert.equal(missing.status, 404);
        assert.equal((await missing.json()).success, false);
    });
});
