import { z } from "zod"

const id = z.int().positive().max(2_147_483_647)
const timestamp = z.iso.datetime({ offset: true })

export const customerSchema = z.object({
    customerId: id,
    name: z.string().min(1).max(120),
    contactName: z.string().max(100).nullable(),
    email: z.email().max(254).nullable(),
    phone: z.string().max(40).nullable(),
    address: z.string().max(500).nullable(),
    notes: z.string().max(2000).nullable(),
    isActive: z.boolean(),
    createdBy: id.nullable(),
    createdAt: timestamp,
    updatedBy: id.nullable(),
    updatedAt: timestamp,
})

export type Customer = z.output<typeof customerSchema>
export type CreateCustomerInput = Pick<Customer, "name"> &
    Partial<Pick<Customer, "contactName" | "email" | "phone" | "address" | "notes" | "isActive">>
export type UpdateCustomerInput = Partial<CreateCustomerInput>
export type CustomerFormValues = {
    name: string
    contactName: string
    email: string
    phone: string
    address: string
    notes: string
    isActive: boolean
}
export type CustomerFormErrors = Partial<Record<keyof CustomerFormValues, string>>

export function toCustomerInput(values: CustomerFormValues): CreateCustomerInput {
    return {
        name: values.name.trim(),
        contactName: values.contactName.trim() || null,
        email: values.email.trim().toLowerCase() || null,
        phone: values.phone.trim() || null,
        address: values.address.trim() || null,
        notes: values.notes.trim() || null,
        isActive: values.isActive,
    }
}

export function validateCustomer(values: CustomerFormValues): CustomerFormErrors {
    const errors: CustomerFormErrors = {}
    const input = toCustomerInput(values)
    if (!input.name) errors.name = "Enter a customer name."
    else if (input.name.length > 120) errors.name = "Use 120 characters or fewer."
    if (input.contactName && input.contactName.length > 100)
        errors.contactName = "Use 100 characters or fewer."
    if (input.email && !z.email().max(254).safeParse(input.email).success)
        errors.email = "Enter a valid email address with 254 characters or fewer."
    if (input.phone && input.phone.length > 40) errors.phone = "Use 40 characters or fewer."
    if (input.address && input.address.length > 500) errors.address = "Use 500 characters or fewer."
    if (input.notes && input.notes.length > 2000) errors.notes = "Use 2,000 characters or fewer."
    return errors
}
