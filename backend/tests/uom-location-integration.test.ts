import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { exportApplicationSchema } from '../src/db/test-database.ts';
import { getDatabaseErrorCode } from '../src/errors/database-error.ts';
const url = process.env.TEST_DATABASE_URL;
test(
    'master-data lifecycle and physical counts use correct ownership, real locks and atomic ledger writes',
    { skip: !url, timeout: 240000 },
    async (context) => {
        const schema = 'lifecycle_' + randomBytes(8).toString('hex');
        const admin = postgres(url!, { max: 1, onnotice: () => {} });
        const client = postgres(url!, {
            max: 6,
            onnotice: () => {},
            connection: { search_path: schema, statement_timeout: 15000 },
        });
        const database = drizzle({ client });
        try {
            await admin.unsafe('create schema "' + schema + '"');
            await client.unsafe(await exportApplicationSchema());
            const { seedSampleData } = await import('../src/db/sample-data.ts');
            await seedSampleData({
                database,
                schemaName: schema,
                environment: { KFF_ALLOW_TEST_DATA: 'true' },
            });
            const loc = await import('../src/modules/locations/location.service.ts');
            const units = await import('../src/modules/uoms/uom.service.ts');
            const { recordStockAdjustment: count } =
                await import('../src/modules/inventory-stocks/inventory-stock.service.ts');
            const [actor] = await client`select user_id from users where email='demo@spice.local'`;
            const actorId = actor!.user_id as number;
            const freshLocation = async (code: string) =>
                loc.createLocation(
                    { code, name: code, locationType: 'Warehouse', isActive: true },
                    actorId,
                    database,
                );
            const empty = await freshLocation('AUDIT-EMPTY');
            await context.test(
                'stock elsewhere does not prevent empty-location deactivation',
                async () => {
                    assert.equal(empty.isInUse, false);
                    assert.equal(empty.hasOperationalActivity, false);
                    const all = await loc.listLocations(database);
                    assert.equal(
                        all.find((r) => r.locationId === empty.locationId)!.isInUse,
                        false,
                    );
                    const occupied = all.find((r) => r.code === 'WH-RM')!;
                    assert.equal(occupied.hasOperationalActivity, true);
                    await assert.rejects(
                        loc.updateLocation(
                            occupied.locationId,
                            { isActive: false },
                            actorId,
                            database,
                        ),
                        /Move stock/,
                    );
                    assert.equal(
                        (await loc.updateLocation(
                            empty.locationId,
                            { isActive: false },
                            actorId,
                            database,
                        ))!.isActive,
                        false,
                    );
                    await assert.rejects(
                        database.transaction((tx) =>
                            loc.requireActiveLocation(tx, empty.locationId),
                        ),
                        /inactive/,
                    );
                    await loc.updateLocation(
                        empty.locationId,
                        { isActive: true },
                        actorId,
                        database,
                    );
                },
            );
            await context.test(
                'class counts/base names are independent and empty classes can be deleted',
                async () => {
                    const fresh = await units.createUomClass(
                        { name: 'Audit Empty' },
                        actorId,
                        database,
                    );
                    assert.equal(fresh.unitCount, 0);
                    assert.equal(fresh.baseUomName, null);
                    const all = await units.listUomClasses(database);
                    const expected =
                        await client`select c.uom_class_id,count(u.uom_id)::int n,min(u.name) filter(where u.is_base) base from uom_classes c left join uoms u using(uom_class_id) group by c.uom_class_id`;
                    for (const r of expected) {
                        const actual = all.find((c) => c.uomClassId === r.uom_class_id)!;
                        assert.equal(actual.unitCount, r.n);
                        assert.equal(actual.baseUomName, r.base);
                    }
                    assert.ok(await units.deleteUomClass(fresh.uomClassId, database));
                },
            );
            await context.test(
                'concurrent base creation keeps one base; anchors protect conversions',
                async () => {
                    const group = await units.createUomClass(
                        { name: 'Audit Counter' },
                        actorId,
                        database,
                    );
                    const outcomes = await Promise.allSettled(
                        ['audit-a', 'audit-b'].map((name) =>
                            units.createUom(
                                {
                                    name,
                                    uomClassId: group.uomClassId,
                                    factorToBase: '1',
                                    isBase: true,
                                },
                                actorId,
                                database,
                            ),
                        ),
                    );
                    const successful = outcomes.filter((r) => r.status === 'fulfilled');
                    assert.equal(successful.length, 1);
                    assert.equal(outcomes.filter((r) => r.status === 'rejected').length, 1);
                    const base = successful[0]!.value;
                    const pair = await units.createUom(
                        {
                            name: 'audit-pair',
                            uomClassId: group.uomClassId,
                            factorToBase: '2',
                            isBase: false,
                        },
                        actorId,
                        database,
                    );
                    await assert.rejects(units.deleteUom(base.uomId, database), /anchors/);
                    await assert.rejects(
                        units.updateUom(
                            base.uomId,
                            { factorToBase: '2', isBase: false },
                            actorId,
                            database,
                        ),
                        /anchors/,
                    );
                    await assert.rejects(
                        units.deleteUomClass(group.uomClassId, database),
                        /Remove the units/,
                    );
                    await units.deleteUom(pair.uomId, database);
                    await units.deleteUom(base.uomId, database);
                    assert.ok(await units.deleteUomClass(group.uomClassId, database));
                },
            );
            const [lot] = await client`select lot_id from lots where lot_number='LOT-GARLIC'`;
            const [reason] =
                await client`select reason_id from scrap_reason_codes where category='Inventory Adjustment' and is_active limit 1`;
            const input = {
                lotId: lot!.lot_id as number,
                locationId: empty.locationId,
                reasonId: reason!.reason_id as number,
                expectedQtyOnHand: '0',
            };
            const state = async () => ({
                stock: Array.from(await client`select * from inventory_stock order by stock_id`),
                ledger: Array.from(
                    await client`select * from inventory_transactions order by transaction_id`,
                ),
            });
            await context.test(
                'concurrent counts reject stale expectations and reconcile balances with ledger',
                async () => {
                    const outcomes = await Promise.allSettled(
                        ['1', '2'].map((qtyOnHand) =>
                            count(
                                { ...input, qtyOnHand, referenceId: 'AUDIT-COUNT' },
                                actorId,
                                database,
                            ),
                        ),
                    );
                    assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
                    assert.equal(outcomes.filter((r) => r.status === 'rejected').length, 1);
                    const [row] =
                        await client`select s.qty_on_hand::text actual,(select sum(t.qty_change)::numeric(14,4)::text from inventory_transactions t where t.lot_id=s.lot_id and t.location_id=s.location_id) expected from inventory_stock s where s.lot_id=${input.lotId} and s.location_id=${input.locationId}`;
                    assert.equal(row!.actual, row!.expected);
                    await assert.rejects(
                        loc.updateLocation(
                            empty.locationId,
                            { isActive: false },
                            actorId,
                            database,
                        ),
                        /Move stock/,
                    );
                },
            );
            await context.test(
                'failed ledger append rolls back a newly established balance',
                async () => {
                    const target = await freshLocation('AUDIT-ROLLBACK');
                    await client.unsafe(
                        "create function fail_count() returns trigger language plpgsql as $$ begin if new.reference_id='AUDIT-FAIL' then raise exception 'injected failure'; end if; return new; end $$; create trigger fail_count before insert on inventory_transactions for each row execute function fail_count()",
                    );
                    try {
                        const before = await state();
                        await assert.rejects(
                            count(
                                {
                                    ...input,
                                    locationId: target.locationId,
                                    qtyOnHand: '1',
                                    referenceId: 'AUDIT-FAIL',
                                },
                                actorId,
                                database,
                            ),
                            (e) => getDatabaseErrorCode(e) === 'P0001',
                        );
                        assert.deepEqual(await state(), before);
                    } finally {
                        await client.unsafe(
                            'drop trigger fail_count on inventory_transactions; drop function fail_count()',
                        );
                    }
                },
            );
            await context.test('counts cannot remove actively reserved materials', async () => {
                const [protectedStock] =
                    await client`select s.lot_id,s.location_id,s.qty_on_hand::text from inventory_stock s join inventory_reservations r using(item_id,lot_id,location_id) where r.released_at is null and r.qty_reserved>r.qty_consumed limit 1`;
                assert.ok(protectedStock);
                const before = await state();
                await assert.rejects(
                    count(
                        {
                            ...input,
                            lotId: protectedStock.lot_id,
                            locationId: protectedStock.location_id,
                            expectedQtyOnHand: protectedStock.qty_on_hand,
                            qtyOnHand: '0',
                            referenceId: 'AUDIT-PROTECTED',
                        },
                        actorId,
                        database,
                    ),
                    /active reservations/,
                );
                assert.deepEqual(await state(), before);
            });
        } finally {
            await client.end({ timeout: 5 });
            await admin.unsafe('drop schema if exists "' + schema + '" cascade');
            await admin.end({ timeout: 5 });
        }
    },
);
