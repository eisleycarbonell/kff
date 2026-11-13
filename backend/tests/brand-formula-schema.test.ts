import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrandSchema, updateBrandSchema } from '../src/modules/brands/brand.schema.ts';
import {
    createFormulaSchema,
    updateFormulaSchema,
} from '../src/modules/packing-formulas/packing-formula.schema.ts';

test('brand inputs normalize codes, preserve PATCH omission and reject forged fields', () => {
    assert.deepEqual(createBrandSchema.parse({ code: ' kff ', name: ' KFF ', description: ' ' }), {
        code: 'KFF',
        name: 'KFF',
        description: null,
        isActive: true,
    });
    assert.deepEqual(updateBrandSchema.parse({ isActive: false }), { isActive: false });
    assert.deepEqual(updateBrandSchema.parse({ description: null }), { description: null });
    for (const body of [{}, { createdBy: 7 }, { brandId: 1 }, { code: '' }, { isActive: 'false' }])
        assert.equal(updateBrandSchema.safeParse(body).success, false);
});
test('formulas retain exact six-place quantities and reject duplicates, cycles and stock writes', () => {
    const valid = {
        itemId: 10,
        components: [
            { componentItemId: 1, quantity: '0.000001', uomId: 1 },
            { componentItemId: 2, quantity: '1.000000', uomId: 2 },
        ],
    };
    assert.deepEqual(createFormulaSchema.parse(valid), valid);
    for (const quantity of ['0', '-1', '1e-3', '0.0000001', '100000000', 1])
        assert.equal(
            createFormulaSchema.safeParse({
                ...valid,
                components: [{ componentItemId: 1, uomId: 1, quantity }],
            }).success,
            false,
        );
    for (const components of [
        [],
        [valid.components[0], valid.components[0]],
        [{ componentItemId: 10, quantity: '1', uomId: 1 }],
    ])
        assert.equal(createFormulaSchema.safeParse({ ...valid, components }).success, false);
    assert.equal(updateFormulaSchema.safeParse({}).success, false);
    assert.equal(updateFormulaSchema.safeParse({ ...valid }).success, false);
    assert.equal(createFormulaSchema.safeParse({ ...valid, createdBy: 7 }).success, false);
});
