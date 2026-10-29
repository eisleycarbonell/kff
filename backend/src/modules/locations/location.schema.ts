import { z } from 'zod';
export const LOCATION_TYPES = [
    'Warehouse',
    'Packing',
    'Branch',
    'Store',
    'Quarantine',
    'Scrap',
    'In Transit',
] as const;
const id = z.int().positive().max(2_147_483_647);
const fields = {
    code: z.string().trim().min(1).max(30).toUpperCase(),
    name: z.string().trim().min(1).max(100),
    locationType: z.enum(LOCATION_TYPES),
    isActive: z.boolean(),
};
export const createLocationSchema = z.strictObject({
    ...fields,
    isActive: fields.isActive.default(true),
});
export const updateLocationSchema = z
    .strictObject(fields)
    .partial()
    .refine(
        (value) => Object.values(value).some((field) => field !== undefined),
        'Provide at least one location field to update.',
    );
export const locationIdSchema = z.object({
    params: z.object({ id: z.string().regex(/^\d+$/).transform(Number).pipe(id) }),
});
export const createLocationRequestSchema = z.object({ body: createLocationSchema });
export const updateLocationRequestSchema = z.object({
    params: locationIdSchema.shape.params,
    body: updateLocationSchema,
});
export type CreateLocationInput = z.output<typeof createLocationSchema>;
export type UpdateLocationInput = z.output<typeof updateLocationSchema>;
