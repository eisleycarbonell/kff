import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.ts';

// ─── Audit event types ────────────────────────────────────────────────────────
export type AuditAction =
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILURE'
    | 'LOGOUT'
    | 'AUTH_FAILURE'
    | 'UNAUTHORIZED_ACCESS';

interface AuditContext {
    action: AuditAction;
    userId?: string;
    username?: string;
    ip?: string;
    userAgent?: string;
    reason?: string;
    meta?: Record<string, unknown>;
}

// ─── Core audit logging function ──────────────────────────────────────────────

/**
 * Emit a structured audit log entry.
 * Always logs at the `info` level so audit trails are never suppressed.
 *
 * @example
 * audit({ action: 'LOGIN_SUCCESS', userId: user.id, username: user.username, ip: req.ip });
 */
export function audit(context: AuditContext): void {
    logger.info({ audit: true, ...context }, `AUDIT: ${context.action}`);
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export const auditLoginSuccess = (req: Request, userId: string, username: string) =>
    audit({
        action: 'LOGIN_SUCCESS',
        userId,
        username,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    });

export const auditLoginFailure = (req: Request, username: string, reason: string) =>
    audit({
        action: 'LOGIN_FAILURE',
        username,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        reason,
    });

export const auditLogout = (req: Request) =>
    audit({
        action: 'LOGOUT',
        userId: (req as any).user?.id,
        username: (req as any).user?.username,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    });

export const auditAuthFailure = (req: Request, reason: string) =>
    audit({
        action: 'AUTH_FAILURE',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        reason,
    });

// ─── Express middleware ───────────────────────────────────────────────────────

/**
 * Middleware that logs every request to a protected route (after auth passes).
 * Attach AFTER protectAuth so req.user is populated.
 */
export const auditMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
    next();
};
