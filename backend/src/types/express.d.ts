import 'express-serve-static-core';
import type { RoleSettings } from '../db/schema.ts';

declare module 'express-serve-static-core' {
    interface Request {
        user?: {
            id: string;
            roleId: number;
            username: string;
            permissions?: RoleSettings;
        };
    }
}
