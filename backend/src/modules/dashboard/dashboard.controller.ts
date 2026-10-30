import type { Request, Response } from 'express';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as service from './dashboard.service.ts';

export type DashboardService = Pick<typeof service, 'getDashboardData'>;

export function createDashboardController(dashboardService: DashboardService) {
    return {
        async getDashboard(_request: Request, response: Response) {
            const data = await dashboardService.getDashboardData();
            return sendSuccessResponse(response, data);
        },
    };
}
