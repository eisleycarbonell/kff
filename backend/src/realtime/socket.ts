import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import type { RoleSettings } from '../db/schema.ts';
import logger from '../utils/logger.ts';
import { verifyToken } from '../utils/jwtHandler.ts';

export const DATA_SYNC_EVENT = 'data:sync';
export const ROLE_NOTIFICATION_EVENT = 'notification:new';
export const SESSION_REFRESH_EVENT = 'session:refresh';
export const ALL_USERS_ROOM = 'all-users';

export const roleRoom = (roleId: number) => `role:${roleId}`;
export const userRoom = (userId: number) => `user:${userId}`;

export type SocketSessionUser = {
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
    roleId: number;
    permissions: RoleSettings;
};

export type DataSyncPayload = {
    eventId: string;
    module: string;
    action: string;
    method: string;
    path: string;
    entityId: string | null;
    queryKeys: string[];
    actorUserId: number | null;
    actorName: string | null;
    actorRoleId: number | null;
    timestamp: string;
};

export type RoleNotificationDto = {
    notificationId: number;
    title: string;
    message: string;
    module: string;
    action: string;
    entityId: string | null;
    route: string | null;
    targetRoleIds: number[];
    targetRoleNames: string[];
    selectionMode: 'auto' | 'custom' | 'manual';
    actorUserId: number | null;
    actorName: string;
    actorRoleId: number | null;
    actorRoleName: string | null;
    createdAt: string;
    isRead: boolean;
};

export type EmitOptions = {
    /** Socket that originated the change; it already refreshed its own cache. */
    excludeSocketId?: string | null;
};

export type RealtimeEmitter = {
    emitDataSync: (payload: DataSyncPayload, options?: EmitOptions) => void;
    emitRoleNotification: (notification: RoleNotificationDto) => void;
    refreshMemberships: () => Promise<void>;
};

let activeEmitter: RealtimeEmitter | null = null;

export function setRealtimeEmitter(emitter: RealtimeEmitter | null) {
    activeEmitter = emitter;
}

export function isRealtimeEnabled() {
    return activeEmitter !== null;
}

export function emitDataSync(payload: DataSyncPayload, options?: EmitOptions) {
    activeEmitter?.emitDataSync(payload, options);
}

export function emitRoleNotification(notification: RoleNotificationDto) {
    activeEmitter?.emitRoleNotification(notification);
}

/** Re-read every connected user's role after user or role changes. */
export function refreshRealtimeMemberships() {
    return activeEmitter?.refreshMemberships() ?? Promise.resolve();
}

const SOCKET_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export function normalizeSocketId(raw: unknown): string | null {
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && SOCKET_ID_PATTERN.test(value) ? value : null;
}

export function extractSocketToken(handshake: {
    auth?: Record<string, unknown>;
    headers: { cookie?: string; authorization?: string };
}): string | null {
    const authToken = typeof handshake.auth?.token === 'string' ? handshake.auth.token.trim() : '';
    if (authToken) return authToken;

    const bearer = handshake.headers.authorization;
    if (typeof bearer === 'string' && bearer.startsWith('Bearer ')) {
        return bearer.slice(7).trim();
    }

    const cookiePart = handshake.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('jwt='));
    if (!cookiePart) return null;
    try {
        return decodeURIComponent(cookiePart.slice(4));
    } catch {
        return null;
    }
}

function sameMembership(a: SocketSessionUser, b: SocketSessionUser) {
    return a.userId === b.userId && a.roleId === b.roleId;
}

