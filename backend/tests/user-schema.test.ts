import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    createUserSchema,
    updateUserSchema,
    userIdParamsSchema,
} from '../src/modules/users/user.schema.ts';

const validUser = {
    firstName: ' Maria ',
    lastName: ' Santos ',
    email: ' MARIA@EXAMPLE.COM ',
    password: ' password123 ',
    roleId: 2,
};

test('create normalizes profile fields while preserving the exact password', () => {
    const parsed = createUserSchema.parse({
        ...validUser,
        middleName: ' ',
        mobileNumber: ' ',
        dateOfBirth: '',
        address: null,
    });
    assert.equal(parsed.firstName, 'Maria');
    assert.equal(parsed.lastName, 'Santos');
    assert.equal(parsed.email, 'maria@example.com');
    assert.equal(parsed.password, validUser.password);
    assert.equal(parsed.middleName, null);
    assert.equal(parsed.mobileNumber, null);
    assert.equal(parsed.dateOfBirth, null);
    assert.equal(parsed.address, null);
});

test('create rejects missing fields, invalid types, lengths, and unknown writable fields', () => {
    for (const body of [
        null,
        [],
        {},
        { ...validUser, firstName: ' ' },
        { ...validUser, lastName: 'x'.repeat(81) },
        { ...validUser, email: 'invalid-email' },
        { ...validUser, password: 'short' },
        { ...validUser, password: 'x'.repeat(129) },
        { ...validUser, roleId: '2' },
        { ...validUser, roleId: 0 },
        { ...validUser, roleId: 2_147_483_648 },
        { ...validUser, isEmailVerified: 'false' },
        { ...validUser, mobileNumber: '1'.repeat(31) },
        { ...validUser, userId: 99 },
        { ...validUser, passwordHash: 'client-supplied-hash' },
        { ...validUser, deletedAt: null },
        { ...validUser, createdBy: 1 },
    ]) {
        assert.equal(createUserSchema.safeParse(body).success, false);
    }
});

test('birth dates must be real calendar dates', () => {
    assert.equal(
        createUserSchema.parse({ ...validUser, dateOfBirth: '2024-02-29' }).dateOfBirth,
        '2024-02-29',
    );
    for (const dateOfBirth of ['2026-02-29', '2026-04-31', '2026-13-01', '10/27/2026']) {
        assert.equal(createUserSchema.safeParse({ ...validUser, dateOfBirth }).success, false);
    }
});

test('patch preserves omitted fields, explicit nulls, and false without injecting defaults', () => {
    assert.deepEqual(updateUserSchema.parse({ firstName: ' Carlo ' }), { firstName: 'Carlo' });
    assert.deepEqual(updateUserSchema.parse({ mobileNumber: null, isEmailVerified: false }), {
        mobileNumber: null,
        isEmailVerified: false,
    });
    assert.deepEqual(updateUserSchema.parse({ mobileNumber: '' }), { mobileNumber: null });
});

test('patch rejects empty updates, passwords, audit fields, and unknown keys', () => {
    for (const body of [
        {},
        { firstName: undefined },
        { password: 'new-password' },
        { firstName: 'Carlo', password: 'new-password' },
        { updatedAt: '2026-10-27T00:00:00Z' },
        { typo: 'value' },
    ]) {
        assert.equal(updateUserSchema.safeParse(body).success, false);
    }
});

test('route IDs are decimal positive PostgreSQL integers, not arbitrary numeric coercions', () => {
    assert.deepEqual(userIdParamsSchema.parse({ id: '42' }), { id: 42 });
    for (const id of ['0', '-1', '1.5', '1e2', '0x10', 'abc', '', ' 2 ', '2147483648']) {
        assert.equal(userIdParamsSchema.safeParse({ id }).success, false);
    }
});
