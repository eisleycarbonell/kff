import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { getTableName, sql } from 'drizzle-orm';
import postgres from 'postgres';
import {
    applicationTables,
    databaseTarget,
    exportApplicationSchema,
    rebuildApplicationSchema,
    requireTestDataOptIn,
} from '../src/db/test-database.ts';
import { sampleProducts } from '../src/db/sample-catalog.ts';
import { sampleRoles, sampleAccounts, SAMPLE_ADMIN_EMAIL } from '../src/db/sample-accounts.ts';

const testEnvironment = { KFF_ALLOW_TEST_DATA: 'true' };
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('sample and rebuild operations require an explicit testing opt-in', () => {
    for (const environment of [{}, { NODE_ENV: 'development' }, { KFF_ALLOW_TEST_DATA: 'false' }]) {
        assert.throws(() => requireTestDataOptIn(environment), /Test data is disabled/);
    }
    assert.doesNotThrow(() => requireTestDataOptIn(testEnvironment));
    // A compiled production build can be tested, but only with the explicit opt-in.
    assert.doesNotThrow(() => requireTestDataOptIn({ ...testEnvironment, NODE_ENV: 'production' }));
});

test('database target descriptions omit credentials and connection parameters', () => {
    assert.equal(
        databaseTarget(
            'postgresql://private-user:secret-password@localhost:5433/kff_test?sslmode=require',
        ),
        'localhost:5433/kff_test',
    );
    assert.throws(() => databaseTarget(undefined), /Configure DATABASE_URL/);
    assert.throws(() => databaseTarget('https://example.test/db'), /PostgreSQL/);
});

test('sample catalog covers the requested ingredients with compatible bulk and packed units', () => {
    assert.deepEqual(
        sampleProducts.map((product) => product.code),
        ['PEPPER', 'GARLIC', 'CAYENNE', 'NATA', 'KAONG', 'NOODLES', 'LAUREL', 'CHILI'],
    );
    assert.equal(sampleProducts.find((product) => product.code === 'NATA')!.pack, 'JAR-250');
    assert.equal(sampleProducts.find((product) => product.code === 'KAONG')!.pack, 'JAR-250');
});

test('sample accounts have assigned roles with the existing sales and delivery permissions', () => {
    const expectedPermissions = new Map([
        [
            'Sample Administrator',
            {
                canManageInventory: true,
                canManagePurchasing: true,
                canManagePacking: true,
                canManageTransfers: true,
                canManageUsers: true,
            },
        ],
        [
            'Sample Warehouse Manager',
            { canManageInventory: true, canManagePacking: true, canManageTransfers: true },
        ],
        ['Sample Purchasing', { canManagePurchasing: true }],
        ['Sample Viewer', {}],
        ['Sample Sales', { canManageInventory: true }],
        ['Sample Delivery', { canManageTransfers: true }],
    ]);
    assert.equal(sampleRoles.length, 6);
    assert.equal(sampleAccounts.length, 6);
    assert.equal(new Set(sampleAccounts.map((account) => account.email)).size, 6);
    const rolesByName = new Map(sampleRoles.map((role) => [role.name, role]));
    for (const role of sampleRoles)
        assert.deepEqual(role.settings, expectedPermissions.get(role.name));
    for (const account of sampleAccounts) {
        assert.ok(
            rolesByName.has(account.roleName),
            `${account.email} needs an existing sample role`,
        );
        assert.equal(account.email, account.email.trim().toLowerCase());
    }
    assert.equal(
        sampleAccounts.find((account) => account.email === SAMPLE_ADMIN_EMAIL)?.roleName,
        'Sample Administrator',
    );
    assert.equal(
        sampleAccounts.find((account) => account.email === 'sales@spice.local')?.roleName,
        'Sample Sales',
    );
    assert.equal(
        sampleAccounts.find((account) => account.email === 'delivery@spice.local')?.roleName,
        'Sample Delivery',
    );
});

test('sample rebuild and empty-database protection include sales and delivery documents', () => {
    const tableNames = new Set(applicationTables.map(getTableName));
    for (const name of [
        'sales_orders',
        'sales_order_lines',
        'delivery_orders',
        'delivery_order_lines',
    ])
        assert.ok(tableNames.has(name), `${name} must participate in reset and rollback`);
});

