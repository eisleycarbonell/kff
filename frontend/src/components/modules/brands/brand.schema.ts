import { z } from "zod"
const id = z.int().positive().max(2_147_483_647)
export const brandSchema = z.object({
    brandId: id,
    code: z.string().min(1).max(30),
    name: z.string().min(1).max(120),
    description: z.string().max(2000).nullable(),
    isActive: z.boolean(),
    itemCount: z.int().nonnegative(),
    createdBy: id.nullable(),
    updatedBy: id.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
})
export type Brand = z.output<typeof brandSchema>
export type CreateBrandInput = Pick<Brand, "code" | "name" | "isActive" | "description">
export type UpdateBrandInput = Partial<CreateBrandInput>
export type BrandFormValues = Omit<CreateBrandInput, "description"> & { description: string }
export type BrandFormErrors = Partial<Record<keyof BrandFormValues, string>>
export function toBrandInput(values: BrandFormValues): CreateBrandInput {
    return {
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        description: values.description.trim() || null,
        isActive: values.isActive,
    }
}
export function validateBrand(values: BrandFormValues): BrandFormErrors {
    const errors: BrandFormErrors = {}
    if (!values.code.trim() || values.code.trim().length > 30)
        errors.code = "Enter a brand code with up to 30 characters."
    if (!values.name.trim() || values.name.trim().length > 120)
        errors.name = "Enter a name with up to 120 characters."
    if (values.description.trim().length > 2000)
        errors.description = "Use 2,000 characters or fewer."
    return errors
}
