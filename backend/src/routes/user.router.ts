import { Router } from 'express';
import * as UserController from '../controllers/user.controller.ts';
// import { protectAuth } from '../middleware/auth.ts';

const router = Router();

// router.get('/', protectAuth, UserController.listUsers);
router.get('/', UserController.listUsers);
router.get('/:id', UserController.getUser);
router.post('/', UserController.createUser);
router.patch('/:id', UserController.updateUser);
router.delete('/:id', UserController.deleteUser);

export default router;
