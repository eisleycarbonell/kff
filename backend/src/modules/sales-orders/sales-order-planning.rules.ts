import { AppError } from '../../errors/app-error.ts';
import { quantityString, quantityUnits } from '../inventory-stocks/inventory-stock.rules.ts';

const nonnegative = (value: bigint) => (value < 0n ? 0n : value);
const maximum = 99_999_999_999_999n;
export function planningDemand(
    line: {
        qtyOrdered: string;
        qtyDelivered: string;
        qtyAllocated: string;
        qtyDraftAllocated: string;
        qtyFinishedAvailable: string;
    },
    cancelled = false,
) {
    const demand = cancelled
        ? 0n
        : nonnegative(
              quantityUnits(line.qtyOrdered) -
                  quantityUnits(line.qtyDelivered) -
                  quantityUnits(line.qtyAllocated),
          );
    // Draft demand is excluded above; do not reuse its physical supply for the rest.
    const available = nonnegative(
        quantityUnits(line.qtyFinishedAvailable) - quantityUnits(line.qtyDraftAllocated),
    );
    const fromStock = available < demand ? available : demand;
    return {
        qtyDemand: quantityString(demand),
        qtyFinishedAvailable: quantityString(available),
        qtyFromStock: quantityString(fromStock),
        qtyToPack: quantityString(demand - fromStock),
    };
}
export type PlanningMaterial = {
    itemId: number;
    itemSku: string;
    itemName: string;
    uomName: string;
    requiredQty: string;
};
export function aggregatePlanningMaterials(
    requirements: readonly PlanningMaterial[],
    available: ReadonlyMap<number, string>,
    suppliers: ReadonlyMap<number, { supplierId: number; name: string }[]>,
) {
    const grouped = new Map<number, PlanningMaterial & { required: bigint }>();
    for (const row of requirements) {
        const previous = grouped.get(row.itemId);
        const required = (previous?.required ?? 0n) + quantityUnits(row.requiredQty);
        if (required > maximum)
            throw new AppError(
                400,
                'Combined material requirements exceed the supported inventory quantity.',
            );
        grouped.set(row.itemId, { ...row, required });
    }
    return [...grouped.values()]
        .map(({ requiredQty: _requiredQty, required, ...row }) => {
            const supply = nonnegative(quantityUnits(available.get(row.itemId) ?? '0'));
            return {
                ...row,
                qtyRequired: quantityString(required),
                qtyAvailable: quantityString(supply),
                qtyShortage: quantityString(nonnegative(required - supply)),
                suppliers: suppliers.get(row.itemId) ?? [],
            };
        })
        .sort((left, right) => left.itemId - right.itemId);
}
