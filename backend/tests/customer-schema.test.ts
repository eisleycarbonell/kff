import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    createCustomerSchema,
    customerIdRequestSchema,
    updateCustomerSchema,
} from '../src/modules/customers/customer.schema.ts';

test('customer creation trims contact fields, normalizes email, and defaults to active', () => {
    assert.deepEqual(
        createCustomerSchema.parse({
            name: '  Spice store  ',
            contactName: '  Maria Santos  ',
            email: '  SALES@EXAMPLE.COM  ',
            phone: '  +63 900 123 4567  ',
            address: '  Manila  ',
            notes: '  Call before delivery.  ',
        }),
        {
            name: 'Spice store',
            contactName: 'Maria Santos',
            email: 'sales@example.com',
            phone: '+63 900 123 4567',
            address: 'Manila',
            notes: 'Call before delivery.',
            isActive: true,
        },
    );
    assert.deepEqual(createCustomerSchema.parse({ name: 'Store' }), {
        name: 'Store',
        isActive: true,
    });
    assert.equal(createCustomerSchema.parse({ name: 'Store', isActive: false }).isActive, false);
});

test('optional customer fields clear to null while omitted PATCH fields remain omitted', () => {
    for (const field of ['contactName', 'email', 'phone', 'address', 'notes']) {
        for (const value of ['', '   ', null]) {
            assert.deepEqual(updateCustomerSchema.parse({ [field]: value }), { [field]: null });
        }
    }
    assert.deepEqual(updateCustomerSchema.parse({ name: ' Renamed ' }), { name: 'Renamed' });
    assert.deepEqual(updateCustomerSchema.parse({ isActive: false }), { isActive: false });
    assert.deepEqual(updateCustomerSchema.parse({ isActive: true }), { isActive: true });
});

test('customer validation enforces required names, database lengths, and contact input limits', () => {
    for (const [field, length] of [
        ['name', 120],
        ['contactName', 100],
        ['phone', 40],
        ['address', 500],
        ['notes', 2000],
    ] as const) {
        assert.equal(
            createCustomerSchema.safeParse({ name: 'Store', [field]: 'x'.repeat(length) }).success,
            true,
        );
        assert.equal(
            createCustomerSchema.safeParse({ name: 'Store', [field]: 'x'.repeat(length + 1) })
                .success,
            false,
        );
    }
    for (const input of [
        {},
        { name: '' },
        { name: '   ' },
        { name: null },
        { name: 'Store', email: 'invalid' },
        { name: 'Store', email: 'a'.repeat(243) + '@example.com' },
        { name: 'Store', phone: 123 },
        { name: 'Store', isActive: 'true' },
        { name: 'Store', isActive: null },
    ]) {
        assert.equal(createCustomerSchema.safeParse(input).success, false);
    }
});

test('customer bodies reject audit spoofing, identity writes, unknown fields, and empty PATCH', () => {
    for (const field of [
        'customerId',
        'createdBy',
        'updatedBy',
        'createdAt',
        'updatedAt',
        'extra',
    ]) {
        assert.equal(createCustomerSchema.safeParse({ name: 'Store', [field]: 7 }).success, false);
        assert.equal(updateCustomerSchema.safeParse({ [field]: 7 }).success, false);
    }
    for (const input of [{}, { name: undefined }, { email: undefined }, { name: ' ' }]) {
        assert.equal(updateCustomerSchema.safeParse(input).success, false);
    }
});

test('customer route IDs must fit positive PostgreSQL integers', () => {
    assert.deepEqual(customerIdRequestSchema.parse({ params: { id: '2147483647' } }), {
        params: { id: 2_147_483_647 },
    });
    for (const id of ['0', '-1', '1.2', '1e2', '0x10', ' 1', '2147483648', 'NaN']) {
        assert.equal(customerIdRequestSchema.safeParse({ params: { id } }).success, false);
    }
});
