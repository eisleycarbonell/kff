import type { Request, Response } from 'express';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import type * as settings from './company-setting.service.ts';
import type { settingsRequestSchema } from './company-setting.schema.ts';
export type SettingsService = Pick<typeof settings, 'getSettings' | 'updateSettings'>;
export function createSettingsController(service: SettingsService) {
    return {
        async get(_req: Request, res: Response) {
            return sendSuccessResponse(res, await service.getSettings());
        },
        async update(req: Request, res: ValidatedResponse<typeof settingsRequestSchema>) {
            return sendSuccessResponse(
                res,
                await service.updateSettings(res.locals.validated.body, Number(req.user!.id)),
            );
        },
    };
}
