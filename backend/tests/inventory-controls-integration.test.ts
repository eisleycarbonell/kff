import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { exportApplicationSchema } from '../src/db/test-database.ts';
import { createControlSchema } from '../src/modules/inventory-controls/inventory-control.schema.ts';
const url = process.env.TEST_DATABASE_URL;
test(
    'inventory controls, packaging, releases, reports and dashboard against PostgreSQL',
    { skip: !url, timeout: 600000 },
    async (t) => {
        const schema = 'controls_' + randomBytes(8).toString('hex'),
            admin = postgres(url!, { max: 1, onnotice: () => {} }),
            client = postgres(url!, {
                max: 5,
                connection: { search_path: schema, statement_timeout: 20000 },
                onnotice: () => {},
            }),
            database = drizzle({ client });
        try {
            await admin.unsafe(`create schema "${schema}"`);
            await client.unsafe(await exportApplicationSchema());
            const { seedSampleData } = await import('../src/db/sample-data.ts');
            await seedSampleData({
                database,
                schemaName: schema,
                environment: { KFF_ALLOW_TEST_DATA: 'true' },
            });
            const { createControl, getControl, actOnControl, saveCountObservations } =
                await import('../src/modules/inventory-controls/inventory-control.service.ts');
            const { createItemPackage, updateItemPackage } =
                await import('../src/modules/item-packaging/item-package.service.ts');
            const { getOperationalReport } =
                await import('../src/modules/operational-reports/operational-report.service.ts');
            const { getDashboardData } =
                await import('../src/modules/dashboard/dashboard.service.ts');
            const { getInventoryReport } =
                await import('../src/modules/inventory-reports/inventory-report.service.ts');
            const { inventoryReportQuerySchema } =
                await import('../src/modules/inventory-reports/inventory-report.schema.ts');
            const [maker] =
                    await client`select user_id as id from users where email='warehouse@spice.local'`,
                [reviewer] =
                    await client`select user_id as id from users where email='demo@spice.local'`;
            const [location] =
                    await client`select location_id as id from locations where code='WH-RM'`,
                [hold] = await client`select location_id as id from locations where code='QC-HOLD'`,
                [transit] =
                    await client`select location_id as id from locations where code='TRANSIT'`;
            const [lot] =
                await client`select l.lot_id as id,l.item_id,s.qty_on_hand::text as quantity from lots l join inventory_stock s using(lot_id) where l.lot_number='LOT-GARLIC' and s.location_id=${location!.id}`;
            const [reason] =
                    await client`select reason_id as id from scrap_reason_codes where category='Inventory Adjustment'`,
                [scrapReason] =
                    await client`select reason_id as id from scrap_reason_codes where category='Expired'`;
            const baseline = () =>
                client`select (select count(*) from inventory_transactions)::int as ledger,(select count(*) from inventory_transactions t left join (select item_id,lot_id,location_id,sum(qty_change) qty from inventory_transactions group by item_id,lot_id,location_id) l using(item_id,lot_id,location_id) join inventory_stock s using(item_id,lot_id,location_id) where l.qty<>s.qty_on_hand)::int as mismatches`;
            let next = 0;
            const prepare = (body: Record<string, unknown>) =>
                createControl(
                    createControlSchema.parse({
                        requestNumber: 'TEST-CONTROL-' + ++next,
                        notes: 'Prepared for independent native verification.',
                        evidenceReference: 'LAB-TEST',
                        ...body,
                    }),
                    maker!.id,
                    database,
                );
            const action = (
                id: number,
                action: 'submit' | 'approve' | 'reject' | 'cancel' | 'reopen',
                actor = maker!.id,
            ) =>
                actOnControl(
                    id,
                    { action, reviewNote: 'Native verification action note.' },
                    actor,
                    database,
                );
            await t.test(
                'retired controls reject writes while preserving requests, observations and events',
                async () => {
                    const before = await baseline();
                    const history =
                        await client`select request_id,kind from review_requests where kind in ('Count','QC','Disposition')`;
                    assert.ok(history.length);
                    for (const row of history) {
                        const saved = await getControl(row.request_id, database);
                        assert.ok(saved);
                        for (const nextAction of [
                            'submit',
                            'approve',
                            'reject',
                            'cancel',
                            'reopen',
                        ] as const)
                            await assert.rejects(
                                action(row.request_id, nextAction, reviewer!.id),
                                /removed|read-only/i,
                            );
                        assert.deepEqual(await getControl(row.request_id, database), saved);
                    }
                    for (const body of [
                        {
                            kind: 'Count',
                            locationId: location!.id,
                            reasonId: reason!.id,
                            lotIds: [lot!.id],
                        },
                        {
                            kind: 'QC',
                            lotId: lot!.id,
                            previousStatus: 'Quarantine',
                            newStatus: 'Approved',
                        },
                        {
                            kind: 'Disposition',
                            lotId: lot!.id,
                            sourceLocationId: location!.id,
                            destinationLocationId: hold!.id,
                            reasonId: scrapReason!.id,
                            quantity: '1',
                            expectedQty: lot!.quantity,
                        },
                    ])
                        await assert.rejects(prepare(body), /removed|read-only/i);
                    await assert.rejects(
                        saveCountObservations(
                            history[0]!.request_id,
                            { observations: [{ observationId: 1, countedQty: '0' }] },
                            maker!.id,
                            database,
                        ),
                        /removed|read-only/i,
                    );
                    assert.deepEqual(await baseline(), before);
                },
            );
            await t.test(
                'concurrent disposals serialize and only one commits the same balance snapshot',
                async () => {
                    const [stock] =
                        await client`select qty_on_hand::text as quantity from inventory_stock where lot_id=${lot!.id} and location_id=${location!.id}`;
                    const inputs = {
                        kind: 'Scrap',
                        lotId: lot!.id,
                        sourceLocationId: location!.id,
                        reasonId: scrapReason!.id,
                        quantity: '0.1000',
                        expectedQty: stock!.quantity,
                    };
                    const a = (await prepare(inputs))!,
                        b = (await prepare(inputs))!;
                    await action(a.requestId, 'submit');
                    await action(b.requestId, 'submit');
                    const before = await baseline();
                    const results = await Promise.allSettled([
                        action(a.requestId, 'approve', reviewer!.id),
                        action(b.requestId, 'approve', reviewer!.id),
                    ]);
                    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
                    assert.equal((await baseline())[0]!.ledger, before[0]!.ledger + 1);
                },
            );
            await t.test(
                'scrap cannot consume active reservations or bypass protected transit inventory',
                async () => {
                    const [stock] =
                        await client`select s.lot_id,s.location_id,s.qty_on_hand::text as quantity from inventory_stock s join inventory_reservations r using(item_id,lot_id,location_id) where r.released_at is null and r.qty_reserved>r.qty_consumed and s.location_id<>${transit!.id} limit 1`;
                    assert.ok(stock);
                    const d = (await prepare({
                        kind: 'Scrap',
                        lotId: stock.lot_id,
                        sourceLocationId: stock.location_id,
                        reasonId: scrapReason!.id,
                        quantity: stock.quantity,
                        expectedQty: stock.quantity,
                    }))!;
                    await action(d.requestId, 'submit');
                    const before = await baseline();
                    await assert.rejects(action(d.requestId, 'approve', reviewer!.id), /reserved/i);
                    assert.deepEqual(await baseline(), before);
                    assert.equal((await getControl(d.requestId, database))!.status, 'Submitted');
                    await assert.rejects(
                        prepare({
                            kind: 'Scrap',
                            lotId: stock.lot_id,
                            sourceLocationId: transit!.id,
                            reasonId: scrapReason!.id,
                            quantity: '1',
                            expectedQty: '0',
                        }),
                        /Transit/i,
                    );
                },
            );
            await t.test(
                'legacy lot quality can be corrected directly without changing stock or historical requests',
                async () => {
                    const [qc] =
                        await client`select lot_id as id from lots where lot_number='LOT-GARLIC-QC'`;
                    const before = await baseline();
                    const { updateLot } = await import('../src/modules/lots/lot.service.ts');
                    const saved = await updateLot(
                        qc!.id,
                        { qcStatus: 'Approved' },
                        maker!.id,
                        database,
                    );
                    assert.equal(saved!.qcStatus, 'Approved');
                    assert.equal(saved!.updatedBy, maker!.id);
                    assert.deepEqual(await baseline(), before);
                },
            );
            await t.test(
                'formula releases are dated, preserve historical orders, and use item-specific packaging ratios',
                async () => {
                    const [product] =
                            await client`select item_id as id from items where sku like 'FG-GARLIC-%'`,
                        [pack] =
                            await client`select item_id as id from items where item_type='Packaging - Hardware' limit 1`,
                        [box] = await client`select uom_id as id from uoms where name='box'`;
                    const saved = await createItemPackage(
                        {
                            itemId: pack!.id,
                            uomId: box!.id,
                            baseQty: '24',
                            barcode: 'TEST24',
                            grossWeightG: null,
                        },
                        maker!.id,
                        database,
                    );
                    assert.ok(saved);
                    const before =
                        await client`select packing_order_id,item_id,uom_id,required_qty from packing_order_materials order by packing_order_material_id`;
                    const components = [
                        { componentItemId: pack!.id, uomId: box!.id, quantity: '1' },
                    ];
                    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
                    const future = (await prepare({
                        kind: 'Formula',
                        itemId: product!.id,
                        effectiveDate: tomorrow,
                        changeType: 'Replace',
                        components,
                    }))!;
                    await action(future.requestId, 'submit');
                    await assert.rejects(
                        action(future.requestId, 'approve', reviewer!.id),
                        /effective date/i,
                    );
                    const revision = (await prepare({
                        kind: 'Formula',
                        itemId: product!.id,
                        effectiveDate: new Date().toISOString().slice(0, 10),
                        changeType: 'Replace',
                        components,
                    }))!;
                    await action(revision.requestId, 'submit');
                    await action(revision.requestId, 'approve', reviewer!.id);
                    assert.deepEqual(
                        await client`select packing_order_id,item_id,uom_id,required_qty from packing_order_materials order by packing_order_material_id`,
                        before,
                    );
                    await assert.rejects(
                        updateItemPackage(
                            saved!.packagingId,
                            {
                                itemId: pack!.id,
                                uomId: box!.id,
                                baseQty: '25',
                                barcode: 'TEST25',
                                grossWeightG: null,
                            },
                            maker!.id,
                            database,
                        ),
                        /used|referenced|histor/i,
                    );
                    const { previewPackingOrder } =
                        await import('../src/modules/packing-orders/packing-order.service.ts');
                    const preview = await previewPackingOrder(
                        { itemId: product!.id, targetQty: '2', sourceLocationId: location!.id },
                        database,
                    );
                    assert.equal(preview.materials[0]!.requiredQty, '48.0000');
                    const retire = (await prepare({
                        kind: 'Formula',
                        itemId: product!.id,
                        effectiveDate: new Date().toISOString().slice(0, 10),
                        changeType: 'Retire',
                        components: [],
                    }))!;
                    await action(retire.requestId, 'submit');
                    await action(retire.requestId, 'approve', reviewer!.id);
                    await assert.rejects(
                        previewPackingOrder(
                            { itemId: product!.id, targetQty: '2', sourceLocationId: location!.id },
                            database,
                        ),
                        /BOM|formula/i,
                    );
                },
            );
            await t.test(
                'reports are read-only; dashboard scopes open lists and quantities by UOM',
                async () => {
                    const before = await baseline();
                    for (const report of [
                        'packing',
                        'purchasing',
                        'transfers',
                        'genealogy',
                    ] as const) {
                        const result = await getOperationalReport({ report }, database);
                        assert.ok(result.sections.some((s) => s.rows.length));
                    }
                    const trace = await getOperationalReport(
                        { report: 'genealogy', lotId: lot!.id },
                        database,
                    );
                    assert.ok(
                        trace.sections.find((s) => s.title === 'Material genealogy')!.rows.length,
                    );
                    const report = await getInventoryReport(
                        inventoryReportQuerySchema.parse({ report: 'low-stock' }),
                        database,
                    );
                    assert.ok(report.rows.some((r) => r.sku === 'RM-ONION'));
                    const dashboard = await getDashboardData(database);
                    assert.ok(
                        dashboard.activePackingOrders.every((r) =>
                            ['Planned', 'In Progress'].includes(r.status),
                        ),
                    );
                    assert.ok(
                        dashboard.pendingPurchaseOrders.every((r) =>
                            ['Draft', 'Sent', 'Partially Received'].includes(r.status),
                        ),
                    );
                    assert.ok(dashboard.activeTransfers.every((r) => r.status === 'In Transit'));
                    assert.equal(dashboard.summary.currencyCode, 'PHP');
                    assert.ok(
                        dashboard.summary.rawMaterialQuantities.every((r) => r.primaryUomId > 0),
                    );
                    assert.ok(dashboard.lowStockItems.some((r) => r.itemSku === 'RM-ONION'));
                    assert.deepEqual(await baseline(), before);
                    assert.equal(before[0]!.mismatches, 0);
                },
            );
            await t.test(
                'receiving preview and committed quantities use the saved pack override',
                async () => {
                    const [pack] =
                            await client`select item_id as id from items where item_type='Packaging - Hardware' limit 1`,
                        [box] = await client`select uom_id as id from uoms where name='box'`;
                    const [order] =
                        await client`insert into purchase_orders(po_number,supplier_id,status,created_by,updated_by) select 'NATIVE-PACK24',supplier_id,'Sent',${reviewer!.id},${reviewer!.id} from suppliers where is_active limit 1 returning po_id`;
                    const [line] =
                        await client`insert into purchase_order_lines(po_id,item_id,uom_id,qty_ordered,unit_price,created_by,updated_by) values(${order!.po_id},${pack!.id},${box!.id},2,48,${reviewer!.id},${reviewer!.id}) returning po_line_id`;
                    const { getReceivingOptions, receivePurchaseOrder } =
                        await import('../src/modules/receiving/receiving.service.ts');
                    const options = await getReceivingOptions(database);
                    const preview = options.orders
                        .flatMap((o) => o.lines)
                        .find((r) => r.poLineId === line!.po_line_id)!;
                    assert.equal(preview.purchaseUomFactor, '24.0000');
                    assert.equal(preview.primaryUomFactor, '1');
                    await receivePurchaseOrder(
                        {
                            poId: order!.po_id,
                            lines: [
                                {
                                    poLineId: line!.po_line_id,
                                    qtyReceived: '2',
                                    expectedQtyReceived: '0',
                                    lotNumber: 'NATIVE-PACK24-LOT',
                                    locationId: location!.id,
                                    supplierLotNumber: null,
                                    manufactureDate: null,
                                    expirationDate: null,
                                },
                            ],
                        },
                        reviewer!.id,
                        database,
                    );
                    const [balance] =
                        await client`select s.qty_on_hand::text as quantity,l.unit_cost::text as cost from inventory_stock s join lots l using(lot_id) where l.lot_number='NATIVE-PACK24-LOT'`;
                    assert.equal(balance!.quantity, '48.0000');
                    assert.equal(balance!.cost, '2.0000');
                    const [receivedLot] =
                        await client`select qc_status from lots where lot_number='NATIVE-PACK24-LOT'`;
                    assert.equal(receivedLot!.qc_status, 'Approved');
                    assert.equal((await baseline())[0]!.mismatches, 0);
                },
            );
            await t.test(
                'settings reject stale versions and currency relabeling after priced history',
                async () => {
                    const { getSettings, updateSettings } =
                        await import('../src/modules/company-settings/company-setting.service.ts');
                    const current = await getSettings(database);
                    const input = {
                        expectedVersion: current.version,
                        companyName: current.companyName,
                        address: current.address,
                        email: current.email,
                        phone: current.phone,
                        currencyCode: current.currencyCode,
                        defaultReorderLevel: '12.0000',
                        expiryWarningDays: 45,
                    };
                    const saved = await updateSettings(input, reviewer!.id, database);
                    assert.equal(saved.defaultReorderLevel, '12.0000');
                    await assert.rejects(updateSettings(input, reviewer!.id, database), /changed/);
                    await assert.rejects(
                        updateSettings(
                            { ...input, expectedVersion: saved.version, currencyCode: 'USD' },
                            reviewer!.id,
                            database,
                        ),
                        /Currency cannot change/,
                    );
                    assert.equal((await getSettings(database)).currencyCode, current.currencyCode);
                },
            );
        } finally {
            await client.end();
            await admin.unsafe(`drop schema if exists "${schema}" cascade`);
            await admin.end();
        }
    },
);
