import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/auth.schema.ts';
import type * as notificationService from './notification.service.ts';
import type {
    listNotificationsQuerySchema,
    notificationIdRequestSchema,
    sendNotificationRequestSchema,
} from './notification.schema.ts';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessNoDataResponse, sendSuccessResponse } from '../../utils/responseHandler.ts';

export type NotificationService = Pick<
    typeof notificationService,
    | 'listNotificationRoles'
    | 'listRoleNotifications'
    | 'createManualNotification'
    | 'markNotificationRead'
    | 'markAllNotificationsRead'
    | 'recordMutationSyncAndNotification'
>;

function getSessionActor(request: Request, response: Response): SessionUser {
    const locals = response.locals as { session?: SessionUser };
    if (locals.session) return locals.session;
    return {
        userId: Number(request.user!.id),
        firstName: request.user!.username,
        lastName: '',
        email: request.user!.username,
        roleId: request.user!.roleId,
        permissions: request.user!.permissions ?? {},
    };
}

export function createNotificationController(service: NotificationService) {
    return {
        async roles(_request: Request, response: Response) {
            return sendSuccessResponse(response, await service.listNotificationRoles());
        },
        async list(request: Request, response: ValidatedResponse<typeof listNotificationsQuerySchema>) {
            const session = getSessionActor(request, response);
            const query = response.locals.validated.query;
            return sendSuccessResponse(
                response,
                await service.listRoleNotifications(session.userId, session.roleId, query),
            );
        },
        async send(request: Request, response: ValidatedResponse<typeof sendNotificationRequestSchema>) {
            const session = getSessionActor(request, response);
            const body = response.locals.validated.body;
            const created = await service.createManualNotification(body, session);
            return sendSuccessResponse(response, created, 201);
        },
        async markRead(
            request: Request,
            response: ValidatedResponse<typeof notificationIdRequestSchema>,
        ) {
            const session = getSessionActor(request, response);
            const { id } = response.locals.validated.params;
            await service.markNotificationRead(id, session.userId, session.roleId);
            return sendSuccessNoDataResponse(response, 'Notification marked as read.');
        },
        async markAllRead(request: Request, response: Response) {
            const session = getSessionActor(request, response);
            await service.markAllNotificationsRead(session.userId, session.roleId);
            return sendSuccessNoDataResponse(response, 'All role notifications marked as read.');
        },
    };
}
