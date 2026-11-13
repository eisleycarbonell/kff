import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { exportApplicationSchema } from '../src/db/test-database.ts';

const url = process.env.TEST_DATABASE_URL;
test(
    'purchasing supports custom and generated references with concurrent uniqueness, historical preservation and rollback',
    { skip: !url, timeout: 240_000 },
    async () => {
        const schemaName = 'purchase_flow_' + randomBytes(8).toString('hex');
        const admin = postgres(url!, { max: 1, onnotice: () => {} });
        const client = postgres(url!, {
            max: 6,
            connection: { search_path: schemaName, statement_timeout: 15000 },
            onnotice: () => {},
        });
        const database = drizzle({ client });
        try {
            await admin.unsafe(`create schema "${schemaName}"`);
            await client.unsafe(await exportApplicationSchema());
            const { seedSampleData } = await import('../src/db/sample-data.ts');
            await seedSampleData({
                database,
                schemaName,
                environment: { KFF_ALLOW_TEST_DATA: 'true' },
            });
            const purchasing =
                await import('../src/modules/purchase-orders/purchase-order.service.ts');
            const { generatedPurchaseOrderNumber } =
                await import('../src/modules/purchase-orders/purchase-order.rules.ts');
            const [actor] = await client`select user_id from users where email='demo@spice.local'`;
            const actorId = actor!.user_id as number;
            const offers =
                await client`select distinct on (si.supplier_id) si.supplier_id, si.item_id, i.primary_uom_id from supplier_items si join items i on i.item_id=si.item_id join suppliers s on s.supplier_id=si.supplier_id where si.is_active and i.is_active and s.is_active order by si.supplier_id, si.item_id`;
            assert.ok(offers.length >= 2);
            const input = (offer = offers[0]!) => ({
                supplierId: offer.supplier_id as number,
                orderDate: new Date().toISOString(),
                lines: [
                    {
                        itemId: offer.item_id as number,
                        uomId: offer.primary_uom_id as number,
                        qtyOrdered: '1',
                        unitPrice: '1',
                    },
                ],
            });
            const operationalCounts = () =>
                client`select (select count(*) from purchase_orders)::integer as orders, (select count(*) from purchase_order_lines)::integer as lines, (select count(*) from lots)::integer as lots, (select count(*) from inventory_stock)::integer as balances, (select count(*) from inventory_transactions)::integer as movements`;
            const [beforeAllocation] = await operationalCounts();
            const previews = await Promise.all(
                Array.from({ length: 8 }, () => purchasing.allocatePurchaseOrderNumber(database)),
            );
            assert.equal(new Set(previews.map((preview) => preview.poNumber)).size, 8);
            for (const preview of previews) assert.match(preview.poNumber, /^PO-\d{4}-\d{4,}$/);
            const [afterAllocation] = await operationalCounts();
            assert.deepEqual(afterAllocation, beforeAllocation);
            const previewSaved = await purchasing.createPurchaseOrder(
                { ...input(), poNumber: previews[0]!.poNumber },
                actorId,
                database,
            );
            assert.equal(previewSaved.poNumber, previews[0]!.poNumber);
            await purchasing.createPurchaseOrder(
                { ...input(offers[1]!), poNumber: previews[1]!.poNumber },
                actorId,
                database,
            );
            await assert.rejects(
                purchasing.createPurchaseOrder(
                    { ...input(), poNumber: previews[1]!.poNumber },
                    actorId,
                    database,
                ),
                { status: 409 },
            );

            const saved = await Promise.all(
                Array.from({ length: 8 }, (_, index) =>
                    purchasing.createPurchaseOrder(
                        input(offers[index % offers.length]!),
                        actorId,
                        database,
                    ),
                ),
            );
            assert.equal(new Set(saved.map((order) => order.poNumber)).size, 8);
            for (const order of saved)
                assert.equal(
                    order.poNumber,
                    generatedPurchaseOrderNumber(order.poId, order.createdAt),
                );
            const edited = await purchasing.updatePurchaseOrder(
                saved[0]!.poId,
                { notes: 'Changed without renumbering' },
                actorId,
                database,
            );
            assert.equal(edited!.poNumber, saved[0]!.poNumber);

            const custom = await purchasing.createPurchaseOrder(
                { ...input(), poNumber: '  external / ref_42  ' },
                actorId,
                database,
            );
            assert.equal(custom.poNumber, 'EXTERNAL / REF_42');
            const customEdited = await purchasing.updatePurchaseOrder(
                custom.poId,
                { notes: 'Manual reference remains fixed' },
                actorId,
                database,
            );
            assert.equal(customEdited!.poNumber, custom.poNumber);
            await assert.rejects(
                purchasing.createPurchaseOrder(
                    { ...input(), poNumber: 'external / ref_42' },
                    actorId,
                    database,
                ),
                { status: 409 },
            );
            for (const poNumber of ['', '   ']) {
                const auto = await purchasing.createPurchaseOrder(
                    { ...input(), poNumber },
                    actorId,
                    database,
                );
                assert.equal(
                    auto.poNumber,
                    generatedPurchaseOrderNumber(auto.poId, auto.createdAt),
                );
            }

            const competing = await Promise.allSettled([
                purchasing.createPurchaseOrder(
                    { ...input(offers[0]!), poNumber: ' Case-Unique_42 ' },
                    actorId,
                    database,
                ),
                purchasing.createPurchaseOrder(
                    { ...input(offers[1]!), poNumber: 'case-unique_42' },
                    actorId,
                    database,
                ),
            ]);
            assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
            const duplicate = competing.find((result) => result.status === 'rejected');
            assert.ok(duplicate && duplicate.status === 'rejected');
            assert.equal(duplicate.reason.status, 409);
            const [caseCount] =
                await client`select count(*)::integer as count from purchase_orders where upper(btrim(po_number))='CASE-UNIQUE_42'`;
            assert.equal(caseCount!.count, 1);

            const [raceSequence] =
                await client`select nextval(pg_get_serial_sequence('purchase_orders','po_id'))::integer as id`;
            const raceNumber = generatedPurchaseOrderNumber(
                (raceSequence!.id as number) + 1,
                new Date(),
            );
            const race = await Promise.allSettled([
                purchasing.createPurchaseOrder(input(offers[0]!), actorId, database),
                purchasing.createPurchaseOrder(
                    { ...input(offers[1]!), poNumber: raceNumber.toLowerCase() },
                    actorId,
                    database,
                ),
            ]);
            assert.equal(race[0]!.status, 'fulfilled');
            if (race[1]!.status === 'rejected') assert.equal(race[1]!.reason.status, 409);
            else assert.equal(race[1]!.value.poNumber, raceNumber);
            const [raceCount] =
                await client`select count(*)::integer as count from purchase_orders where upper(btrim(po_number))=${raceNumber}`;
            assert.equal(raceCount!.count, 1);

            const [allocated] =
                await client`select nextval(pg_get_serial_sequence('purchase_orders','po_id'))::integer as id`;
            const next = (allocated!.id as number) + 1;
            const historicalNumber = generatedPurchaseOrderNumber(next, new Date());
            const historicalSpelling = `\t\u00a0${historicalNumber.toLowerCase()}\u00a0\t`;
            await client`insert into purchase_orders(po_id,po_number,supplier_id,status,order_date,created_by,updated_by) values(${next + 1000000},${historicalSpelling},${offers[0]!.supplier_id},'Draft',now(),${actorId},${actorId})`;
            const previewAfterCollision = await purchasing.allocatePurchaseOrderNumber(database);
            assert.notEqual(previewAfterCollision.poNumber, historicalNumber);
            const afterCollision = await purchasing.createPurchaseOrder(input(), actorId, database);
            assert.notEqual(afterCollision.poNumber, historicalNumber);
            assert.ok(afterCollision.poId > next);
            const [historical] =
                await client`select po_number from purchase_orders where po_id=${next + 1000000}`;
            assert.equal(historical!.po_number, historicalSpelling);
            for (const [reference, spelling] of [
                ['LEGACY-TAB-PO', '\tlegacy-tab-po\t'],
                ['LEGACY-NBSP-PO', '\u00a0legacy-nbsp-po\u00a0'],
            ]) {
                await client`insert into purchase_orders(po_number,supplier_id,status,order_date,created_by,updated_by) values(${spelling!},${offers[0]!.supplier_id},'Cancelled',now(),${actorId},${actorId})`;
                await assert.rejects(
                    purchasing.createPurchaseOrder(
                        { ...input(), poNumber: reference! },
                        actorId,
                        database,
                    ),
                    { status: 409 },
                );
                const [retained] =
                    await client`select po_number from purchase_orders where po_number=${spelling!}`;
                assert.equal(retained!.po_number, spelling);
            }
            await assert.rejects(
                purchasing.createPurchaseOrder(
                    { ...input(), poNumber: historicalNumber },
                    actorId,
                    database,
                ),
                { status: 409 },
            );

            const [importSequence] =
                await client`select nextval(pg_get_serial_sequence('purchase_orders','po_id'))::integer as id`;
            const importedId = (importSequence!.id as number) + 1;
            await client`insert into purchase_orders(po_id,po_number,supplier_id,status,order_date,created_by,updated_by) values(${importedId},'PREVIEW-IMPORTED-ID',${offers[0]!.supplier_id},'Draft',now(),${actorId},${actorId})`;
            const previewAfterImportedId = await purchasing.allocatePurchaseOrderNumber(database);
            assert.notEqual(
                previewAfterImportedId.poNumber,
                generatedPurchaseOrderNumber(importedId, new Date()),
            );

            const pending = await purchasing.createPurchaseOrder(input(), actorId, database);
            await client`update supplier_items set is_active=false,is_preferred=false where supplier_id=${offers[0]!.supplier_id} and item_id=${offers[0]!.item_id}`;
            await assert.rejects(purchasing.createPurchaseOrder(input(), actorId, database), {
                status: 409,
            });
            await assert.rejects(
                purchasing.updatePurchaseOrder(
                    pending.poId,
                    { notes: 'Unlinked' },
                    actorId,
                    database,
                ),
                { status: 409 },
            );
            await assert.rejects(purchasing.sendPurchaseOrder(pending.poId, actorId, database), {
                status: 409,
            });
            assert.equal(
                (await purchasing.getPurchaseOrder(pending.poId, database))!.status,
                'Draft',
            );
            await client`update supplier_items set is_active=true where supplier_id=${offers[0]!.supplier_id} and item_id=${offers[0]!.item_id}`;
            await purchasing.sendPurchaseOrder(pending.poId, actorId, database);

            const [before] = await client`select count(*)::integer as count from purchase_orders`;
            await client.unsafe(
                "create function fail_po_line() returns trigger language plpgsql as $$ begin raise exception 'Simulated PO line failure'; end $$; create trigger fail_po_line before insert on purchase_order_lines for each row execute function fail_po_line()",
            );
            await assert.rejects(purchasing.createPurchaseOrder(input(), actorId, database));
            await assert.rejects(
                purchasing.createPurchaseOrder(
                    { ...input(), poNumber: 'ROLLBACK-CUSTOM' },
                    actorId,
                    database,
                ),
            );
            const [after] = await client`select count(*)::integer as count from purchase_orders`;
            assert.equal(after!.count, before!.count);
            await client.unsafe('drop trigger fail_po_line on purchase_order_lines');
            const retriedCustom = await purchasing.createPurchaseOrder(
                { ...input(), poNumber: 'rollback-custom' },
                actorId,
                database,
            );
            assert.equal(retriedCustom.poNumber, 'ROLLBACK-CUSTOM');
        } finally {
            await client.end({ timeout: 5 });
            await admin.unsafe(`drop schema if exists "${schemaName}" cascade`);
            await admin.end({ timeout: 5 });
        }
    },
);
