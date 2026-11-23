import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../middleware/validate-request.ts';
import {
    createNotificationController,
    type NotificationService,
} from './notification.controller.ts';
import {
    listNotificationsQuerySchema,
    notificationIdRequestSchema,
    sendNotificationRequestSchema,
} from './notification.schema.ts';

export function createNotificationRouter(
    service: NotificationService,
    authenticate: RequestHandler,
) {
    const router = Router();
    const controller = createNotificationController(service);
    router.use(authenticate);
    router.get('/roles', controller.roles);
    router.get('/', validateRequest(listNotificationsQuerySchema), controller.list);
    router.post('/', validateRequest(sendNotificationRequestSchema), controller.send);
    router.post('/read-all', controller.markAllRead);
    router.patch('/:id/read', validateRequest(notificationIdRequestSchema), controller.markRead);
    return router;
}
