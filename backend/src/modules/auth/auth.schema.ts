import { z } from 'zod';
import type { RoleSettings } from '../../db/schema.ts';

export const loginRequestSchema = z.object({
    body: z.strictObject({
        username: z.string().trim().toLowerCase().pipe(z.email().max(254)),
        password: z.string().min(1).max(128),
    }),
});
export type LoginInput = z.output<typeof loginRequestSchema>['body'];
export type SessionUser = {
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
    roleId: number;
    permissions: RoleSettings;
};
