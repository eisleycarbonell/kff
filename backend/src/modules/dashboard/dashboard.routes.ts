import { Router, type RequestHandler } from 'express';
import { createDashboardController, type DashboardService } from './dashboard.controller.ts';

export function createDashboardRouter(
    service: DashboardService,
    authenticate: RequestHandler,
) {
    const router = Router();
    const controller = createDashboardController(service);

    router.use(authenticate);
    router.get('/', controller.getDashboard);

    return router;
}
