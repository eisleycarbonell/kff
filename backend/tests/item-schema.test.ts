import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createItemSchema,
    updateItemSchema,
    ITEM_TYPES,
} from '../src/modules/items/item.schema.ts';
const input = {
    sku: ' rm-garlic ',
    name: ' Garlic powder ',
    itemType: 'Raw Material - Bulk',
    primaryUomId: 1,
};

test('item creation normalizes identifiers and applies create-only defaults', () => {
    assert.deepEqual(createItemSchema.parse(input), {
        sku: 'RM-GARLIC',
        name: 'Garlic powder',
        itemType: 'Raw Material - Bulk',
        primaryUomId: 1,
        unitCost: '0',
        requiresQc: false,
        isActive: true,
    });
    for (const itemType of ITEM_TYPES)
        assert.equal(createItemSchema.safeParse({ ...input, itemType }).success, true);
});
test('item decimals preserve precision, nullable fields, and zero', () => {
    const result = createItemSchema.parse({
        ...input,
        unitCost: '9999999999.9999',
        netWeightG: '99999999.9999',
        shelfLifeDays: null,
    });
    assert.equal(result.unitCost, '9999999999.9999');
    assert.equal(result.netWeightG, '99999999.9999');
    assert.equal(result.shelfLifeDays, null);
    assert.equal(
        createItemSchema.parse({ ...input, unitCost: '0', netWeightG: '0' }).netWeightG,
        '0',
    );
});
test('item schemas reject invalid values and spoofed server fields', () => {
    for (const body of [
        null,
        [],
        {},
        { ...input, sku: ' ' },
        { ...input, sku: 'x'.repeat(51) },
        { ...input, name: 'x'.repeat(121) },
        { ...input, itemType: 'Manufactured' },
        { ...input, primaryUomId: '1' },
        { ...input, primaryUomId: 0 },
        { ...input, unitCost: 1.2345 },
        { ...input, unitCost: '-1' },
        { ...input, unitCost: '1e3' },
        { ...input, unitCost: '0.00001' },
        { ...input, unitCost: '10000000000' },
        { ...input, netWeightG: '100000000' },
        { ...input, netWeightG: '-1' },
        { ...input, shelfLifeDays: 0 },
        { ...input, shelfLifeDays: 1.5 },
        { ...input, requiresQc: 'false' },
        { ...input, createdBy: 999 },
        { ...input, updatedAt: '2026-10-27' },
        { ...input, itemId: 999 },
        { ...input, isInUse: false },
        { ...input, totalQuantity: '100' },
    ]) {
        assert.equal(createItemSchema.safeParse(body).success, false, JSON.stringify(body));
    }
});
test('item PATCH preserves omissions, nulls and false, and rejects empty updates', () => {
    assert.deepEqual(updateItemSchema.parse({ name: ' Garlic ' }), { name: 'Garlic' });
    assert.deepEqual(
        updateItemSchema.parse({
            netWeightG: null,
            shelfLifeDays: null,
            requiresQc: false,
            isActive: false,
        }),
        { netWeightG: null, shelfLifeDays: null, requiresQc: false, isActive: false },
    );
    for (const body of [
        {},
        { name: undefined },
        { updatedBy: 1 },
        { unknownField: 'value' },
        { totalQuantity: '100' },
    ])
        assert.equal(updateItemSchema.safeParse(body).success, false);
});
