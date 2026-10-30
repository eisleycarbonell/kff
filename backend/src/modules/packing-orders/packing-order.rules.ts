import { AppError } from '../../errors/app-error.ts';
import { quantityString, quantityUnits } from '../inventory-stocks/inventory-stock.rules.ts';

export { quantityString, quantityUnits };
const MAX = 99_999_999_999_999n;
function scaled(value: string, places: number): bigint {
    if (!new RegExp(`^\\d{1,10}(?:\\.\\d{1,${places}})?$`).test(value))
        throw new AppError(400, 'A material quantity or conversion factor is invalid.');
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole!) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'));
}
function checked(numerator: bigint, denominator: bigint): string {
    if (denominator <= 0n || numerator % denominator !== 0n)
        throw new AppError(
            400,
            'Material requirements must be exactly representable in the primary unit with four decimal places.',
        );
    const result = numerator / denominator;
    if (result <= 0n || result > MAX)
        throw new AppError(
            400,
            'The material requirement is zero or exceeds the supported inventory quantity.',
        );
    return quantityString(result);
}
export function packingRequirement(
    bomQuantity: string,
    target: string,
    bomFactor: string,
    primaryFactor: string,
): string {
    return checked(
        scaled(bomQuantity, 6) * quantityUnits(target) * scaled(bomFactor, 8),
        1_000_000n * scaled(primaryFactor, 8),
    );
}
export function packingConsumption(required: string, actual: string, target: string): string {
    if (quantityUnits(actual) <= 0n || quantityUnits(actual) > quantityUnits(target))
        throw new AppError(
            400,
            'Actual output must be greater than zero and cannot exceed the target.',
        );
    return checked(quantityUnits(required) * quantityUnits(actual), quantityUnits(target));
}
export function packingMaximum(available: string, required: string, target: string): string {
    const maximum = (quantityUnits(available) * quantityUnits(target)) / quantityUnits(required);
    const step = packingOutputStep([required], target);
    const capped = maximum > MAX ? MAX : maximum < 0n ? 0n : maximum;
    return quantityString((capped / step) * step);
}
export function packingOutputStep(requirements: readonly string[], target: string): bigint {
    const gcd = (left: bigint, right: bigint): bigint => {
        while (right !== 0n) [left, right] = [right, left % right];
        return left;
    };
    const output = quantityUnits(target);
    return requirements.reduce((step, required) => {
        const denominator = output / gcd(quantityUnits(required), output);
        return (step / gcd(step, denominator)) * denominator;
    }, 1n);
}
export function assertPackingStatus(status: string, allowed: readonly string[]) {
    if (!allowed.includes(status))
        throw new AppError(
            409,
            `This operation requires a packing order in ${allowed.join(' or ')} status.`,
        );
}
export function assertPackingLocation(type: string) {
    if (type !== 'Warehouse' && type !== 'Packing')
        throw new AppError(400, 'Packing requires an active warehouse or packing location.');
}
export function assertPackingLot(qcStatus: string, expirationDate: string | null, today: string) {
    if (qcStatus !== 'Approved' || (expirationDate !== null && expirationDate <= today))
        throw new AppError(409, 'Packing materials must use approved, unexpired lots.');
}
export function allocatePackingMaterial(
    required: string,
    candidates: readonly { lotId: number; qtyOnHand: string; qtyReserved: string }[],
) {
    let remaining = quantityUnits(required);
    const allocations: { lotId: number; qtyReserved: string }[] = [];
    for (const row of candidates) {
        const available = quantityUnits(row.qtyOnHand) - quantityUnits(row.qtyReserved);
        if (available <= 0n || remaining <= 0n) continue;
        const amount = available < remaining ? available : remaining;
        allocations.push({ lotId: row.lotId, qtyReserved: quantityString(amount) });
        remaining -= amount;
    }
    if (remaining > 0n)
        throw new AppError(
            409,
            'There is not enough available approved stock to reserve every material. Refresh availability.',
        );
    return allocations;
}
export function packingUnitCost(
    entries: readonly { qtyConsumed: string; unitCost: string | null }[],
    actual: string,
): string | null {
    if (entries.some((row) => row.unitCost === null)) return null;
    const numerator = entries.reduce(
        (sum, row) => sum + quantityUnits(row.qtyConsumed) * quantityUnits(row.unitCost!),
        0n,
    );
    const denominator = quantityUnits(actual);
    const rounded =
        numerator / denominator + ((numerator % denominator) * 2n >= denominator ? 1n : 0n);
    if (rounded > MAX)
        throw new AppError(400, 'The finished product cost exceeds the supported cost range.');
    return quantityString(rounded);
}
