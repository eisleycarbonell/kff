import { AppError } from '../../errors/app-error.ts';

const MAX_QUANTITY_UNITS = 99_999_999_999_999n;
export function receiptQuantityUnits(value: string): bigint {
    if (!/^\d{1,10}(?:\.\d{1,4})?$/.test(value))
        throw new AppError(400, 'Use a supported purchase quantity or price.');
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole!) * 10_000n + BigInt(fraction.padEnd(4, '0'));
}
export function receiptQuantityString(value: bigint): string {
    return `${value / 10_000n}.${(value % 10_000n).toString().padStart(4, '0')}`;
}
export function receiptFactorUnits(value: string): bigint {
    if (!/^\d{1,10}(?:\.\d{1,8})?$/.test(value))
        throw new AppError(400, 'A purchase unit has an invalid conversion factor.');
    const [whole, fraction = ''] = value.split('.');
    const result = BigInt(whole!) * 100_000_000n + BigInt(fraction.padEnd(8, '0'));
    if (result <= 0n) throw new AppError(400, 'Purchase unit conversion factors must be positive.');
    return result;
}
export function convertReceiptQuantity(
    qtyReceived: string,
    purchaseFactor: string,
    primaryFactor: string,
): string {
    const numerator = receiptQuantityUnits(qtyReceived) * receiptFactorUnits(purchaseFactor);
    const denominator = receiptFactorUnits(primaryFactor);
    if (numerator % denominator !== 0n)
        throw new AppError(
            400,
            'The purchase quantity cannot be represented exactly in the item primary unit with four decimal places.',
        );
    const units = numerator / denominator;
    if (units <= 0n || units > MAX_QUANTITY_UNITS)
        throw new AppError(
            400,
            'The converted receipt quantity is zero or exceeds the supported inventory quantity.',
        );
    return receiptQuantityString(units);
}
export function inverseReceiptQuantity(
    qtyPrimary: string,
    purchaseFactor: string,
    primaryFactor: string,
): string | null {
    const numerator = receiptQuantityUnits(qtyPrimary) * receiptFactorUnits(primaryFactor);
    const denominator = receiptFactorUnits(purchaseFactor);
    if (numerator % denominator !== 0n) return null;
    const units = numerator / denominator;
    return units > 0n && units <= MAX_QUANTITY_UNITS ? receiptQuantityString(units) : null;
}
export function receiptUnitCost(
    unitPrice: string,
    purchaseFactor: string,
    primaryFactor: string,
): string {
    const numerator = receiptQuantityUnits(unitPrice) * receiptFactorUnits(primaryFactor);
    const denominator = receiptFactorUnits(purchaseFactor);
    const rounded =
        numerator / denominator + ((numerator % denominator) * 2n >= denominator ? 1n : 0n);
    if (rounded > MAX_QUANTITY_UNITS)
        throw new AppError(
            400,
            'The converted primary-unit cost exceeds the supported cost range.',
        );
    return receiptQuantityString(rounded);
}
export function assertReceivableStatus(status: string) {
    if (status !== 'Sent' && status !== 'Partially Received')
        throw new AppError(
            409,
            'Only sent or partially received purchase orders can receive stock.',
        );
}
export function assertReceivingLocation(locationType: string) {
    if (locationType !== 'Warehouse' && locationType !== 'Quarantine')
        throw new AppError(
            400,
            'Receive purchased materials into an active warehouse or quarantine location.',
        );
}
export function planReceiptQuantities(
    current: readonly { poLineId: number; qtyOrdered: string; qtyReceived: string }[],
    entries: readonly { poLineId: number; qtyReceived: string; expectedQtyReceived: string }[],
) {
    if (entries.length < 1 || entries.length > 100) {
        throw new AppError(400, 'Receive between one and 100 lot entries at a time.');
    }
    const grouped = new Map<number, { expected: bigint; increment: bigint }>();
    for (const entry of entries) {
        const amount = receiptQuantityUnits(entry.qtyReceived);
        if (amount <= 0n) throw new AppError(400, 'Receipt quantities must be greater than zero.');
        const expected = receiptQuantityUnits(entry.expectedQtyReceived);
        const group = grouped.get(entry.poLineId);
        if (group && group.expected !== expected)
            throw new AppError(
                400,
                'Entries for the same purchase line must use the same starting received quantity.',
            );
        grouped.set(entry.poLineId, { expected, increment: (group?.increment ?? 0n) + amount });
    }
    const next = new Map<number, string>();
    for (const [id, group] of grouped) {
        const line = current.find((row) => row.poLineId === id);
        if (!line)
            throw new AppError(
                400,
                'Every receipt line must belong to the selected purchase order.',
            );
        const received = receiptQuantityUnits(line.qtyReceived);
        if (group.expected !== received)
            throw new AppError(
                409,
                'Received quantities changed. Refresh the purchase order before receiving again.',
            );
        const total = received + group.increment;
        if (total > receiptQuantityUnits(line.qtyOrdered))
            throw new AppError(409, 'The batch receipt exceeds the remaining purchase quantity.');
        next.set(id, receiptQuantityString(total));
    }
    const poStatus =
        current.length > 0 &&
        current.every(
            (line) =>
                receiptQuantityUnits(next.get(line.poLineId) ?? line.qtyReceived) ===
                receiptQuantityUnits(line.qtyOrdered),
        )
            ? ('Completed' as const)
            : ('Partially Received' as const);
    return { next, poStatus };
}
