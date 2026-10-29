import { AppError } from '../../errors/app-error.ts';
export function factorUnits(value: string): bigint {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * BigInt(100_000_000) + BigInt(fraction.padEnd(8, '0'));
}
type Definition = { uomClassId: number; factorToBase: string; isBase: boolean };
export function assertUomDefinition(value: Definition, hasOtherBase: boolean) {
    if (value.isBase && factorUnits(value.factorToBase) !== BigInt(100_000_000))
        throw new AppError(400, 'A base unit must have a factor of 1.');
    if (value.isBase && hasOtherBase)
        throw new AppError(409, 'This class already has a base unit.');
    if (!value.isBase && !hasOtherBase)
        throw new AppError(
            400,
            'Create the base unit for this class before adding conversion units.',
        );
}
export function assertUomChange(
    current: Definition & { isInUse: boolean; isClassAnchor: boolean },
    next: Definition,
) {
    const changed =
        current.uomClassId !== next.uomClassId ||
        current.isBase !== next.isBase ||
        factorUnits(current.factorToBase) !== factorUnits(next.factorToBase);
    if (changed && (current.isInUse || current.isClassAnchor))
        throw new AppError(
            409,
            'Class, conversion factor, and base status cannot change while the unit is referenced or anchors other units.',
        );
}
export function assertUomCanBeDeleted(value: { isInUse: boolean; isClassAnchor: boolean }) {
    if (value.isInUse || value.isClassAnchor)
        throw new AppError(
            409,
            'This unit is referenced or anchors other units and cannot be deleted.',
        );
}
export function assertClassCanBeDeleted(unitCount: number) {
    if (unitCount > 0)
        throw new AppError(409, 'Remove the units in this class before deleting it.');
}
