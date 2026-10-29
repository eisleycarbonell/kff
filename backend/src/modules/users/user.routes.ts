import { Router } from 'express';

import { validateRequest } from '../../middleware/validate-request.ts';
import { createUserController, type UserService } from './user.controller.ts';
import {
    createUserRequestSchema,
    updateUserRequestSchema,
    userIdRequestSchema,
} from './user.schema.ts';

export function createUserRouter(service: UserService) {
    const router = Router();
    const controller = createUserController(service);

    router.get('/', controller.listUsers);
    router.get('/:id', validateRequest(userIdRequestSchema), controller.getUser);
    router.post('/', validateRequest(createUserRequestSchema), controller.createUser);
    router.patch('/:id', validateRequest(updateUserRequestSchema), controller.updateUser);
    router.delete('/:id', validateRequest(userIdRequestSchema), controller.deleteUser);

    return router;
}
