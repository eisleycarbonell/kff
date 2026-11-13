import { AppError } from '../../errors/app-error.ts';
import { quantityUnits, quantityString } from '../inventory-stocks/inventory-stock.rules.ts';
export function assertActiveControlKind(kind: string) {
    if (kind !== 'Scrap' && kind !== 'Formula')
        throw new AppError(
            409,
            'Count Sessions, QC Decisions and Stock Dispositions have been removed. Historical requests are read-only.',
        );
}
export function assertReview(
    status: string,
    createdBy: number,
    submittedBy: number | null,
    actorId: number,
) {
    if (status !== 'Submitted') throw new AppError(409, 'Only submitted requests can be reviewed.');
    if (actorId === createdBy || actorId === submittedBy)
        throw new AppError(403, 'A different authorized user must review this request.');
}
export function assertExpected(onHand: string, expected: string) {
    if (quantityUnits(onHand) !== quantityUnits(expected))
        throw new AppError(
            409,
            'Stock changed after this snapshot. Reject and reopen the request, then recount or recreate it.',
        );
}
export function checkedBalance(onHand: string, reserved: string, change: string) {
    const result = quantityUnits(onHand) + quantityUnits(change);
    if (result < 0n || result < quantityUnits(reserved))
        throw new AppError(
            409,
            'This operation would consume stock reserved by another packing or delivery order.',
        );
    if (result > 99999999999999n)
        throw new AppError(400, 'The resulting stock exceeds the supported range.');
    return quantityString(result);
}
