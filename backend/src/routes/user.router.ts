import express, { type Express } from 'express';
import * as UserController from '../controllers/user.controller.ts';
// import { protectAuth } from '../middleware/auth.ts';

const app: Express = express();
const router = app.router;

// router.get('/', protectAuth, UserController.listUsers);
router.get('/', UserController.listUsers);

export default router;
