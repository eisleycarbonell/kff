const DECIMAL_SCALE = 10_000n;
const HALF_SCALE = 5_000n;

export type CostBasis = 'Purchase Actual' | 'Packing Roll-Up' | 'Catalog Reference';
export type LotSourceKind = 'Purchase' | 'Packing' | 'Opening';

/** Parse a signed decimal string with arbitrary fractional digits into 4-decimal BigInt units (half-up). */
export function scaled4(value: string | number | null | undefined): bigint {
    if (value === null || value === undefined) return 0n;
    const text = String(value).trim();
    if (!/^-?\d+(?:\.\d+)?$/.test(text)) return 0n;
    const negative = text.startsWith('-');
    const unsigned = negative ? text.slice(1) : text;
    const [whole, fraction = ''] = unsigned.split('.');
    const padded = fraction.padEnd(5, '0');
    let units = BigInt(whole) * DECIMAL_SCALE + BigInt(padded.slice(0, 4));
    if (padded[4] >= '5') {
        units += 1n;
    }
    return negative ? -units : units;
}

/** Format 4-decimal BigInt units into an exact signed decimal string. */
export function formatScaled4(units: bigint): string {
    const negative = units < 0n;
    const abs = negative ? -units : units;
    const whole = abs / DECIMAL_SCALE;
    const fraction = (abs % DECIMAL_SCALE).toString().padStart(4, '0');
    return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Multiply two 4-decimal numbers (e.g. qty * unitCost) with signed half-up rounding to 4 decimals. */
export function multiplyScaled4(leftUnits: bigint, rightUnits: bigint): bigint {
    const product = leftUnits * rightUnits;
    if (product >= 0n) {
        return (product + HALF_SCALE) / DECIMAL_SCALE;
    }
    return -((-product + HALF_SCALE) / DECIMAL_SCALE);
}

/** Parse a percentage string (e.g. "12.00") into basis points (1200n for 12.00%). */
export function vatRateBasisPoints(ratePercent: string | number | null | undefined): bigint {
    if (ratePercent === null || ratePercent === undefined) return 0n;
    const text = String(ratePercent).trim();
    if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)) return 0n;
    const [whole, fraction = ''] = text.split('.');
    const bp = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
    return bp > DECIMAL_SCALE ? DECIMAL_SCALE : bp;
}

/** Compute exact 4-decimal VAT from net 4-decimal amount and percentage string (half-up). */
export function computeVat4(
    netUnits: bigint,
    ratePercent: string | number | null | undefined,
): bigint {
    const bp = vatRateBasisPoints(ratePercent);
    if (bp <= 0n || netUnits === 0n) return 0n;
    const product = netUnits * bp;
    if (product >= 0n) return (product + HALF_SCALE) / DECIMAL_SCALE;
    return -((-product + HALF_SCALE) / DECIMAL_SCALE);
}

/** Divide a 4-decimal total cost by a positive 4-decimal quantity into a 4-decimal unit cost. */
export function dividePerUnit4(totalUnits: bigint, qtyUnits: bigint): string | null {
    if (qtyUnits <= 0n) return null;
    const quotient = (totalUnits * DECIMAL_SCALE + qtyUnits / 2n) / qtyUnits;
    return formatScaled4(quotient);
}

/** Compute an exact percentage string (0.00 format) for profit / revenue share. */
export function percentString(partUnits: bigint, totalUnits: bigint): string | null {
    if (totalUnits <= 0n) return null;
    const basisPoints =
        partUnits >= 0n
            ? (partUnits * DECIMAL_SCALE + totalUnits / 2n) / totalUnits
            : -((-partUnits * DECIMAL_SCALE + totalUnits / 2n) / totalUnits);
    const negative = basisPoints < 0n;
    const abs = negative ? -basisPoints : basisPoints;
    const whole = abs / 100n;
    const frac = (abs % 100n).toString().padStart(2, '0');
    return `${negative ? '-' : ''}${whole}.${frac}`;
}

export function resolveEffectiveCost(
    lotUnitCost: string | null,
    catalogUnitCost: string,
    sourceType: LotSourceKind,
): { effectiveUnitCost: string; costBasis: CostBasis } {
    if (lotUnitCost !== null) {
        return {
            effectiveUnitCost: lotUnitCost,
            costBasis:
                sourceType === 'Purchase'
                    ? 'Purchase Actual'
                    : sourceType === 'Packing'
                      ? 'Packing Roll-Up'
                      : 'Catalog Reference',
        };
    }
    return {
        effectiveUnitCost: catalogUnitCost,
        costBasis: 'Catalog Reference',
    };
}
