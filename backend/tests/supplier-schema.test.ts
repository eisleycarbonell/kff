import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createSupplierSchema,
    updateSupplierSchema,
    createSupplierItemSchema,
    updateSupplierItemSchema,
    supplierIdRequestSchema,
    updateSupplierItemRequestSchema,
} from '../src/modules/suppliers/supplier.schema.ts';
import {
    assertSupplierDeactivation,
    assertSupplierItemDefinition,
    assertPreferredSupplierAvailable,
    supplierItemStatus,
} from '../src/modules/suppliers/supplier.rules.ts';

test('supplier creation matches database lengths, normalizes email, and applies create-only defaults', () => {
    assert.deepEqual(
        createSupplierSchema.parse({ name: '  Spice supplier  ', email: ' SALES@EXAMPLE.COM ' }),
        {
            name: 'Spice supplier',
            email: 'sales@example.com',
            isActive: true,
        },
    );
    assert.equal(createSupplierSchema.parse({ name: 'Supplier', email: ' ' }).email, null);
    for (const input of [
        { name: '' },
        { name: 'x'.repeat(101) },
        { name: 'Supplier', email: 'invalid' },
        { name: 'Supplier', email: 'a'.repeat(90) + '@example.com' },
        { name: 'Supplier', supplierId: 7 },
        { name: 'Supplier', createdBy: 7 },
    ]) {
        assert.equal(createSupplierSchema.safeParse(input).success, false);
    }
});

test('supplier updates preserve omitted, null, and false values and reject unknown or empty writes', () => {
    assert.deepEqual(updateSupplierSchema.parse({ email: null, isActive: false }), {
        email: null,
        isActive: false,
    });
    assert.deepEqual(updateSupplierSchema.parse({ name: ' Renamed ' }), { name: 'Renamed' });
    for (const input of [
        {},
        { name: undefined },
        { supplierId: 7 },
        { createdAt: '2026-10-28' },
        { password: 'private' },
    ]) {
        assert.equal(updateSupplierSchema.safeParse(input).success, false);
    }
});

test('supplier item validation preserves exact money, optional nulls, zero, and independent defaults', () => {
    const offer = createSupplierItemSchema.parse({
        itemId: 1,
        defaultPrice: '9999999999.9999',
        supplierItemCode: ' RAW-01 ',
        leadTimeDays: 0,
        defaultUomId: null,
    });
    assert.deepEqual(offer, {
        itemId: 1,
        defaultPrice: '9999999999.9999',
        supplierItemCode: 'RAW-01',
        leadTimeDays: 0,
        defaultUomId: null,
        isPreferred: false,
        isActive: true,
    });
    assert.equal(
        createSupplierItemSchema.parse({ itemId: 1, supplierItemCode: ' ' }).supplierItemCode,
        null,
    );
    assert.deepEqual(
        updateSupplierItemSchema.parse({
            defaultPrice: null,
            defaultUomId: null,
            leadTimeDays: null,
            supplierItemCode: null,
            isPreferred: false,
        }),
        {
            defaultPrice: null,
            defaultUomId: null,
            leadTimeDays: null,
            supplierItemCode: null,
            isPreferred: false,
        },
    );
    for (const change of [
        { defaultPrice: 1.2 },
        { defaultPrice: '-1' },
        { defaultPrice: '10000000000' },
        { defaultPrice: '1.12345' },
        { defaultPrice: '1e3' },
        { leadTimeDays: -1 },
        { leadTimeDays: 0.1 },
        { leadTimeDays: 2_147_483_648 },
        { supplierItemCode: 'x'.repeat(101) },
        { defaultUomId: 0 },
        { createdBy: 7 },
    ]) {
        assert.equal(createSupplierItemSchema.safeParse({ itemId: 1, ...change }).success, false);
    }
    assert.equal(updateSupplierItemSchema.safeParse({}).success, false);
    assert.equal(updateSupplierItemSchema.safeParse({ itemId: 2 }).success, false);
    assert.deepEqual(updateSupplierItemSchema.parse({ isActive: false }), { isActive: false });
});

test('supplier routes parse only positive decimal PostgreSQL IDs, including nested offer IDs', () => {
    assert.deepEqual(supplierIdRequestSchema.parse({ params: { id: '17' } }), {
        params: { id: 17 },
    });
    for (const invalid of ['0', '-1', '1.2', '1e2', '0x10', ' 1', '2147483648', 'NaN']) {
        assert.equal(supplierIdRequestSchema.safeParse({ params: { id: invalid } }).success, false);
        assert.equal(
            updateSupplierItemRequestSchema.safeParse({
                params: { id: '1', supplierItemId: invalid },
                body: { isActive: false },
            }).success,
            false,
        );
    }
});

test('supplier deactivation rejects open purchase orders and leaves reactivation available', () => {
    assert.throws(() => assertSupplierDeactivation(true, false), { status: 409 });
    assert.doesNotThrow(() => assertSupplierDeactivation(false, false));
    assert.doesNotThrow(() => assertSupplierDeactivation(true, true));
});

test('deactivating an item offer releases its preference, while contradictory writes are rejected', () => {
    assert.deepEqual(
        supplierItemStatus({ isActive: true, isPreferred: true }, { isActive: false }),
        { isActive: false, isPreferred: false },
    );
    assert.deepEqual(
        supplierItemStatus({ isActive: false, isPreferred: false }, { isActive: true }),
        { isActive: true, isPreferred: false },
    );
    assert.throws(
        () =>
            supplierItemStatus(
                { isActive: true, isPreferred: false },
                { isActive: false, isPreferred: true },
            ),
        { status: 400 },
    );
});

test('offers require compatible UOMs, active suppliers and purchasable materials; preference conflicts never replace another offer', () => {
    const definition = {
        supplierActive: true,
        itemActive: true,
        itemType: 'Raw Material - Bulk',
        itemUomClassId: 1,
        defaultUomClassId: 1,
        isActive: true,
    };
    assert.doesNotThrow(() => assertSupplierItemDefinition(definition));
    assert.throws(() => assertSupplierItemDefinition({ ...definition, defaultUomClassId: 2 }), {
        status: 400,
    });
    assert.throws(() => assertSupplierItemDefinition({ ...definition, supplierActive: false }), {
        status: 409,
    });
    assert.throws(() => assertSupplierItemDefinition({ ...definition, itemActive: false }), {
        status: 400,
    });
    assert.throws(
        () => assertSupplierItemDefinition({ ...definition, itemType: 'Finished Good' }),
        { status: 400 },
    );
    assert.doesNotThrow(() =>
        assertSupplierItemDefinition({
            ...definition,
            supplierActive: false,
            itemActive: false,
            isActive: false,
        }),
    );
    assert.throws(() => assertPreferredSupplierAvailable(true), { status: 409 });
    assert.doesNotThrow(() => assertPreferredSupplierAvailable(false));
});
