import type { Request, Response } from 'express';
import type { ValidatedResponse } from '../../middleware/validate-request.ts';
import { sendSuccessResponse } from '../../utils/responseHandler.ts';
import { AppError } from '../../errors/app-error.ts';
import { assertActiveControlKind } from './inventory-control.rules.ts';
import type * as controls from './inventory-control.service.ts';
import type {
    controlActionRequestSchema,
    controlCreateRequestSchema,
    controlIdRequestSchema,
    controlListRequestSchema,
    observationsRequestSchema,
} from './inventory-control.schema.ts';
export type ControlService = Pick<
    typeof controls,
    | 'listControls'
    | 'getControl'
    | 'getControlOptions'
    | 'createControl'
    | 'saveCountObservations'
    | 'actOnControl'
>;
function writeAccess(req: Request, kind: string, review = false) {
    const permission = kind === 'Formula' ? 'canManagePacking' : 'canManageInventory';
    if (!req.user?.permissions?.[permission] || (review && !req.user.permissions.canManageUsers))
        throw new AppError(403, 'Your role does not allow this workflow action.');
    assertActiveControlKind(kind);
}
export function createControlController(service: ControlService) {
    return {
        async list(_req: Request, res: ValidatedResponse<typeof controlListRequestSchema>) {
            return sendSuccessResponse(
                res,
                await service.listControls(res.locals.validated.query.kind),
            );
        },
        async get(_req: Request, res: ValidatedResponse<typeof controlIdRequestSchema>) {
            const record = await service.getControl(res.locals.validated.params.id);
            if (!record) throw new AppError(404, 'Request not found.');
            return sendSuccessResponse(res, record);
        },
        async options(_req: Request, res: Response) {
            return sendSuccessResponse(res, await service.getControlOptions());
        },
        async create(req: Request, res: ValidatedResponse<typeof controlCreateRequestSchema>) {
            const input = res.locals.validated.body;
            writeAccess(req, input.kind);
            return sendSuccessResponse(
                res,
                await service.createControl(input, Number(req.user!.id)),
                201,
            );
        },
        async observe(req: Request, res: ValidatedResponse<typeof observationsRequestSchema>) {
            writeAccess(req, 'Count');
            const record = await service.saveCountObservations(
                res.locals.validated.params.id,
                res.locals.validated.body,
                Number(req.user!.id),
            );
            if (!record) throw new AppError(404, 'Request not found.');
            return sendSuccessResponse(res, record);
        },
        async action(req: Request, res: ValidatedResponse<typeof controlActionRequestSchema>) {
            const id = res.locals.validated.params.id;
            const input = res.locals.validated.body;
            const current = await service.getControl(id);
            if (!current) throw new AppError(404, 'Request not found.');
            writeAccess(req, current.kind, ['approve', 'reject'].includes(input.action));
            return sendSuccessResponse(
                res,
                await service.actOnControl(id, input, Number(req.user!.id)),
            );
        },
    };
}
