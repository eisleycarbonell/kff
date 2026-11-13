import { AppError } from '../../errors/app-error.ts';

export const PURCHASE_ORDER_STATUSES = [
    'Draft',
    'Sent',
    'Partially Received',
    'Completed',
    'Cancelled',
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];
// ECMAScript String.trim whitespace, also used when matching imported SQL references.
export const PURCHASE_ORDER_TRIM_CHARACTERS =
    '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680' +
    '\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a' +
    '\u2028\u2029\u202f\u205f\u3000\ufeff';
export function generatedPurchaseOrderNumber(id: number, createdAt: Date) {
    if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647)
        throw new Error('The purchase-order identity is invalid.');
    return `PO-${createdAt.getUTCFullYear()}-${String(id).padStart(4, '0')}`;
}
export function assertSupplierMaterials(
    lines: readonly { itemId: number }[],
    supplierId: number,
    offers: readonly { supplierId: number; itemId: number; isActive: boolean }[],
) {
    for (const line of lines)
        if (
            !offers.some(
                (offer) =>
                    offer.supplierId === supplierId &&
                    offer.itemId === line.itemId &&
                    offer.isActive,
            )
        )
            throw new AppError(
                409,
                'Every purchase material must be actively linked to the selected supplier. Link the material in Suppliers or Items first.',
            );
}
const SCALE = 10_000n;

export function decimal4Units(value: string): bigint {
    if (!/^\d{1,10}(?:\.\d{1,4})?$/.test(value))
        throw new AppError(400, 'Invalid purchase-order decimal quantity or price.');
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole!) * SCALE + BigInt(fraction.padEnd(4, '0'));
}
export function fixedDecimal(value: bigint, places: number): string {
    const scale = 10n ** BigInt(places);
    const negative = value < 0n;
    const absolute = negative ? -value : value;
    return `${negative ? '-' : ''}${absolute / scale}.${(absolute % scale).toString().padStart(places, '0')}`;
}
export function purchaseOrderAmounts(
    lines: readonly { qtyOrdered: string; qtyReceived: string; unitPrice: string }[],
) {
    let total = 0n;
    let received = 0n;
    for (const line of lines) {
        const orderedUnits = decimal4Units(line.qtyOrdered);
        const receivedUnits = decimal4Units(line.qtyReceived);
        const priceUnits = decimal4Units(line.unitPrice);
        total += orderedUnits * priceUnits;
        received += receivedUnits * priceUnits;
    }
    return {
        totalAmount: fixedDecimal(total, 8),
        receivedAmount: fixedDecimal(received, 8),
        outstandingAmount: fixedDecimal(total - received, 8),
    };
}
export function purchaseOrderLineAmounts(line: {
    qtyOrdered: string;
    qtyReceived: string;
    unitPrice: string;
}) {
    return {
        qtyRemaining: fixedDecimal(
            decimal4Units(line.qtyOrdered) - decimal4Units(line.qtyReceived),
            4,
        ),
        lineTotal: fixedDecimal(decimal4Units(line.qtyOrdered) * decimal4Units(line.unitPrice), 8),
    };
}
export function assertDeliveryDate(
    orderDate: Date | string,
    expectedDeliveryDate: string | null | undefined,
) {
    if (
        expectedDeliveryDate &&
        expectedDeliveryDate < new Date(orderDate).toISOString().slice(0, 10)
    ) {
        throw new AppError(400, 'Expected delivery cannot be before the order date (UTC).');
    }
}
export function assertDraftEditable(order: { status: string; hasReceipts: boolean }) {
    if (order.status !== 'Draft')
        throw new AppError(409, 'Only draft purchase orders can be edited.');
    if (order.hasReceipts)
        throw new AppError(409, 'A purchase order with receiving history cannot be edited.');
}
export function assertPurchaseOrderAction(
    order: { status: string; hasReceipts: boolean },
    action: 'send' | 'cancel',
) {
    if (order.hasReceipts)
        throw new AppError(
            409,
            'A purchase order with receiving history cannot be sent or cancelled.',
        );
    if (action === 'send' && order.status !== 'Draft')
        throw new AppError(409, 'Only a draft purchase order can be marked as sent.');
    if (action === 'cancel' && order.status !== 'Draft' && order.status !== 'Sent')
        throw new AppError(
            409,
            'Only draft or sent purchase orders without receipts can be cancelled.',
        );
}
export function assertActiveSupplier(supplier: { isActive: boolean } | undefined) {
    if (!supplier) throw new AppError(400, 'Select an existing supplier.');
    if (!supplier.isActive)
        throw new AppError(409, 'Select an active supplier for this purchase order.');
}
export function assertPurchaseOrderLineDefinitions(
    lines: readonly { itemId: number; uomId: number }[],
    materials: readonly {
        itemId: number;
        isActive: boolean;
        itemType: string;
        primaryUomId: number;
    }[],
    units: readonly { uomId: number; uomClassId: number }[],
) {
    if (!lines.length) throw new AppError(400, 'Add at least one purchase-order line.');
    const pairs = new Set<string>();
    for (const line of lines) {
        const pair = `${line.itemId}:${line.uomId}`;
        if (pairs.has(pair))
            throw new AppError(400, 'Each item and unit pair can appear only once.');
        pairs.add(pair);
        const item = materials.find((material) => material.itemId === line.itemId);
        if (!item || !item.isActive || item.itemType === 'Finished Good')
            throw new AppError(400, 'Select active raw materials, packaging materials, or labels.');
        const primary = units.find((unit) => unit.uomId === item.primaryUomId);
        const selected = units.find((unit) => unit.uomId === line.uomId);
        if (!primary || !selected || primary.uomClassId !== selected.uomClassId)
            throw new AppError(
                400,
                "Every purchase unit must belong to its item's primary unit class.",
            );
    }
}
