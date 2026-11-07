import { and, asc, eq, inArray } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { customers, salesOrders } from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type { CreateCustomerInput, UpdateCustomerInput } from './customer.schema.ts';

const customerFields = {
    customerId: customers.customerId,
    name: customers.name,
    contactName: customers.contactName,
    email: customers.email,
    phone: customers.phone,
    address: customers.address,
    notes: customers.notes,
    isActive: customers.isActive,
    createdBy: customers.createdBy,
    createdAt: customers.createdAt,
    updatedBy: customers.updatedBy,
    updatedAt: customers.updatedAt,
};

export async function listCustomers() {
    return db
        .select(customerFields)
        .from(customers)
        .orderBy(asc(customers.name), asc(customers.customerId));
}

export async function getCustomer(id: number) {
    const [customer] = await db
        .select(customerFields)
        .from(customers)
        .where(eq(customers.customerId, id))
        .limit(1);
    return customer ?? null;
}

export async function createCustomer(input: CreateCustomerInput, actorId: number) {
    const [customer] = await db
        .insert(customers)
        .values({
            name: input.name,
            contactName: input.contactName ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            address: input.address ?? null,
            notes: input.notes ?? null,
            isActive: input.isActive,
            createdBy: actorId,
            updatedBy: actorId,
        })
        .returning(customerFields);

    if (!customer) throw new Error('The customer could not be created.');
    return customer;
}

export async function updateCustomer(id: number, input: UpdateCustomerInput, actorId: number) {
    const changes: Partial<typeof customers.$inferInsert> = {};
    if (input.name !== undefined) changes.name = input.name;
    if (input.contactName !== undefined) changes.contactName = input.contactName;
    if (input.email !== undefined) changes.email = input.email;
    if (input.phone !== undefined) changes.phone = input.phone;
    if (input.address !== undefined) changes.address = input.address;
    if (input.notes !== undefined) changes.notes = input.notes;
    if (input.isActive !== undefined) changes.isActive = input.isActive;
    if (Object.keys(changes).length === 0) return getCustomer(id);

    return db.transaction(async (tx) => {
        const [current] = await tx
            .select()
            .from(customers)
            .where(eq(customers.customerId, id))
            .for('update');
        if (!current) return null;
        if (input.isActive === false && current.isActive) {
            const [open] = await tx
                .select({ id: salesOrders.salesOrderId })
                .from(salesOrders)
                .where(
                    and(
                        eq(salesOrders.customerId, id),
                        inArray(salesOrders.status, ['Draft', 'Confirmed', 'Partially Delivered']),
                    ),
                )
                .limit(1);
            if (open)
                throw new AppError(
                    409,
                    'Complete or cancel open sales orders before deactivating this customer.',
                );
        }
        const [customer] = await tx
            .update(customers)
            .set({ ...changes, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(customers.customerId, id))
            .returning(customerFields);
        return customer ?? null;
    });
}
