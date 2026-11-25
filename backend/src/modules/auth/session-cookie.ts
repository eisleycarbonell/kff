import type { CookieOptions, Response } from 'express';
import { generateToken } from '../../utils/jwtHandler.ts';

export const SESSION_IDLE_TIMEOUT_SECONDS = 3 * 60 * 60;
export const SESSION_IDLE_TIMEOUT_MS = SESSION_IDLE_TIMEOUT_SECONDS * 1000;
export const SESSION_IDLE_TIMEOUT_JWT = '3h';
export const SESSION_SLIDE_THROTTLE_SECONDS = 60;

function parseSameSite(raw = process.env.COOKIE_SAME_SITE): 'strict' | 'lax' | 'none' {
    const normalized = raw?.trim().toLowerCase();
    if (normalized === 'none' || normalized === 'lax' || normalized === 'strict') {
        return normalized;
    }
    return 'strict';
}

export function getSessionCookieOptions(): CookieOptions {
    const sameSite = parseSameSite();
    return {
        httpOnly: true,
        secure: sameSite === 'none' || process.env.NODE_ENV === 'production',
        sameSite,
        path: '/',
    };
}

/** Issue a fresh 3-hour sliding session JWT in an httpOnly cookie. */
export async function issueSessionCookie(
    response: Response,
    userId: number,
    nowMs = Date.now(),
): Promise<{ token: string; expiresAt: string }> {
    const token = await generateToken({ id: String(userId) }, SESSION_IDLE_TIMEOUT_JWT);
    response.cookie('jwt', token, {
        ...getSessionCookieOptions(),
        maxAge: SESSION_IDLE_TIMEOUT_MS,
    });
    return {
        token,
        expiresAt: new Date(nowMs + SESSION_IDLE_TIMEOUT_MS).toISOString(),
    };
}

export function clearSessionCookie(response: Response): void {
    response.clearCookie('jwt', getSessionCookieOptions());
}