test(
    'sample import and rebuild preserve PostgreSQL inventory invariants, existing data and rollback',
    { skip: !testDatabaseUrl },
    async () => {
        // Never fall back to DATABASE_URL. All work is isolated in a random schema.
        const client = postgres(testDatabaseUrl!, { max: 3, onnotice: () => {} });
        const database = drizzle({ client });
        const schemaName = `kff_sample_${randomBytes(8).toString('hex')}`;
        const { seedSampleData, SAMPLE_ADMIN_EMAIL, SAMPLE_PASSWORD } =
            await import('../src/db/sample-data.ts');
        const { comparePasswords } = await import('../src/utils/hashHandler.ts');
        const options = {
            database,
            schemaName,
            environment: testEnvironment,
            now: new Date('2026-11-04T08:00:00Z'),
        };
        const read = (query: string) =>
            database.transaction(async (tx) => {
                await tx.execute(sql`select set_config('search_path', ${schemaName}, true)`);
                return tx.execute(sql.raw(query));
            });
        try {
            await client.unsafe(`create schema "${schemaName}"`);
            const ddl = await exportApplicationSchema();
            await rebuildApplicationSchema(database, ddl, schemaName, testEnvironment);
            const results = await Promise.all([seedSampleData(options), seedSampleData(options)]);
            assert.deepEqual(results.map((result) => result.status).sort(), [
                'seeded',
                'skipped-existing',
            ]);

            const mismatch = await read(`select count(*)::int as count from (
            select coalesce(s.item_id, m.item_id) as item_id
            from inventory_stock s full join (
                select item_id, lot_id, location_id, sum(qty_change) as quantity
                from inventory_transactions group by item_id, lot_id, location_id
            ) m using (item_id, lot_id, location_id)
            where s.stock_id is null or m.item_id is null or s.qty_on_hand <> m.quantity
        ) invalid`);
            assert.equal(mismatch[0]!.count, 0, 'every stock balance must reconcile to the ledger');
            const inconsistentMaterials =
                await read(`select count(*)::int as count from packing_order_materials m
                left join (select packing_order_id, item_id, -sum(qty_change) as consumed
                    from inventory_transactions where transaction_type='Consume'
                    group by packing_order_id, item_id) t using (packing_order_id, item_id)
                where m.consumed_qty <> coalesce(t.consumed, 0)`);
            assert.equal(
                inconsistentMaterials[0]!.count,
                0,
                'material snapshots must match actual consumption',
            );
            const inconsistentReceipts =
                await read(`select count(*)::int as count from purchase_order_lines p
                left join (select po_line_id, sum(qty_change) as received
                    from inventory_transactions where transaction_type='Receive' group by po_line_id) t using (po_line_id)
                where p.qty_received <> coalesce(t.received, 0)`);
            assert.equal(
                inconsistentReceipts[0]!.count,
                0,
                'received totals must match primary-unit receiving movements',
            );
            const invalidReservations = await read(`select count(*)::int as count from (
            select r.item_id, r.lot_id, r.location_id, sum(r.qty_reserved-r.qty_consumed) as reserved,
                max(s.qty_on_hand) as on_hand
            from inventory_reservations r left join inventory_stock s using (item_id, lot_id, location_id)
            where r.released_at is null group by r.item_id, r.lot_id, r.location_id
            having sum(r.qty_reserved-r.qty_consumed) > coalesce(max(s.qty_on_hand), 0)
        ) invalid`);
            assert.equal(invalidReservations[0]!.count, 0);
            const brokenLots = await read(`select count(*)::int as count from lots l
            join items i using (item_id)
            left join purchase_order_lines p on l.po_line_id=p.po_line_id
            left join packing_orders k on l.packing_order_id=k.packing_order_id
            where (i.item_type='Finished Good' and (k.item_id is null or k.item_id<>l.item_id))
               or (i.item_type<>'Finished Good' and (p.item_id is null or p.item_id<>l.item_id))`);
            assert.equal(brokenLots[0]!.count, 0, 'all sample lots retain their source document');
            const salesStates = await read(
                'select status::text as status from sales_orders order by status::text',
            );
            assert.deepEqual(
                salesStates.map((row) => row.status),
                ['Cancelled', 'Completed', 'Confirmed', 'Draft', 'Partially Delivered'],
            );
            const deliveryStates = await read(
                'select distinct status::text as status from delivery_orders order by status::text',
            );
            assert.deepEqual(
                deliveryStates.map((row) => row.status),
                ['Cancelled', 'Completed', 'Draft', 'In Transit'],
            );
            const inconsistentSales =
                await read(`select count(*)::int as count from sales_order_lines s
                left join (select l.sales_order_line_id,
                    sum(case when h.status='Completed' then l.qty_delivered else 0 end) as delivered,
                    sum(case when h.status in ('Draft','In Transit') then l.qty_delivered else 0 end) as allocated
                    from delivery_order_lines l join delivery_orders h using(delivery_order_id)
                    group by l.sales_order_line_id) d using(sales_order_line_id)
                where s.qty_delivered<>coalesce(d.delivered,0)
                    or coalesce(d.allocated,0)>s.qty_ordered-s.qty_delivered`);
            assert.equal(
                inconsistentSales[0]!.count,
                0,
                'sales fulfillment and active delivery allocations must reconcile',
            );
            const inconsistentSalesStates =
                await read(`select count(*)::int as count from sales_orders h
                where (h.status='Completed' and exists(select 1 from sales_order_lines l where l.sales_order_id=h.sales_order_id and l.qty_ordered<>l.qty_delivered))
                   or (h.status='Partially Delivered' and (not exists(select 1 from sales_order_lines l where l.sales_order_id=h.sales_order_id and l.qty_delivered>0)
                        or not exists(select 1 from sales_order_lines l where l.sales_order_id=h.sales_order_id and l.qty_ordered>l.qty_delivered)))
                   or (h.status in ('Draft','Confirmed','Cancelled') and exists(select 1 from sales_order_lines l where l.sales_order_id=h.sales_order_id and l.qty_delivered>0))
                   or (h.status in ('Draft','Cancelled') and exists(select 1 from delivery_orders d where d.sales_order_id=h.sales_order_id and d.status<>'Cancelled'))`);
            assert.equal(
                inconsistentSalesStates[0]!.count,
                0,
                'sales statuses must describe their seeded fulfillment',
            );
            const brokenDeliveryLinks =
                await read(`select count(*)::int as count from delivery_order_lines d
                join delivery_orders h using(delivery_order_id)
                join sales_order_lines s using(sales_order_line_id)
                join lots l on l.lot_id=d.lot_id
                join items i on i.item_id=d.item_id
                where d.item_id<>s.item_id or d.item_id<>l.item_id or h.sales_order_id<>s.sales_order_id
                   or i.item_type<>'Finished Good' or l.packing_order_id is null or s.uom_id<>i.primary_uom_id`);
            assert.equal(
                brokenDeliveryLinks[0]!.count,
                0,
                'deliveries must retain sales-line and finished-lot provenance',
            );
            const deliveryLedger =
                await read(`select count(*)::int as count from delivery_order_lines d
                join delivery_orders h using(delivery_order_id)
                left join lateral (select
                    count(*) filter(where t.transaction_type='Transfer') as transfer_entries,
                    count(*) filter(where t.transaction_type='Sale') as sale_entries,
                    coalesce(sum(-t.qty_change) filter(where t.transaction_type='Transfer' and t.location_id=h.source_location_id),0) as source_shipped,
                    coalesce(sum(t.qty_change) filter(where t.transaction_type='Transfer' and t.location_id=h.transit_location_id),0) as transit_shipped,
                    coalesce(sum(-t.qty_change) filter(where t.transaction_type='Sale' and t.location_id=h.transit_location_id),0) as delivered
                    from inventory_transactions t where t.delivery_order_line_id=d.delivery_order_line_id) t on true
                where t.transfer_entries<>case when h.status in ('In Transit','Completed') then 2 else 0 end
                   or t.sale_entries<>case when h.status='Completed' then 1 else 0 end
                   or t.source_shipped<>case when h.status in ('In Transit','Completed') then d.qty_delivered else 0 end
                   or t.transit_shipped<>case when h.status in ('In Transit','Completed') then d.qty_delivered else 0 end
                   or t.delivered<>case when h.status='Completed' then d.qty_delivered else 0 end`);
            assert.equal(
                deliveryLedger[0]!.count,
                0,
                'drafts do not move stock, dispatch retains company inventory, and completion records Sale',
            );
            const inconsistentDeliveryEntries =
                await read(`select count(*)::int as count from inventory_transactions t
                join delivery_order_lines d using(delivery_order_line_id) join delivery_orders h using(delivery_order_id)
                where t.item_id<>d.item_id or t.lot_id<>d.lot_id or t.reference_id<>h.delivery_order_number
                    or t.transaction_type not in ('Transfer','Sale')`);
            assert.equal(inconsistentDeliveryEntries[0]!.count, 0);
            const inconsistentDeliveryReservations =
                await read(`select count(*)::int as count from delivery_order_lines d
                join delivery_orders h using(delivery_order_id)
                left join inventory_reservations r using(delivery_order_line_id)
                where (h.status in ('Draft','Cancelled') and r.reservation_id is not null)
                   or (h.status in ('In Transit','Completed') and (r.reservation_id is null
                        or r.packing_order_material_id is not null or r.item_id<>d.item_id or r.lot_id<>d.lot_id
                        or r.location_id<>h.transit_location_id or r.qty_reserved<>d.qty_delivered))
                   or (h.status='In Transit' and (r.qty_consumed<>0 or r.released_at is not null))
                   or (h.status='Completed' and (r.qty_consumed<>r.qty_reserved or r.released_at is null))`);
            assert.equal(
                inconsistentDeliveryReservations[0]!.count,
                0,
                'only in-transit deliveries retain protected shipment reservations',
            );
            const transitMismatch = await read(`with outstanding as (
                select t.item_id,t.lot_id,m.location_id,t.qty_shipped-t.qty_received as quantity
                from stock_transfer_lines t join stock_transfers h using(transfer_id)
                join inventory_transactions m on m.transfer_line_id=t.transfer_line_id and m.transaction_type='Transfer' and m.qty_change>0
                join locations l on l.location_id=m.location_id and l.location_type='In Transit'
                where h.status='In Transit'
                union all
                select d.item_id,d.lot_id,h.transit_location_id,d.qty_delivered
                from delivery_order_lines d join delivery_orders h using(delivery_order_id) where h.status='In Transit'
            ), expected as (select item_id,lot_id,location_id,sum(quantity) as quantity from outstanding group by item_id,lot_id,location_id),
            actual as (select s.item_id,s.lot_id,s.location_id,s.qty_on_hand from inventory_stock s
                join locations l using(location_id) where l.location_type='In Transit')
            select count(*)::int as count from actual a full join expected e using(item_id,lot_id,location_id)
            where coalesce(a.qty_on_hand,0)<>coalesce(e.quantity,0)`);
            assert.equal(
                transitMismatch[0]!.count,
                0,
                'transit balances include both transfer and delivery shipments of the same lot',
            );
            const seededAccounts = await read(
                'select u.email,r.name,r.settings from users u join roles r using(role_id)',
            );
            assert.equal(seededAccounts.length, sampleAccounts.length);
            for (const expected of sampleAccounts) {
                const seeded = seededAccounts.find((row) => row.email === expected.email);
                assert.equal(seeded?.name, expected.roleName);
                assert.deepEqual(
                    seeded?.settings,
                    sampleRoles.find((role) => role.name === expected.roleName)!.settings,
                );
            }
            const [nearExpiry] = await read(
                "select expiration_date::text as expiry from lots where lot_number='SAMPLE-LOT-LAUREL-NEAR-EXPIRY'",
            );
            assert.equal(nearExpiry!.expiry, '2026-11-14');
            const [account] = await read(
                `select email, password_hash from users where email='${SAMPLE_ADMIN_EMAIL}'`,
            );
            assert.ok(await comparePasswords(SAMPLE_PASSWORD, String(account!.password_hash)));

            await read("update items set name='Preserved test edit' where sku='SAMPLE-RM-GARLIC'");
            assert.equal((await seedSampleData(options)).status, 'skipped-existing');
            const [preserved] = await read("select name from items where sku='SAMPLE-RM-GARLIC'");
            assert.equal(preserved!.name, 'Preserved test edit');

            await assert.rejects(
                rebuildApplicationSchema(
                    database,
                    ddl + '\nselect nonexistent_sample_column;',
                    schemaName,
                    testEnvironment,
                ),
            );
            assert.equal(
                (await read("select name from items where sku='SAMPLE-RM-GARLIC'"))[0]!.name,
                'Preserved test edit',
                'failed schema creation must restore the previous database',
            );

            // An external dependency must block the rebuild instead of being cascaded away.
            await read(
                'create table external_dependency (item_id integer references items(item_id))',
            );
            await assert.rejects(
                rebuildApplicationSchema(database, ddl, schemaName, testEnvironment),
            );
            const [afterFailedReset] = await read('select count(*)::int as count from items');
            assert.ok(Number(afterFailedReset!.count) > 0);
            await read('drop table external_dependency');
            await read('create table unrelated_test_data (message text)');
            await read("insert into unrelated_test_data values ('keep')");
            await rebuildApplicationSchema(database, ddl, schemaName, testEnvironment);
            assert.equal(
                (await read('select message from unrelated_test_data'))[0]!.message,
                'keep',
            );
            assert.equal((await read('select count(*)::int as count from items'))[0]!.count, 0);

            // A late ledger failure rolls back master data, documents, lots and reservations.
            await read(`create function reject_sample_ledger() returns trigger language plpgsql as $$
            begin raise exception 'injected sample ledger failure'; end $$`);
            await read(
                'create trigger reject_sample_ledger before insert on inventory_transactions for each row execute function reject_sample_ledger()',
            );
            await assert.rejects(seedSampleData(options));
            for (const table of applicationTables) {
                const [row] = await read(
                    `select count(*)::int as count from "${getTableName(table)}"`,
                );
                assert.equal(
                    row!.count,
                    0,
                    `failed sample loading must leave ${getTableName(table)} empty`,
                );
            }
            await read('drop trigger reject_sample_ledger on inventory_transactions');
            await read('drop function reject_sample_ledger()');
            assert.equal((await seedSampleData(options)).status, 'seeded');
        } finally {
            await client.unsafe(`drop schema if exists "${schemaName}" cascade`);
            await client.end({ timeout: 5 });
        }
    },
);
