import assert from 'node:assert/strict';
import { test } from 'node:test';
import { items, uoms } from '../src/db/schema.ts';
import { createItem, updateItem } from '../src/modules/items/item.service.ts';

function database(
    current: Record<string, unknown> | null,
    candidate: Record<string, unknown> | null,
) {
    let writes = 0,
        labelReads = 0;
    const tx = {
        select(fields?: Record<string, unknown>) {
            let table: unknown;
            const query = {
                from(value: unknown) {
                    table = value;
                    return query;
                },
                where() {
                    return query;
                },
                for() {
                    return query;
                },
                limit() {
                    return query;
                },
                leftJoin() {
                    return query;
                },
                innerJoin() {
                    return query;
                },
                then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) {
                    if (table === uoms) return Promise.resolve([{ id: 1 }]).then(resolve, reject);
                    if (
                        table === items &&
                        fields &&
                        Object.keys(fields).length === 2 &&
                        'itemType' in fields
                    ) {
                        labelReads++;
                        return Promise.resolve(candidate ? [candidate] : []).then(resolve, reject);
                    }
                    return Promise.resolve(current ? [current] : []).then(resolve, reject);
                },
            };
            return query;
        },
        update() {
            return {
                set() {
                    return {
                        where() {
                            writes++;
                            return Promise.resolve();
                        },
                    };
                },
            };
        },
        insert() {
            writes++;
            throw new Error('Unexpected insert');
        },
    };
    return {
        database: { transaction: async (run: (tx: unknown) => unknown) => run(tx) } as never,
        stats: () => ({ writes, labelReads }),
    };
}
test('product label links reject missing, inactive and incorrect material types before writes', async () => {
    const input = {
        sku: 'FG-TEST',
        name: 'Test',
        itemType: 'Finished Good' as const,
        primaryUomId: 1,
        labelItemId: 2,
        unitCost: '0',
        isActive: true,
        requiresQc: false,
    };
    for (const label of [
        null,
        { isActive: false, itemType: 'Packaging - Label' },
        { isActive: true, itemType: 'Packaging - Hardware' },
    ]) {
        const fake = database(null, label);
        await assert.rejects(createItem(input, 7, fake.database), /Packaging - Label/);
        assert.equal(fake.stats().writes, 0);
    }
    const fake = database(null, { isActive: true, itemType: 'Packaging - Label' });
    await assert.rejects(
        createItem({ ...input, itemType: 'Raw Material - Bulk' }, 7, fake.database),
        /Only finished goods/,
    );
    assert.equal(fake.stats().writes, 0);
});
test('unrelated edits retain a historical inactive label without reassigning it', async () => {
    const fake = database(
        { itemId: 1, labelItemId: 2, itemType: 'Finished Good', primaryUomId: 1, isInUse: true },
        { isActive: false, itemType: 'Packaging - Label' },
    );
    const saved = await updateItem(1, { name: 'Updated finished product' }, 7, fake.database);
    assert.equal(saved!.labelItemId, 2);
    assert.deepEqual(fake.stats(), { writes: 1, labelReads: 0 });
});
test('a label target referenced by a product cannot change inventory identity', async () => {
    const fake = database(
        {
            itemId: 2,
            labelItemId: null,
            itemType: 'Packaging - Label',
            primaryUomId: 1,
            isInUse: true,
        },
        null,
    );
    await assert.rejects(
        updateItem(2, { itemType: 'Packaging - Hardware' }, 7, fake.database),
        /cannot change/,
    );
    assert.equal(fake.stats().writes, 0);
});
