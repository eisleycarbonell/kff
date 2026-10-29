import { AppError } from '../../errors/app-error.ts';

export function assertSupplierDeactivation(hasOpenPurchaseOrders: boolean, nextActive: boolean) {
    if (!nextActive && hasOpenPurchaseOrders) {
        throw new AppError(
            409,
            'Complete or cancel open purchase orders before deactivating this supplier.',
        );
    }
}

export function supplierItemStatus(
    current: { isActive: boolean; isPreferred: boolean },
    changes: { isActive?: boolean; isPreferred?: boolean },
) {
    const isActive = changes.isActive ?? current.isActive;
    if (!isActive && changes.isPreferred === true) {
        throw new AppError(400, 'An inactive supplier item cannot be preferred.');
    }
    return { isActive, isPreferred: isActive && (changes.isPreferred ?? current.isPreferred) };
}

export function assertSupplierItemDefinition(input: {
    supplierActive: boolean;
    itemActive: boolean;
    itemType: string;
    itemUomClassId: number;
    defaultUomClassId: number;
    isActive: boolean;
}) {
    if (input.defaultUomClassId !== input.itemUomClassId) {
        throw new AppError(400, "The supplier unit must belong to the item's primary unit class.");
    }
    if (input.isActive && !input.supplierActive) {
        throw new AppError(409, 'Reactivate the supplier before activating its item offers.');
    }
    if (input.isActive && (!input.itemActive || input.itemType === 'Finished Good')) {
        throw new AppError(400, 'Select an active raw material, packaging material, or label.');
    }
}

export function assertPreferredSupplierAvailable(hasOtherPreferred: boolean) {
    if (hasOtherPreferred) {
        throw new AppError(
            409,
            'Another supplier is already preferred for this item. Clear its preference first.',
        );
    }
}
