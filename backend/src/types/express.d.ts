import 'express';

declare module 'express' {
    interface Request {
        user?: {
            id: string;
            roleId: number;
            username: string;
        };
    }
}
