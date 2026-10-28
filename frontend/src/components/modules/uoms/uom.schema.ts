import { z } from "zod"
const id = z.int().positive().max(2_147_483_647)
const factor = z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,8})?$/, "Use up to 10 whole digits and 8 decimal places.")
    .refine((value) => /[1-9]/.test(value), "The factor must be greater than zero.")
export const uomInputSchema = z
    .strictObject({
        name: z.string().trim().min(1, "Enter a unit name.").max(20),
        uomClassId: id,
        factorToBase: factor,
        isBase: z.boolean(),
    })
    .refine((value) => !value.isBase || /^0*1(?:\.0+)?$/.test(value.factorToBase), {
        path: ["factorToBase"],
        message: "A base unit must have a factor of 1.",
    })
export const uomSchema = z.object({
    ...uomInputSchema.shape,
    uomId: id,
    uomClassName: z.string(),
    isInUse: z.boolean(),
    isClassAnchor: z.boolean(),
    createdBy: id.nullable(),
    updatedBy: id.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
})
export const uomClassInputSchema = z.strictObject({
    name: z.string().trim().min(1, "Enter a class name.").max(30),
})
export const uomClassSchema = z.object({
    ...uomClassInputSchema.shape,
    uomClassId: id,
    unitCount: z.int().nonnegative(),
    baseUomName: z.string().nullable(),
    createdBy: id.nullable(),
    updatedBy: id.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
})
export type Uom = z.output<typeof uomSchema>
export type UomClass = z.output<typeof uomClassSchema>
export type UomInput = z.output<typeof uomInputSchema>
export type UomFormValues = Omit<UomInput, "uomClassId"> & { uomClassId: number | null }
export type UomFormErrors = Partial<Record<keyof UomFormValues, string>>
export function factorUnits(value: string): bigint {
    const [whole, fraction = ""] = value.split(".")
    return BigInt(whole!) * BigInt(100000000) + BigInt(fraction.padEnd(8, "0"))
}
export function formatFactor(value: string) {
    const [whole, fraction = ""] = value.split(".")
    const tail = fraction.replace(/0+$/, "")
    return BigInt(whole!).toLocaleString("en") + (tail ? "." + tail : "")
}
export function validateUom(
    values: UomFormValues,
    units: Uom[],
    classes: UomClass[],
    unit: Uom | null,
): UomFormErrors {
    const errors: UomFormErrors = {}
    const parsed = uomInputSchema.safeParse(values)
    if (!parsed.success)
        for (const issue of parsed.error.issues) {
            const field = issue.path[0] as keyof UomFormValues
            errors[field] ??= issue.message
        }
    if (!classes.some((group) => group.uomClassId === values.uomClassId))
        errors.uomClassId = "Select a unit class."
    if (
        units.some(
            (existing) => existing.uomId !== unit?.uomId && existing.name === values.name.trim(),
        )
    )
        errors.name = "A unit with this name already exists."
    const otherBase = units.some(
        (existing) =>
            existing.uomId !== unit?.uomId &&
            existing.uomClassId === values.uomClassId &&
            existing.isBase,
    )
    if (values.isBase && otherBase) errors.isBase = "This class already has a base unit."
    if (!values.isBase && !otherBase) errors.isBase = "Create the base unit for this class first."
    if (
        unit &&
        (unit.isInUse || unit.isClassAnchor) &&
        parsed.success &&
        (unit.uomClassId !== parsed.data.uomClassId ||
            unit.isBase !== parsed.data.isBase ||
            factorUnits(unit.factorToBase) !== factorUnits(parsed.data.factorToBase))
    )
        errors.factorToBase = "Conversion settings are locked because this unit is in use."
    return errors
}