export function attachSocketServer(
    httpServer: HttpServer,
    options: {
        corsOrigins: string[];
        getSessionUser: (userId: number) => Promise<SocketSessionUser | null>;
    },
) {
    const io = new SocketIOServer(httpServer, {
        cors: { origin: options.corsOrigins, credentials: true },
        // Clients only receive events, so keep inbound frames tiny.
        maxHttpBufferSize: 16 * 1024,
        serveClient: false,
        pingInterval: 25_000,
        pingTimeout: 20_000,
        // Replay events missed during short network drops (tab sleep, Wi-Fi switch).
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,
            skipMiddlewares: false,
        },
    });

    io.use(async (socket, next) => {
        try {
            const token = extractSocketToken(socket.handshake);
            if (!token) return next(new Error('Authentication required.'));

            const payload = await verifyToken(token);
            const id =
                typeof payload.id === 'string' && /^\d+$/.test(payload.id)
                    ? Number(payload.id)
                    : NaN;
            if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) {
                return next(new Error('Invalid session token.'));
            }

            const user = await options.getSessionUser(id);
            if (!user) return next(new Error('Account unavailable.'));

            socket.data.user = user;
            return next();
        } catch {
            return next(new Error('Invalid or expired session token.'));
        }
    });

    io.on('connection', (socket) => {
        const user = socket.data.user as SocketSessionUser | undefined;
        if (!user) {
            socket.disconnect(true);
            return;
        }

        // Recovered sockets keep their old rooms; drop a stale role room if the role changed.
        const currentRoleRoom = roleRoom(user.roleId);
        for (const room of socket.rooms) {
            if (room.startsWith('role:') && room !== currentRoleRoom) void socket.leave(room);
        }
        void socket.join([ALL_USERS_ROOM, currentRoleRoom, userRoom(user.userId)]);

        socket.emit('realtime:ready', {
            userId: user.userId,
            roleId: user.roleId,
            recovered: socket.recovered,
            connectedAt: new Date().toISOString(),
        });
    });

    let refreshInFlight: Promise<void> | null = null;

    async function refreshMemberships() {
        if (refreshInFlight) return refreshInFlight;
        refreshInFlight = (async () => {
            const sockets = await io.in(ALL_USERS_ROOM).fetchSockets();
            const cache = new Map<number, Promise<SocketSessionUser | null>>();
            await Promise.all(
                sockets.map(async (socket) => {
                    const current = socket.data.user as SocketSessionUser | undefined;
                    if (!current) return;
                    if (!cache.has(current.userId)) {
                        cache.set(current.userId, options.getSessionUser(current.userId));
                    }
                    const fresh = await cache.get(current.userId)!;
                    if (!fresh) {
                        socket.emit(SESSION_REFRESH_EVENT, { reason: 'account-removed' });
                        socket.disconnect(true);
                        return;
                    }
                    if (sameMembership(current, fresh)) {
                        socket.data.user = fresh;
                        return;
                    }
                    socket.leave(roleRoom(current.roleId));
                    socket.join(roleRoom(fresh.roleId));
                    socket.data.user = fresh;
                    socket.emit(SESSION_REFRESH_EVENT, { reason: 'role-changed' });
                }),
            );
        })()
            .catch((error) => {
                logger.warn(
                    { reason: error instanceof Error ? error.message : String(error) },
                    'Realtime membership refresh failed',
                );
            })
            .finally(() => {
                refreshInFlight = null;
            });
        return refreshInFlight;
    }

    const emitter: RealtimeEmitter = {
        emitDataSync(payload, emitOptions) {
            const target = emitOptions?.excludeSocketId
                ? io.to(ALL_USERS_ROOM).except(emitOptions.excludeSocketId)
                : io.to(ALL_USERS_ROOM);
            target.emit(DATA_SYNC_EVENT, payload);
        },
        emitRoleNotification(notification) {
            const roleIds = [...new Set(notification.targetRoleIds)];
            if (roleIds.length === 0) return;
            io.to(roleIds.map(roleRoom)).emit(ROLE_NOTIFICATION_EVENT, notification);
        },
        refreshMemberships,
    };

    setRealtimeEmitter(emitter);
    io.engine.on('connection_error', (error: { code?: number; message?: string }) => {
        logger.debug({ code: error.code, reason: error.message }, 'Socket.IO connection error');
    });
    logger.info('Socket.IO realtime server attached');

    return io;
}
