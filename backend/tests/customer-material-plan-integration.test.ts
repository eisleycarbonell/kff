import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { exportApplicationSchema } from '../src/db/test-database.ts';
import { seedSampleData } from '../src/db/sample-data.ts';
import {
    getSalesOrderMaterialPlan,
    listSalesOrders,
    cancelSalesOrder,
} from '../src/modules/sales-orders/sales-order.service.ts';
import { createReasonCode } from '../src/modules/reason-codes/reason-code.service.ts';
import {
    quantityUnits,
    quantityString,
} from '../src/modules/inventory-stocks/inventory-stock.rules.ts';

const url = process.env.TEST_DATABASE_URL;
test(
    'customer material planning uses usable supply and shared BOM requirements without changing stock',
    { skip: !url, timeout: 600_000 },
    async (context) => {
        const schema = 'customer_planning_' + randomBytes(8).toString('hex');
        const admin = postgres(url!, { max: 1, onnotice: () => {} });
        const client = postgres(url!, {
            max: 4,
            connection: { search_path: schema, statement_timeout: 30000 },
            onnotice: () => {},
        });
        const database = drizzle({ client });
        try {
            await admin.unsafe(`create schema "${schema}"`);
            await client.unsafe(await exportApplicationSchema());
            await seedSampleData({
                database,
                schemaName: schema,
                environment: { KFF_ALLOW_TEST_DATA: 'true' },
            });
            const [source] = await client`select location_id from locations where code='WH-RM'`;
            const [actor] = await client`select user_id from users where email='demo@spice.local'`;
            const order = (await listSalesOrders(database)).find((row) => row.status === 'Draft')!;
            assert.ok(order);
            const plan = () =>
                getSalesOrderMaterialPlan(order.salesOrderId, source!.location_id, database);
            const fingerprint = async () =>
                (
                    await client`select
                (select md5(string_agg(row_to_json(t)::text,'|' order by transaction_id)) from inventory_transactions t) as ledger,
                (select md5(string_agg(row_to_json(s)::text,'|' order by stock_id)) from inventory_stock s) as stock,
                (select md5(string_agg(row_to_json(r)::text,'|' order by reservation_id)) from inventory_reservations r) as reservations`
                )[0];
            await context.test(
                'large customer PO computes shortages, subtracts source reservations and aggregates shared packs once',
                async () => {
                    const before = await fingerprint();
                    const result = (await plan())!;
                    assert.equal(result.advisory, true);
                    assert.equal(result.customerPoNumber, 'LB-PO-2026-0001');
                    assert.equal(result.products.length, 2);
                    assert.ok(
                        result.products.every(
                            (row) => row.issue === null && quantityUnits(row.qtyToPack) > 0n,
                        ),
                    );
                    const garlic = result.products.find((row) => row.itemSku === 'FG-GARLIC-100')!;
                    const pepper = result.products.find((row) => row.itemSku === 'FG-PEPPER-100')!;
                    for (const [product, rawSku, labelSku] of [
                        [garlic, 'RM-GARLIC', 'LBL-GARLIC'],
                        [pepper, 'RM-PEPPER', 'LBL-PEPPER'],
                    ] as const) {
                        const raw = result.materials.find((row) => row.itemSku === rawSku)!;
                        const label = result.materials.find((row) => row.itemSku === labelSku)!;
                        assert.equal(
                            raw.qtyRequired,
                            quantityString(quantityUnits(product.qtyToPack) / 10n),
                        );
                        assert.equal(label.qtyRequired, product.qtyToPack);
                        assert.ok(quantityUnits(raw.qtyShortage) > 0n);
                        assert.deepEqual(
                            raw.suppliers.map((supplier) => supplier.name),
                            ['Davao Harvest Spice Trading'],
                        );
                    }
                    const combined = quantityString(
                        quantityUnits(garlic.qtyToPack) + quantityUnits(pepper.qtyToPack),
                    );
                    assert.equal(
                        result.materials.find((row) => row.itemSku === 'PKG-POUCH-100')!
                            .qtyRequired,
                        combined,
                    );
                    assert.equal(
                        result.materials.find((row) => row.itemSku === 'PKG-SEAL')!.qtyRequired,
                        combined,
                    );
                    assert.equal(result.canPack, false);
                    const [raw] =
                        await client`select sum(s.qty_on_hand)::text qty_on_hand, sum(coalesce((select sum(r.qty_reserved-r.qty_consumed) from inventory_reservations r where r.lot_id=s.lot_id and r.location_id=s.location_id and r.released_at is null),0))::text as reserved
                    from inventory_stock s join items i using(item_id) join lots l using(lot_id)
                    where i.sku='RM-GARLIC' and s.location_id=${source!.location_id} and l.qc_status='Approved' and (l.expiration_date is null or l.expiration_date>${new Date().toISOString().slice(0, 10)})`;
                    assert.ok(quantityUnits(raw!.reserved) > 0n);
                    assert.equal(
                        result.materials.find((row) => row.itemSku === 'RM-GARLIC')!.qtyAvailable,
                        quantityString(
                            quantityUnits(raw!.qty_on_hand) - quantityUnits(raw!.reserved),
                        ),
                    );
                    assert.deepEqual(await fingerprint(), before);
                },
            );
            await context.test(
                'unapproved same-source raw stock is excluded from usable supply',
                async () => {
                    const baseline = (await plan())!;
                    const [held] =
                        await client`select lot_id,item_id from lots where lot_number='LOT-GARLIC-QC'`;
                    const [reason] =
                        await client`select reason_id from scrap_reason_codes where category='Inventory Adjustment' limit 1`;
                    await client`insert into inventory_stock(item_id,lot_id,location_id,qty_on_hand) values(${held!.item_id},${held!.lot_id},${source!.location_id},100)`;
                    await client`insert into inventory_transactions(item_id,lot_id,location_id,qty_change,transaction_type,reason_id,authorized_by_user_id,reference_id)
                    values(${held!.item_id},${held!.lot_id},${source!.location_id},100,'Adjustment',${reason!.reason_id},${actor!.user_id},'PLANNING-HELD-FIXTURE')`;
                    const before = await fingerprint();
                    const result = (await plan())!;
                    assert.equal(
                        result.materials.find((row) => row.itemSku === 'RM-GARLIC')!.qtyAvailable,
                        baseline.materials.find((row) => row.itemSku === 'RM-GARLIC')!.qtyAvailable,
                    );
                    assert.deepEqual(await fingerprint(), before);
                },
            );
            await context.test(
                'missing formula and inactive component block planning explicitly',
                async () => {
                    await client`update items set is_active=false where sku='RM-GARLIC'`;
                    let result = (await plan())!;
                    assert.ok(
                        result.products.find((row) => row.itemSku === 'FG-GARLIC-100')!.issue,
                    );
                    assert.equal(result.canPack, false);
                    await client`update items set is_active=true where sku='RM-GARLIC'`;
                    await client`delete from bill_of_materials where parent_item_id=(select item_id from items where sku='FG-GARLIC-100')`;
                    result = (await plan())!;
                    assert.match(
                        result.products.find((row) => row.itemSku === 'FG-GARLIC-100')!.issue!,
                        /formula|bill|BOM/i,
                    );
                    assert.equal(result.canPack, false);
                },
            );
            await context.test(
                'cancelled demand produces no new packing or purchasing requirements',
                async () => {
                    await cancelSalesOrder(order.salesOrderId, actor!.user_id, database);
                    const result = (await plan())!;
                    assert.ok(
                        result.products.every(
                            (row) => row.qtyDemand === '0.0000' && row.qtyToPack === '0.0000',
                        ),
                    );
                    assert.deepEqual(result.materials, []);
                },
            );
            await context.test(
                'concurrent reason code spelling variants cannot both be created',
                async () => {
                    await client.unsafe(`create function slow_reason_fixture() returns trigger language plpgsql as $$ begin
                    if lower(new.code_name)='packing seal damage' then perform pg_sleep(0.2); end if; return new; end $$;
                    create trigger slow_reason_fixture before insert on scrap_reason_codes for each row execute function slow_reason_fixture()`);
                    const common = {
                        category: 'Packing Damage' as const,
                        isActive: true,
                        description: null,
                    };
                    const outcomes = await Promise.allSettled([
                        createReasonCode(
                            { ...common, codeName: 'Packing Seal Damage' },
                            actor!.user_id,
                            database,
                        ),
                        createReasonCode(
                            { ...common, codeName: 'PACKING SEAL DAMAGE' },
                            actor!.user_id,
                            database,
                        ),
                    ]);
                    assert.equal(outcomes.filter((row) => row.status === 'fulfilled').length, 1);
                    const rejected = outcomes.find(
                        (row) => row.status === 'rejected',
                    ) as PromiseRejectedResult;
                    assert.equal(rejected.reason.status, 409);
                    assert.equal(
                        (
                            await client`select count(*)::int as n from scrap_reason_codes where lower(code_name)='packing seal damage'`
                        )[0]!.n,
                        1,
                    );
                },
            );
        } finally {
            await client.end({ timeout: 5 });
            await admin.unsafe(`drop schema if exists "${schema}" cascade`);
            await admin.end({ timeout: 5 });
        }
    },
);
