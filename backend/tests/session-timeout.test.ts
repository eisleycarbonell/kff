import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { SignJWT, decodeJwt } from 'jose';

import type { UserService } from '../src/modules/users/user.controller.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-idle-session-timeout-secret';

const { createApp } = await import('../src/app.ts');
const { SESSION_IDLE_TIMEOUT_SECONDS } = await import('../src/modules/auth/session-cookie.ts');

const signingKey = () => new TextEncoder().encode(process.env.JWT_SECRET);

const admin = {
    userId: 7,
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    roleId: 1,
    permissions: { canManageUsers: true },
};

const createdUser = {
    userId: 42,
    firstName: 'Maria',
    lastName: 'Santos',
    middleName: null,
    dateOfBirth: null,
    avatarUrl: null,
    mobileNumber: null,
    address: null,
    email: 'maria@example.com',
    roleId: 2,
    isEmailVerified: true,
    lastLoginAt: null,
    deletedAt: null,
    createdBy: 7,
    createdAt: new Date('2026-10-27T00:00:00Z'),
    updatedBy: 7,
    updatedAt: new Date('2026-10-27T00:00:00Z'),
};

function fakeUserService(): UserService {
    return {
        listUsers: async () => [createdUser],
        getUserByID: async () => createdUser,
        createUser: async () => createdUser,
        updateUser: async () => createdUser,
        deleteUser: async () => ({ userId: createdUser.userId }),
    };
}

function extractJwtCookieValue(setCookieHeader: string | null): string {
    assert.ok(setCookieHeader, 'Expected Set-Cookie header');
    const match = setCookieHeader.match(/(?:^|,\s*)jwt=([^;]+)/);
    assert.ok(match?.[1], 'Expected jwt cookie in Set-Cookie header');
    return decodeURIComponent(match[1]);
}

async function withServer(run: (origin: string) => Promise<void>) {
    const server = createApp({
        userService: fakeUserService(),
        authService: {
            login: async () => admin,
            getSessionUser: async () => admin,
        },
    }).listen(0, '127.0.0.1');
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

test('POST /api/auth/login issues a 3-hour sliding jwt session cookie', async () => {
    await withServer(async (origin) => {
        const response = await fetch(`${origin}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin@example.com', password: 'password123' }),
        });
        assert.equal(response.status, 200);
        const setCookie = response.headers.get('set-cookie');
        assert.match(setCookie ?? '', new RegExp(`Max-Age=${SESSION_IDLE_TIMEOUT_SECONDS}`));
        const token = extractJwtCookieValue(setCookie);
        const claims = decodeJwt(token);
        assert.equal(claims.id, '7');
        assert.equal(typeof claims.iat, 'number');
        assert.equal(typeof claims.exp, 'number');
        assert.equal((claims.exp ?? 0) - (claims.iat ?? 0), SESSION_IDLE_TIMEOUT_SECONDS);
    });
});

test('expired session cookie returns 401 inactivity error and clears the cookie', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({ id: '7' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(nowSec - SESSION_IDLE_TIMEOUT_SECONDS - 120)
        .setExpirationTime(nowSec - 60)
        .sign(signingKey());

    await withServer(async (origin) => {
        const response = await fetch(`${origin}/api/auth/session`, {
            headers: { Cookie: `jwt=${expiredToken}` },
        });
        assert.equal(response.status, 401);
        const payload = await response.json();
        assert.equal(payload.success, false);
        assert.equal(
            payload.error.message,
            'Your session expired due to inactivity. Please sign in again.',
        );
        assert.match(response.headers.get('set-cookie') ?? '', /Expires=Thu, 01 Jan 1970/);
    });
});

test('POST /api/auth/keepalive refreshes active cookie and rejects socket or missing tokens', async () => {
    const validToken = await new SignJWT({ id: '7' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(signingKey());
    const socketToken = await new SignJWT({ id: '7', purpose: 'socket' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(signingKey());

    await withServer(async (origin) => {
        const unauth = await fetch(`${origin}/api/auth/keepalive`, { method: 'POST' });
        assert.equal(unauth.status, 401);

        const socketAttempt = await fetch(`${origin}/api/auth/keepalive`, {
            method: 'POST',
            headers: { Cookie: `jwt=${socketToken}` },
        });
        assert.equal(socketAttempt.status, 401);

        const ok = await fetch(`${origin}/api/auth/keepalive`, {
            method: 'POST',
            headers: { Cookie: `jwt=${validToken}` },
        });
        assert.equal(ok.status, 200);
        const body = await ok.json();
        assert.equal(body.success, true);
        assert.equal(body.data.idleTimeoutSeconds, SESSION_IDLE_TIMEOUT_SECONDS);
        assert.equal(typeof body.data.expiresAt, 'string');
        const setCookie = ok.headers.get('set-cookie');
        assert.match(setCookie ?? '', new RegExp(`Max-Age=${SESSION_IDLE_TIMEOUT_SECONDS}`));
        const refreshed = extractJwtCookieValue(setCookie);
        const claims = decodeJwt(refreshed);
        assert.equal((claims.exp ?? 0) - (claims.iat ?? 0), SESSION_IDLE_TIMEOUT_SECONDS);
    });
});

test('passive GET does not slide cookie while aged cookie mutations refresh it', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const agedToken = await new SignJWT({ id: '7' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(nowSec - 120)
        .setExpirationTime(nowSec + SESSION_IDLE_TIMEOUT_SECONDS - 120)
        .sign(signingKey());
    const freshToken = await new SignJWT({ id: '7' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(nowSec)
        .setExpirationTime(nowSec + SESSION_IDLE_TIMEOUT_SECONDS)
        .sign(signingKey());

    await withServer(async (origin) => {
        const passiveGet = await fetch(`${origin}/api/auth/session`, {
            headers: { Cookie: `jwt=${agedToken}` },
        });
        assert.equal(passiveGet.status, 200);
        assert.equal(passiveGet.headers.get('set-cookie'), null);

        const freshMutation = await fetch(`${origin}/api/user`, {
            method: 'POST',
            headers: {
                Cookie: `jwt=${freshToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firstName: 'Maria',
                lastName: 'Santos',
                email: 'maria@example.com',
                roleId: 2,
                password: 'password123',
            }),
        });
        assert.equal(freshMutation.status, 201);
        assert.equal(freshMutation.headers.get('set-cookie'), null);

        const agedMutation = await fetch(`${origin}/api/user`, {
            method: 'POST',
            headers: {
                Cookie: `jwt=${agedToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firstName: 'Maria',
                lastName: 'Santos',
                email: 'maria@example.com',
                roleId: 2,
                password: 'password123',
            }),
        });
        assert.equal(agedMutation.status, 201);
        assert.match(
            agedMutation.headers.get('set-cookie') ?? '',
            new RegExp(`Max-Age=${SESSION_IDLE_TIMEOUT_SECONDS}`),
        );
    });
});
