import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/app-error.ts';
import {
    createUomSchema,
    updateUomSchema,
    uomIdRequestSchema,
    uomClassSchema,
} from '../src/modules/uoms/uom.schema.ts';
import {
    assertUomDefinition,
    assertUomChange,
    assertUomCanBeDeleted,
    assertClassCanBeDeleted,
    factorUnits,
} from '../src/modules/uoms/uom.rules.ts';
import {
    createLocationSchema,
    updateLocationSchema,
    locationIdSchema,
    LOCATION_TYPES,
} from '../src/modules/locations/location.schema.ts';
import {
    assertLocationChange,
    assertActiveLocation,
} from '../src/modules/locations/location.rules.ts';
const conflict = (error: unknown) => error instanceof AppError && error.status === 409;
const definition = { uomClassId: 1, factorToBase: '1.00000000', isBase: true };
test('UOM validation preserves the exact numeric(18,8) range and name case', () => {
    const unit = createUomSchema.parse({
        name: ' mL ',
        uomClassId: 1,
        factorToBase: ' 9999999999.99999999 ',
    });
    assert.equal(unit.name, 'mL');
    assert.equal(unit.factorToBase, '9999999999.99999999');
    assert.equal(unit.isBase, false);
    assert.equal(factorUnits(unit.factorToBase), 999999999999999999n);
    for (const factor of ['0', '0.00000000', '-1', '1e3', '10000000000', '1.000000001', 'NaN'])
        assert.equal(
            createUomSchema.safeParse({ name: 'kg', uomClassId: 1, factorToBase: factor }).success,
            false,
            factor,
        );
    assert.equal(
        createUomSchema.safeParse({ ...definition, name: 'kg', factorToBase: '2' }).success,
        false,
    );
    assert.equal(
        createUomSchema.safeParse({ ...definition, name: 'kg', createdBy: 99 }).success,
        false,
    );
});
test('UOM patches preserve omitted fields and false without create defaults', () => {
    assert.deepEqual(updateUomSchema.parse({ isBase: false }), { isBase: false });
    assert.deepEqual(updateUomSchema.parse({ name: ' unit ' }), { name: 'unit' });
    for (const value of [
        {},
        { uomClassId: null },
        { factorToBase: 1 },
        { isBase: null },
        { updatedBy: 99 },
    ])
        assert.equal(updateUomSchema.safeParse(value).success, false);
    assert.equal(uomClassSchema.safeParse({ name: 'x'.repeat(31) }).success, false);
});
test('each nonempty UOM class requires one base unit with factor one', () => {
    assert.doesNotThrow(() => assertUomDefinition(definition, false));
    assert.doesNotThrow(() =>
        assertUomDefinition({ ...definition, isBase: false, factorToBase: '0.00000001' }, true),
    );
    assert.throws(() => assertUomDefinition(definition, true), conflict);
    assert.throws(() => assertUomDefinition({ ...definition, isBase: false }, false), /base unit/);
    assert.throws(
        () => assertUomDefinition({ ...definition, factorToBase: '0.99999999' }, false),
        /factor of 1/,
    );
});
test('referenced or anchor UOMs preserve conversion semantics but allow equivalent factors', () => {
    for (const state of [
        { isInUse: true, isClassAnchor: false },
        { isInUse: false, isClassAnchor: true },
    ]) {
        const current = { ...definition, ...state };
        assert.doesNotThrow(() => assertUomChange(current, { ...definition, factorToBase: '01' }));
        for (const next of [
            { ...definition, uomClassId: 2 },
            { ...definition, isBase: false },
            { ...definition, factorToBase: '1.00000001' },
        ])
            assert.throws(() => assertUomChange(current, next), conflict);
        assert.throws(() => assertUomCanBeDeleted(current), conflict);
    }
    assert.doesNotThrow(() => assertUomCanBeDeleted({ isInUse: false, isClassAnchor: false }));
    assert.doesNotThrow(() => assertClassCanBeDeleted(0));
    assert.throws(() => assertClassCanBeDeleted(1), conflict);
});
test('location schemas cover all seven types, normalized codes, strict fields, and partial status updates', () => {
    for (const locationType of LOCATION_TYPES) {
        const parsed = createLocationSchema.parse({
            code: ' wh-1 ',
            name: ' Main warehouse ',
            locationType,
        });
        assert.equal(parsed.code, 'WH-1');
        assert.equal(parsed.name, 'Main warehouse');
        assert.equal(parsed.isActive, true);
    }
    assert.deepEqual(updateLocationSchema.parse({ isActive: false }), { isActive: false });
    assert.deepEqual(updateLocationSchema.parse({ name: ' Updated ' }), { name: 'Updated' });
    for (const body of [
        {},
        { code: '' },
        { isActive: null },
        { locationType: 'Bin' },
        { qtyOnHand: '10' },
        { createdBy: 7 },
        { code: 'x'.repeat(31) },
        { name: 'x'.repeat(101) },
    ])
        assert.equal(updateLocationSchema.safeParse(body).success, false);
});
test('metadata changes and reactivation preserve history; in-use types and busy deactivation are protected', () => {
    const current = {
        locationType: 'Warehouse',
        isActive: true,
        isInUse: true,
        hasOperationalActivity: true,
    };
    assert.doesNotThrow(() =>
        assertLocationChange(current, { locationType: 'Warehouse', isActive: true }),
    );
    assert.throws(
        () => assertLocationChange(current, { locationType: 'Store', isActive: true }),
        conflict,
    );
    assert.throws(
        () => assertLocationChange(current, { locationType: 'Warehouse', isActive: false }),
        conflict,
    );
    assert.doesNotThrow(() =>
        assertLocationChange(
            { ...current, hasOperationalActivity: false },
            { locationType: 'Warehouse', isActive: false },
        ),
    );
    assert.doesNotThrow(() =>
        assertLocationChange(
            { ...current, isActive: false },
            { locationType: 'Warehouse', isActive: true },
        ),
    );
    assert.doesNotThrow(() =>
        assertLocationChange(
            { ...current, isInUse: false },
            { locationType: 'Branch', isActive: true },
        ),
    );
});
test('stock writers must use an existing active location', () => {
    assert.doesNotThrow(() => assertActiveLocation({ isActive: true }));
    assert.throws(
        () => assertActiveLocation(undefined),
        (error) => error instanceof AppError && error.status === 400,
    );
    assert.throws(() => assertActiveLocation({ isActive: false }), conflict);
});
test('both modules reject nondecimal and out-of-range route IDs', () => {
    for (const schema of [uomIdRequestSchema, locationIdSchema]) {
        assert.equal(schema.parse({ params: { id: '2147483647' } }).params.id, 2147483647);
        for (const id of ['0', '-1', '1e2', '1.2', '2147483648', 'abc'])
            assert.equal(schema.safeParse({ params: { id } }).success, false, id);
    }
});
