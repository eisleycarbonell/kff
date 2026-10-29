import { z } from "zod"
export const LOCATION_TYPES = [
    "Warehouse",
    "Packing",
    "Branch",
    "Store",
    "Quarantine",
    "Scrap",
    "In Transit",
] as const
const id = z.int().positive().max(2_147_483_647)
export const locationInputSchema = z.strictObject({
    code: z.string().trim().min(1, "Enter a location code.").max(30).toUpperCase(),
    name: z.string().trim().min(1, "Enter a location name.").max(100),
    locationType: z.enum(LOCATION_TYPES),
    isActive: z.boolean(),
})
export const locationSchema = z.object({
    ...locationInputSchema.shape,
    locationId: id,
    isInUse: z.boolean(),
    hasOperationalActivity: z.boolean(),
    createdBy: id.nullable(),
    updatedBy: id.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
})
export type Location = z.output<typeof locationSchema>
export type LocationInput = z.output<typeof locationInputSchema>
export type LocationFormErrors = Partial<Record<keyof LocationInput, string>>
export function validateLocation(
    values: LocationInput,
    locations: Location[],
    location: Location | null,
): LocationFormErrors {
    const errors: LocationFormErrors = {}
    const result = locationInputSchema.safeParse(values)
    if (!result.success)
        for (const issue of result.error.issues) {
            const field = issue.path[0] as keyof LocationInput
            errors[field] ??= issue.message
        }
    if (
        locations.some(
            (existing) =>
                existing.locationId !== location?.locationId &&
                existing.code.toUpperCase() === values.code.trim().toUpperCase(),
        )
    )
        errors.code = "A location with this code already exists."
    if (location?.isInUse && values.locationType !== location.locationType)
        errors.locationType = "The type is locked because this location is in use."
    if (location?.isActive && !values.isActive && location.hasOperationalActivity)
        errors.isActive = "Move stock and finish open work before deactivating this location."
    return errors
}
