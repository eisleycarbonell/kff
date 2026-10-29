import { AppError } from '../../errors/app-error.ts';

const SCALE = BigInt(10_000);
export function quantityUnits(value: string): bigint {
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
    const units = BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, '0'));
    return negative ? -units : units;
}
export function quantityString(units: bigint): string {
    const absolute = units < BigInt(0) ? -units : units;
    return `${units < BigInt(0) ? '-' : ''}${absolute / SCALE}.${(absolute % SCALE).toString().padStart(4, '0')}`;
}
export function outstandingReservations(
    rows: { qtyReserved: string; qtyConsumed: string; releasedAt: Date | null }[],
): string {
    return quantityString(
        rows.reduce(
            (total, row) =>
                row.releasedAt
                    ? total
                    : total + quantityUnits(row.qtyReserved) - quantityUnits(row.qtyConsumed),
            BigInt(0),
        ),
    );
}
export function planStockAdjustment(
    current: string,
    reserved: string,
    expected: string,
    counted: string,
): string {
    const onHand = quantityUnits(current);
    const target = quantityUnits(counted);
    if (onHand !== quantityUnits(expected)) {
        throw new AppError(
            409,
            'Stock has changed since this count was opened. Refresh stock and reopen the adjustment.',
        );
    }
    if (target < quantityUnits(reserved)) {
        throw new AppError(
            409,
            'The counted quantity cannot be lower than active reservations. Release or correct reservations first.',
        );
    }
    if (target === onHand)
        throw new AppError(
            400,
            'The counted quantity matches the current balance. No adjustment is needed.',
        );
    return quantityString(target - onHand);
}
