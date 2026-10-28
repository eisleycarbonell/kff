import { AppError } from '../../errors/app-error.ts';
type LocationState = {
    locationType: string;
    isActive: boolean;
    isInUse: boolean;
    hasOperationalActivity: boolean;
};
export function assertLocationChange(
    current: LocationState,
    next: Pick<LocationState, 'locationType' | 'isActive'>,
) {
    if (current.isInUse && current.locationType !== next.locationType)
        throw new AppError(409, 'This location is already in use. Its type cannot be changed.');
    if (current.isActive && !next.isActive && current.hasOperationalActivity)
        throw new AppError(
            409,
            'Move stock, release reservations, and complete or cancel open packing orders and transfers before deactivating this location.',
        );
}
export function assertActiveLocation(location: { isActive: boolean } | undefined) {
    if (!location) throw new AppError(400, 'Select an existing location.');
    if (!location.isActive)
        throw new AppError(409, 'This location is inactive. Select an active location.');
}
