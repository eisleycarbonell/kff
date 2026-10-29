import { Router, type RequestHandler } from 'express';
import { validateRequest } from '../../middleware/validate-request.ts';
import { createAuthController, type AuthService } from './auth.controller.ts';
import { loginRequestSchema } from './auth.schema.ts';

export function createAuthRouter(service: AuthService, authenticate: RequestHandler) {
    const router = Router();
    const controller = createAuthController(service);
    router.post('/login', validateRequest(loginRequestSchema), controller.login);
    router.post('/logout', controller.logout);
    router.get('/session', authenticate, controller.session);
    return router;
}
