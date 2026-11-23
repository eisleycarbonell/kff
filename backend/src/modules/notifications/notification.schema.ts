import { z } from 'zod';

const positivePgInt = z.int().positive().max(2_147_483_647);

const notificationIdParam = z.preprocess(
    (value) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value),
    positivePgInt,
);

export const notificationIdRequestSchema = z.object({
    params: z.strictObject({
        id: notificationIdParam,
    }),
});

export const listNotificationsQuerySchema = z.object({
    query: z.strictObject({
        limit: z.preprocess(
            (value) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value),
            z.int().min(1).max(100).optional(),
        ),
        unreadOnly: z.preprocess(
            (value) => (value === 'true' ? true : value === 'false' ? false : value),
            z.boolean().optional(),
        ),
    }),
});

export const sendNotificationRequestSchema = z.object({
    body: z.strictObject({
        title: z.string().trim().min(1, 'Notification title is required.').max(120),
        message: z.string().trim().min(1, 'Notification message is required.').max(500),
        targetRoleIds: z
            .array(positivePgInt)
            .min(1, 'Select at least one role to notify.')
            .max(25),
        route: z
            .string()
            .trim()
            .max(200)
            .refine((value) => value.startsWith('/'), {
                message: 'Route must start with "/".',
            })
            .optional(),
    }),
});

export type ListNotificationsQuery = z.output<typeof listNotificationsQuerySchema>['query'];
export type SendNotificationInput = z.output<typeof sendNotificationRequestSchema>['body'];

export type NotifyHeaderSelection = {
    mode: 'auto' | 'custom' | 'none';
    roleIds: number[];
    note: string | null;
};

export function parseNotifyHeaders(
    headers: Record<string, string | string[] | undefined>,
): NotifyHeaderSelection {
    const rawMode = Array.isArray(headers['x-notify-mode'])
        ? headers['x-notify-mode'][0]
        : headers['x-notify-mode'];
    const normalizedMode = rawMode?.trim().toLowerCase();

    const rawRoleIds = Array.isArray(headers['x-notify-role-ids'])
        ? headers['x-notify-role-ids'][0]
        : headers['x-notify-role-ids'];
    const parsedRoleIds = rawRoleIds
        ? [
              ...new Set(
                  rawRoleIds
                      .split(',')
                      .map((part) => part.trim())
                      .filter((part) => /^\d+$/.test(part))
                      .map((part) => Number(part))
                      .filter((id) => Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647),
              ),
          ]
        : [];

    const rawNote = Array.isArray(headers['x-notify-message'])
        ? headers['x-notify-message'][0]
        : headers['x-notify-message'];
    let decodedNote: string | null = null;
    if (typeof rawNote === 'string' && rawNote.trim()) {
        try {
            decodedNote = decodeURIComponent(rawNote.trim()).slice(0, 300).trim() || null;
        } catch {
            decodedNote = rawNote.trim().slice(0, 300).trim() || null;
        }
    }

    if (normalizedMode === 'none') {
        return { mode: 'none', roleIds: [], note: null };
    }

    if (parsedRoleIds.length > 0) {
        return { mode: 'custom', roleIds: parsedRoleIds, note: decodedNote };
    }

    return { mode: 'auto', roleIds: [], note: decodedNote };
}
