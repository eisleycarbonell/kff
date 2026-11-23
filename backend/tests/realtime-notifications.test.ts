import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createApp, parseCorsOrigins } from '../src/app.ts';
import type { ItemService } from '../src/modules/items/item.controller.ts';
import type { NotificationService } from '../src/modules/notifications/notification.controller.ts';
import {
    formatActionSentence,
    resolveMutationContext,
    resolveTargetRoleIds,
} from '../src/modules/notifications/notification.rules.ts';
import { parseNotifyHeaders } from '../src/modules/notifications/notification.schema.ts';
import type { SessionUser } from '../src/modules/auth/auth.schema.ts';
import type { UserService } from '../src/modules/users/user.controller.ts';
import {
    attachSocketServer,
    emitDataSync,
    emitRoleNotification,
    setRealtimeEmitter,
    type RoleNotificationDto,
} from '../src/realtime/socket.ts';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-socket-secret-key';

const { generateToken } = await import('../src/utils/jwtHandler.ts');

const warehouseUser: SessionUser = {
    userId: 2,
    firstName: 'Marta',
    lastName: 'Reyes',
    email: 'warehouse@spice.local',
    roleId: 2,
    permissions: { canManageInventory: true, canManagePacking: true },
};

const accountingUser: SessionUser = {
    userId: 7,
    firstName: 'Lucia',
    lastName: 'Bautista',
    email: 'accounting@spice.local',
    roleId: 7,
    permissions: { canManageAccounting: true },
};

const usersById = new Map<number, SessionUser>([
    [warehouseUser.userId, warehouseUser],
    [accountingUser.userId, accountingUser],
]);

