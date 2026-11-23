import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { exportApplicationSchema } from '../src/db/test-database.ts';
const url = process.env.TEST_DATABASE_URL;
test(
    'label assignments and formula edits preserve snapshots, concurrent creation and transactional rollback',
    { skip: !url, timeout: 240_000 },
    async (context) => {
        const schema = 'brand_formula_' + randomBytes(8).toString('hex');
        const admin = postgres(url!, { max: 1, onnotice: () => {} });
        const client = postgres(url!, {
            max: 5,
            connection: { search_path: schema, statement_timeout: 15000 },
            onnotice: () => {},
        });
        const database = drizzle({ client });
        try {
            await admin.unsafe(`create schema "${schema}"`);
            await client.unsafe(await exportApplicationSchema());
            const { seedSampleData } = await import('../src/db/sample-data.ts');
            await seedSampleData({
                database,
                schemaName: schema,
                environment: { KFF_ALLOW_TEST_DATA: 'true' },
            });
            const formulaService =
                await import('../src/modules/packing-formulas/packing-formula.service.ts');
            const itemService = await import('../src/modules/items/item.service.ts');
            const packing = await import('../src/modules/packing-orders/packing-order.service.ts');
            const [actor] = await client`select user_id from users where email='demo@spice.local'`;
            const [raw] = await client`select * from items where sku='RM-GARLIC'`;
            // Read the configured pack by following garlic's existing formula rather than fixed item IDs.
            const [finishedSeed] =
                await client`select item_id from items where sku like 'FG-GARLIC-%'`;
            const definition = await formulaService.getFormula(finishedSeed!.item_id, database);
            assert.ok(definition);
            const hardware = definition.components.find(
                (row) => row.componentItemId !== raw!.item_id,
            )!;
            const [pc] = await client`select uom_id from uoms where name='pc'`;
            const [grams] = await client`select uom_id from uoms where name='g'`;
            const [source] = await client`select location_id from locations where code='WH-RM'`;
            const [destination] =
                await client`select location_id from locations where code='WH-FG'`;
            const actorId = actor!.user_id as number;
            const { createControl } =
                await import('../src/modules/inventory-controls/inventory-control.service.ts');
            const { createControlSchema } =
                await import('../src/modules/inventory-controls/inventory-control.schema.ts');

            const [label] = await client`select item_id,name from items where sku='LBL-GARLIC'`;
            assert.ok(label);
            const product = await itemService.createItem(
                {
                    sku: 'TEST-FG',
                    name: 'Test finished good',
                    itemType: 'Finished Good',
                    primaryUomId: pc!.uom_id,
                    labelItemId: label.item_id,
                    unitCost: '0',
                    isActive: true,
                    requiresQc: false,
                },
                actorId,
                database,
            );
            assert.equal(product!.labelItemName, label.name);
            const components = [
                {
                    componentItemId: raw!.item_id as number,
                    quantity: '100',
                    uomId: grams!.uom_id as number,
                },
                { componentItemId: hardware.componentItemId, quantity: '1', uomId: hardware.uomId },
            ];
            await context.test(
                'direct formula creation serializes concurrent writes and rejects retired revisions',
                async () => {
                    const results = await Promise.allSettled([
                        formulaService.createFormula(
                            { itemId: product!.itemId, components },
                            actorId,
                            database,
                        ),
                        formulaService.createFormula(
                            { itemId: product!.itemId, components },
                            actorId,
                            database,
                        ),
                    ]);
                    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
                    await assert.rejects(
                        createControl(
                            createControlSchema.parse({
                                kind: 'Formula',
                                requestNumber: 'RETIRED-REV-1',
                                notes: 'Retired formula revisions should be rejected.',
                                itemId: product!.itemId,
                                components,
                                changeType: 'Replace',
                                effectiveDate: new Date().toISOString().slice(0, 10),
                            }),
                            actorId,
                            database,
                        ),
                        /removed/i,
                    );
                },
            );
            await context.test('incompatible units fail without replacing a formula', async () => {
                const before = await formulaService.getFormula(product!.itemId, database);
                await assert.rejects(
                    formulaService.updateFormula(
                        product!.itemId,
                        { components: [{ ...components[0]!, uomId: pc!.uom_id }] },
                        actorId,
                        database,
                    ),
                    /compatible/,
                );
                assert.deepEqual(
                    await formulaService.getFormula(product!.itemId, database),
                    before,
                );
            });
            const order = await packing.createPackingOrder(
                {
                    packingOrderNumber: 'FORMULA-SNAPSHOT',
                    itemId: product!.itemId,
                    targetQty: '10',
                    sourceLocationId: source!.location_id,
                    destinationLocationId: destination!.location_id,
                },
                actorId,
                database,
            );
            assert.equal(
                order.materials.find((row) => row.itemId === raw!.item_id)!.requiredQty,
                '1.0000',
            );
            await context.test(
                'failed replacement rolls back deletion and all new material rows',
                async () => {
                    const before = await formulaService.getFormula(product!.itemId, database);
                    await client.unsafe(
                        "create function reject_formula() returns trigger language plpgsql as $$ begin raise exception 'injected formula failure'; end $$; create trigger reject_formula before insert on bill_of_materials for each row execute function reject_formula()",
                    );
                    await assert.rejects(
                        formulaService.updateFormula(
                            product!.itemId,
                            { components },
                            actorId,
                            database,
                        ),
                    );
                    assert.deepEqual(
                        await formulaService.getFormula(product!.itemId, database),
                        before,
                    );
                    await client.unsafe(
                        'drop trigger reject_formula on bill_of_materials; drop function reject_formula()',
                    );
                },
            );
            await context.test(
                'edited and removed formulas do not rewrite or prevent historical packing',
                async () => {
                    await formulaService.updateFormula(
                        product!.itemId,
                        { components: [{ ...components[0]!, quantity: '200' }, components[1]!] },
                        actorId,
                        database,
                    );
                    assert.deepEqual(
                        (await packing.getPackingOrder(order.packingOrderId, database))!.materials,
                        order.materials,
                    );
                    await formulaService.removeFormula(product!.itemId, database);
                    assert.equal(await formulaService.getFormula(product!.itemId, database), null);
                    await assert.rejects(
                        packing.createPackingOrder(
                            {
                                packingOrderNumber: 'MISSING-FORMULA',
                                itemId: product!.itemId,
                                targetQty: '10',
                                sourceLocationId: source!.location_id,
                                destinationLocationId: destination!.location_id,
                            },
                            actorId,
                            database,
                        ),
                        /valid BOM/,
                    );
                    await packing.planPackingOrder(order.packingOrderId, actorId, database);
                    await packing.startPackingOrder(order.packingOrderId, actorId, database);
                    const completed = await packing.completePackingOrder(
                        order.packingOrderId,
                        { actualQty: '10', lotNumber: 'FORMULA-OUTPUT' },
                        actorId,
                        database,
                    );
                    assert.equal(completed!.status, 'Completed');
                    assert.equal(
                        completed!.materials.find((row) => row.itemId === raw!.item_id)!
                            .consumedQty,
                        '1.0000',
                    );
                    const mismatches =
                        await client`select count(*)::int as count from inventory_stock s full join (select item_id,lot_id,location_id,sum(qty_change) as quantity from inventory_transactions group by item_id,lot_id,location_id) t using(item_id,lot_id,location_id) where coalesce(s.qty_on_hand,0)<>coalesce(t.quantity,0)`;
                    assert.equal(mismatches[0]!.count, 0);
                },
            );
            await context.test(
                'inactive labels retain existing assignments and reject new assignments',
                async () => {
                    await itemService.updateItem(
                        label.item_id,
                        { isActive: false },
                        actorId,
                        database,
                    );
                    assert.equal(
                        (await itemService.updateItem(
                            product!.itemId,
                            { name: 'Retained label' },
                            actorId,
                            database,
                        ))!.labelItemId,
                        label.item_id,
                    );
                    await assert.rejects(
                        itemService.createItem(
                            {
                                sku: 'INACTIVE-LABEL',
                                name: 'Blocked',
                                itemType: 'Finished Good',
                                primaryUomId: pc!.uom_id,
                                labelItemId: label.item_id,
                                unitCost: '0',
                                isActive: true,
                                requiresQc: false,
                            },
                            actorId,
                            database,
                        ),
                        /Packaging - Label/,
                    );
                },
            );
        } finally {
            await client.end({ timeout: 3 });
            await admin.unsafe(`drop schema if exists "${schema}" cascade`);
            await admin.end({ timeout: 3 });
        }
    },
);
