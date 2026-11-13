import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { exportApplicationSchema } from '../src/db/test-database.ts';
import { inventoryReportQuerySchema } from '../src/modules/inventory-reports/inventory-report.schema.ts';
const url = process.env.TEST_DATABASE_URL;
test(
    'inventory reports read actual sample stock, both reservation owners, expiry and traceable ledger without mutations',
    { skip: !url, timeout: 600_000 },
    async (context) => {
        const schema = 'reports_' + randomBytes(8).toString('hex');
        const admin = postgres(url!, { max: 1, onnotice: () => {} });
        const client = postgres(url!, {
            max: 3,
            connection: { search_path: schema, statement_timeout: 20000 },
            onnotice: () => {},
        });
        const database = drizzle({ client });
        const now = new Date('2026-11-07T08:00:00Z');
        try {
            await admin.unsafe(`create schema "${schema}"`);
            await client.unsafe(await exportApplicationSchema());
            const { seedSampleData } = await import('../src/db/sample-data.ts');
            await seedSampleData({
                database,
                schemaName: schema,
                now,
                environment: { KFF_ALLOW_TEST_DATA: 'true' },
            });
            const { getInventoryReport, getInventoryReportOptions } =
                await import('../src/modules/inventory-reports/inventory-report.service.ts');
            const report = (query: Record<string, string> = {}) =>
                getInventoryReport(inventoryReportQuerySchema.parse(query), database, now);
            const before =
                await client`select (select count(*) from inventory_transactions)::int as ledger, (select sum(qty_on_hand) from inventory_stock)::text as quantity`;
            await context.test(
                'location and lot totals reconcile exactly with stock and all outstanding reservations',
                async () => {
                    const detail = await report({ report: 'stock-by-lot' });
                    const grouped = await report();
                    assert.equal(
                        detail.rows.length,
                        (await client`select count(*)::int as n from inventory_stock`)[0]!.n,
                    );
                    const totals =
                        await client`select u.uom_id,sum(s.qty_on_hand)::text as on_hand, sum(coalesce(r.reserved,0))::text as reserved from inventory_stock s join items i using(item_id) join uoms u on u.uom_id=i.primary_uom_id left join (select item_id,lot_id,location_id,sum(qty_reserved-qty_consumed) as reserved from inventory_reservations where released_at is null group by item_id,lot_id,location_id) r using(item_id,lot_id,location_id) group by u.uom_id`;
                    for (const total of totals) {
                        const actual = grouped.totals.find(
                            (row) => row.primaryUomId === total.uom_id,
                        )!;
                        assert.equal(actual.qtyOnHand, total.on_hand);
                        assert.equal(actual.qtyReserved, total.reserved);
                        assert.deepEqual(
                            actual,
                            detail.totals.find((row) => row.primaryUomId === total.uom_id),
                        );
                    }
                    const delivery =
                        await client`select distinct location_id from inventory_reservations where delivery_order_line_id is not null and released_at is null`;
                    assert.ok(delivery.length > 0);
                    assert.ok(
                        detail.rows.some(
                            (row) =>
                                row.locationId === delivery[0]!.location_id &&
                                Number(row.qtyReserved) > 0,
                        ),
                    );
                },
            );
            await context.test(
                'unstocked active catalog items appear at threshold zero, with validated location filters',
                async () => {
                    const low = await report({ report: 'low-stock', threshold: '0' });
                    const zero = low.rows.find((row) => row.sku === 'SAMPLE-RM-REPORT-ZERO');
                    assert.equal(zero?.qtyAvailable, '0.0000');
                    assert.equal(zero?.lotCount, 0);
                    const [location] =
                        await client`select location_id from locations where code='WH-FG'`;
                    const filtered = await report({
                        report: 'low-stock',
                        threshold: '0',
                        locationId: String(location!.location_id),
                    });
                    assert.ok(filtered.rows.some((row) => row.itemType === 'Raw Material - Bulk'));
                    await assert.rejects(
                        report({ report: 'low-stock', locationId: '2147483647' }),
                        /existing report location/,
                    );
                },
            );
            await context.test(
                'near expiry includes positive expired stock, excludes undated packaging and can hide expired rows',
                async () => {
                    const expiry = await report({ report: 'near-expiry' });
                    assert.ok(
                        expiry.rows.some(
                            (row) =>
                                row.lotNumber === 'SAMPLE-LOT-LAUREL-NEAR-EXPIRY' &&
                                row.daysToExpiry === 10,
                        ),
                    );
                    assert.ok(
                        expiry.rows.some(
                            (row) =>
                                row.lotNumber === 'SAMPLE-LOT-CHILI-EXPIRED' &&
                                row.daysToExpiry === -1,
                        ),
                    );
                    assert.ok(
                        expiry.rows.every(
                            (row) => row.expirationDate !== null && Number(row.qtyOnHand) > 0,
                        ),
                    );
                    const future = await report({ report: 'near-expiry', includeExpired: 'false' });
                    assert.ok(future.rows.every((row) => row.daysToExpiry! >= 0));
                },
            );
            await context.test(
                'movement report preserves sales/delivery source documents, transfer pairs and inclusive UTC dates',
                async () => {
                    const all = await report({ report: 'movement' });
                    assert.equal(all.rows.length, before[0]!.ledger);
                    assert.ok(
                        all.rows.some(
                            (row) =>
                                row.transactionType === 'Sale' &&
                                row.sourceReference?.includes('SAMPLE-DO-') &&
                                row.sourceReference.includes('SAMPLE-SO-'),
                        ),
                    );
                    const today = await report({
                        report: 'movement',
                        fromDate: '2026-11-07',
                        toDate: '2026-11-07',
                    });
                    assert.ok(today.rows.some((row) => row.transactionType === 'Scrap'));
                    assert.ok(
                        today.rows.every((row) =>
                            row.occurredAt!.toISOString().startsWith('2026-11-07'),
                        ),
                    );
                    const transfer = await report({
                        report: 'movement',
                        transactionType: 'Transfer',
                    });
                    assert.ok(transfer.totals.every((row) => row.netChange === '0.0000'));
                    const options = await getInventoryReportOptions(database);
                    assert.ok(options.items.some((row) => row.sku === 'SAMPLE-RM-REPORT-ZERO'));
                },
            );
            assert.deepEqual(
                await client`select (select count(*) from inventory_transactions)::int as ledger, (select sum(qty_on_hand) from inventory_stock)::text as quantity`,
                before,
            );
        } finally {
            await client.end({ timeout: 3 });
            await admin.unsafe(`drop schema if exists "${schema}" cascade`);
            await admin.end({ timeout: 3 });
        }
    },
);