async function connectEngineIoClient(origin: string, cookieOrToken: { cookie?: string; token?: string }) {
    const headers: Record<string, string> = {};
    if (cookieOrToken.cookie) headers.cookie = cookieOrToken.cookie;

    const openRes = await fetch(`${origin}/socket.io/?EIO=4&transport=polling`, { headers });
    const openText = await openRes.text();
    assert.ok(openText.startsWith('0'), `Expected Engine.IO open packet, got: ${openText}`);
    const { sid } = JSON.parse(openText.slice(1)) as { sid: string };

    const connectBody = cookieOrToken.token
        ? `40${JSON.stringify({ token: cookieOrToken.token })}`
        : '40';
    const postRes = await fetch(`${origin}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
        method: 'POST',
        headers,
        body: connectBody,
    });
    assert.equal(postRes.status, 200);

    async function nextPacket(): Promise<string> {
        const pollRes = await fetch(`${origin}/socket.io/?EIO=4&transport=polling&sid=${sid}`, {
            headers,
        });
        return pollRes.text();
    }

    const first = await nextPacket();
    return { sid, first, nextPacket };
}

test('notification rules parse custom headers, map module sync keys and target roles cleanly', () => {
    assert.deepEqual(
        parseNotifyHeaders({
            'x-notify-mode': 'custom',
            'x-notify-role-ids': '7, 2, 7, invalid',
            'x-notify-message': encodeURIComponent('Check batch cost'),
        }),
        { mode: 'custom', roleIds: [7, 2], note: 'Check batch cost' },
    );
    assert.deepEqual(
        parseNotifyHeaders({
            'x-notify-mode': 'none',
            'x-notify-role-ids': '7',
        }),
        { mode: 'none', roleIds: [], note: null },
    );

    const ctx = resolveMutationContext('POST', '/api/packing-orders/12/complete');
    assert.equal(ctx.module, 'packing-orders');
    assert.equal(ctx.action, 'complete');
    assert.equal(ctx.entityId, '12');
    assert.ok(ctx.queryKeys.includes('accounting'));
    assert.ok(ctx.queryKeys.includes('dashboard'));
    assert.ok(ctx.queryKeys.includes('inventory-stocks'));

    const rolesList = [
        { roleId: 2, name: 'Warehouse', description: null, settings: { canManageInventory: true } },
        { roleId: 7, name: 'Accounting', description: null, settings: { canManageAccounting: true } },
        {
            roleId: 9,
            name: 'Tagged Sales Watcher',
            description: null,
            settings: { canManageInventory: true, notifySales: true },
        },
    ];
    assert.deepEqual(
        resolveTargetRoleIds(rolesList, { mode: 'custom', roleIds: [7] }, ['canManageInventory']).map(
            (r) => r.roleId,
        ),
        [7],
    );
    assert.deepEqual(
        resolveTargetRoleIds(
            rolesList,
            { mode: 'auto', roleIds: [] },
            ['canManageInventory'],
            'notifyPacking',
        ).map((r) => r.roleId),
        [2],
    );
    assert.deepEqual(
        resolveTargetRoleIds(
            rolesList,
            { mode: 'auto', roleIds: [] },
            ['canManageInventory'],
            'notifySales',
        ).map((r) => r.roleId),
        [2, 9],
    );
    assert.deepEqual(
        resolveTargetRoleIds(rolesList, { mode: 'none', roleIds: [] }, ['canManageInventory']),
        [],
    );

    const sentence = formatActionSentence('Marta Reyes', 'Packing Order', 'complete', '12', 'Urgent');
    assert.equal(sentence.title, 'Packing Order #12 completed');
    assert.ok(sentence.message.includes('Marta Reyes completed packing order #12. Note: Urgent'));
});

test('socket.io authenticates via cookie or socket-token, syncs all users, and isolates role notifications', async () => {
    const syncedPayloads: string[] = [];
    const sentNotifications: RoleNotificationDto[] = [];

    const mockNotificationService: NotificationService = {
        listNotificationRoles: async () => [
            {
                roleId: 2,
                name: 'Warehouse',
                description: null,
                settings: { canManageInventory: true },
            },
            {
                roleId: 7,
                name: 'Accounting',
                description: null,
                settings: { canManageAccounting: true },
            },
        ],
        listRoleNotifications: async (_userId, roleId) => ({
            items: sentNotifications.filter((n) => n.targetRoleIds.includes(roleId)),
            unreadCount: sentNotifications.filter((n) => n.targetRoleIds.includes(roleId) && !n.isRead)
                .length,
        }),
        createManualNotification: async (body, actor) => {
            const dto: RoleNotificationDto = {
                notificationId: sentNotifications.length + 1,
                title: body.title,
                message: body.message,
                module: 'manual',
                action: 'manual',
                entityId: null,
                route: body.route ?? null,
                targetRoleIds: body.targetRoleIds,
                targetRoleNames: ['Accounting'],
                selectionMode: 'manual',
                actorUserId: actor.userId,
                actorName: `${actor.firstName} ${actor.lastName}`,
                actorRoleId: actor.roleId,
                actorRoleName: 'Warehouse',
                createdAt: new Date().toISOString(),
                isRead: false,
            };
            sentNotifications.push(dto);
            emitRoleNotification(dto);
            return dto;
        },
        markNotificationRead: async () => undefined,
        markAllNotificationsRead: async () => undefined,
        recordMutationSyncAndNotification: async ({
            method,
            path,
            actor,
            notifySelection,
            originSocketId,
        }) => {
            const context = resolveMutationContext(method, path);
            syncedPayloads.push(`${context.module}:${context.action}`);
            emitDataSync(
                {
                    eventId: 'evt-1',
                    module: context.module,
                    action: context.action,
                    method,
                    path,
                    entityId: context.entityId,
                    queryKeys: context.queryKeys,
                    actorUserId: actor.userId,
                    actorName: `${actor.firstName} ${actor.lastName}`,
                    actorRoleId: actor.roleId,
                    timestamp: new Date().toISOString(),
                },
                { excludeSocketId: originSocketId },
            );
            if (notifySelection.mode !== 'none') {
                const targets = notifySelection.roleIds.length ? notifySelection.roleIds : [7];
                const dto: RoleNotificationDto = {
                    notificationId: sentNotifications.length + 1,
                    title: 'Item Catalog updated',
                    message: `${actor.firstName} ${actor.lastName} updated item catalog.${notifySelection.note ? ` Note: ${notifySelection.note}` : ''
                        }`,
                    module: context.module,
                    action: context.action,
                    entityId: context.entityId,
                    route: context.route,
                    targetRoleIds: targets,
                    targetRoleNames: ['Accounting'],
                    selectionMode: notifySelection.mode,
                    actorUserId: actor.userId,
                    actorName: `${actor.firstName} ${actor.lastName}`,
                    actorRoleId: actor.roleId,
                    actorRoleName: 'Warehouse',
                    createdAt: new Date().toISOString(),
                    isRead: false,
                };
                sentNotifications.push(dto);
                emitRoleNotification(dto);
            }
        },
    };

    const mockItemService = {
        getItem: async (id: number) => ({ itemId: id, name: 'Pepper' }),
        updateItem: async (id: number) => ({ itemId: id, name: 'Pepper Updated' }),
    } as unknown as ItemService;

    const app = createApp({
        userService: {} as UserService,
        authService: {
            getSessionUser: async (id) => usersById.get(id) ?? null,
            login: async () => null,
        },
        itemService: mockItemService,
        notificationService: mockNotificationService,
    });

    const httpServer = createServer(app);
    const io = attachSocketServer(httpServer, {
        corsOrigins: parseCorsOrigins(),
        getSessionUser: async (id) => usersById.get(id) ?? null,
    });

    try {
        httpServer.listen(0, '127.0.0.1');
        await once(httpServer, 'listening');
        const address = httpServer.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        const origin = `http://127.0.0.1:${port}`;

        const warehouseJwt = await generateToken({ id: String(warehouseUser.userId) }, '1h');
        const warehouseCookie = `jwt=${encodeURIComponent(warehouseJwt)}`;

        // 1. Unauthenticated Socket.IO connect fails
        const unauthClient = await connectEngineIoClient(origin, {});
        assert.match(unauthClient.first, /^44/, 'Unauthenticated socket must receive connect_error (44)');

        // 2. Socket token endpoint works for Socket.IO and is blocked on REST API
        const tokenRes = await fetch(`${origin}/api/auth/socket-token`, {
            headers: { cookie: warehouseCookie },
        });
        assert.equal(tokenRes.status, 200);
        const tokenBody = (await tokenRes.json()) as { data: { token: string } };
        const restBlocked = await fetch(`${origin}/api/notifications`, {
            headers: { authorization: `Bearer ${tokenBody.data.token}` },
        });
        assert.equal(restBlocked.status, 401);

        // 3. Connect BOTH Role 2 (Warehouse) via socket-token & Role 7 (Accounting) via cookie
        const accountingJwt = await generateToken({ id: String(accountingUser.userId) }, '1h');
        const clientRole2 = await connectEngineIoClient(origin, { token: tokenBody.data.token });
        const clientRole7 = await connectEngineIoClient(origin, {
            cookie: `jwt=${encodeURIComponent(accountingJwt)}`,
        });

        assert.ok(clientRole2.first.includes('realtime:ready'));
        assert.ok(clientRole7.first.includes('realtime:ready'));

        // 4. Warehouse user sends a manual notification ONLY to Role 7 (Accounting)
        const manualRes = await fetch(`${origin}/api/notifications`, {
            method: 'POST',
            headers: {
                cookie: warehouseCookie,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                title: 'Batch Cost Review',
                message: 'Please audit new batch pricing.',
                targetRoleIds: [7],
                route: '/accounting',
            }),
        });
        assert.equal(manualRes.status, 201);

        // Role 7 receives notification:new immediately
        const role7NotifyPacket = await clientRole7.nextPacket();
        assert.ok(role7NotifyPacket.includes('notification:new'));
        assert.ok(role7NotifyPacket.includes('Batch Cost Review'));

        // 5. Global data sync goes to ALL connected roles when any mutation completes
        emitDataSync({
            eventId: 'evt-sync-all',
            module: 'items',
            action: 'updated',
            method: 'PATCH',
            path: '/api/items/12',
            entityId: '12',
            queryKeys: ['items', 'accounting'],
            actorUserId: 2,
            actorName: 'Marta Reyes',
            actorRoleId: 2,
            timestamp: new Date().toISOString(),
        });

        // Role 2 gets ONLY data:sync (proving it never got Role 7's notification:new!)
        const role2Packet = await clientRole2.nextPacket();
        assert.ok(role2Packet.includes('data:sync'));
        assert.ok(!role2Packet.includes('Batch Cost Review'));

        // Role 7 ALSO gets data:sync
        const role7SyncPacket = await clientRole7.nextPacket();
        assert.ok(role7SyncPacket.includes('data:sync'));

        // 5b. Mutation HTTP request with X-Notify-Role-Ids notifies ONLY Role 7 while syncing ALL users
        const updateRes = await fetch(`${origin}/api/items/12`, {
            method: 'PATCH',
            headers: {
                cookie: warehouseCookie,
                'content-type': 'application/json',
                'x-notify-mode': 'custom',
                'x-notify-role-ids': '7',
                'x-notify-message': encodeURIComponent('Audit updated pepper cost'),
            },
            body: JSON.stringify({ name: 'Black Pepper Premium' }),
        });
        assert.equal(updateRes.status, 200);
        assert.ok(syncedPayloads.includes('items:updated'));

        const role2AfterUpdate = await clientRole2.nextPacket();
        assert.ok(role2AfterUpdate.includes('data:sync'));
        assert.ok(!role2AfterUpdate.includes('Audit updated pepper cost'));

        const role7AfterUpdate = await clientRole7.nextPacket();
        assert.ok(role7AfterUpdate.includes('data:sync'));
        assert.ok(role7AfterUpdate.includes('notification:new'));
        assert.ok(role7AfterUpdate.includes('Audit updated pepper cost'));

        // 5c. Originating socket is skipped via X-Socket-Id on PATCH while other sockets sync
        const clientRole2SocketId = clientRole2.first.match(/40\{"sid":"([^"]+)"/)?.[1];
        assert.ok(clientRole2SocketId, 'Expected Socket.IO sid from handshake packet');
        const excludedUpdateRes = await fetch(`${origin}/api/items/12`, {
            method: 'PATCH',
            headers: {
                cookie: warehouseCookie,
                'content-type': 'application/json',
                'x-notify-mode': 'none',
                'x-socket-id': clientRole2SocketId,
            },
            body: JSON.stringify({ name: 'Excluded Echo Check' }),
        });
        assert.equal(excludedUpdateRes.status, 200);

        const role7ExcludedCheck = await clientRole7.nextPacket();
        assert.ok(role7ExcludedCheck.includes('data:sync'));
        assert.ok(role7ExcludedCheck.includes('/api/items/12'));

        emitDataSync({
            eventId: 'evt-sentinel',
            module: 'items',
            action: 'updated',
            method: 'PATCH',
            path: '/api/items/sentinel',
            entityId: '999',
            queryKeys: ['items'],
            actorUserId: 7,
            actorName: 'Lucia Bautista',
            actorRoleId: 7,
            timestamp: new Date().toISOString(),
        });

        const role2NextPacket = await clientRole2.nextPacket();
        assert.ok(role2NextPacket.includes('evt-sentinel'));
        assert.ok(!role2NextPacket.includes('/api/items/12'));

        const role7Sentinel = await clientRole7.nextPacket();
        assert.ok(role7Sentinel.includes('evt-sentinel'));

        // 6. Roles endpoint lets authenticated non-admin users read role targets
        const rolesRes = await fetch(`${origin}/api/notifications/roles`, {
            headers: { cookie: warehouseCookie },
        });
        assert.equal(rolesRes.status, 200);
        const rolesJson = (await rolesRes.json()) as { data: Array<{ roleId: number }> };
        assert.equal(rolesJson.data.length, 2);
    } finally {
        setRealtimeEmitter(null);
        io.disconnectSockets(true);
        await new Promise<void>((resolve) => {
            io.close(() => resolve());
            httpServer.closeAllConnections();
        });
    }
});
