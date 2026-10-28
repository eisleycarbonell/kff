import { AppError } from '../../errors/app-error.ts';

export function lotQuantityUnits(value: string): bigint {
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
    const units = BigInt(whole!) * 10_000n + BigInt(fraction.padEnd(4, '0'));
    return negative ? -units : units;
}
export function lotQuantityString(value: bigint): string {
    const absolute = value < 0n ? -value : value;
    return `${value < 0n ? '-' : ''}${absolute / 10_000n}.${(absolute % 10_000n).toString().padStart(4, '0')}`;
}
export function assertLotDates(
    manufactureDate: string | null | undefined,
    expirationDate: string | null | undefined,
) {
    if (manufactureDate && expirationDate && expirationDate <= manufactureDate) {
        throw new AppError(400, 'Expiration date must be after manufacture date.');
    }
}
export function assertLotMetadataChange(
    current: { manufactureDate: string | null; expirationDate: string | null; qcStatus: string },
    next: { manufactureDate: string | null; expirationDate: string | null; qcStatus: string },
    reserved: bigint,
) {
    assertLotDates(next.manufactureDate, next.expirationDate);
    if (
        reserved > 0n &&
        (current.manufactureDate !== next.manufactureDate ||
            current.expirationDate !== next.expirationDate ||
            current.qcStatus !== next.qcStatus)
    ) {
        throw new AppError(
            409,
            'Release outstanding reservations before changing lot dates or QC status.',
        );
    }
}
