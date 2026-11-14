import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInventoryReport } from '../src/modules/inventory-reports/inventory-report.rules.ts';
import {
    inventoryReportQuerySchema,
    type ReportItem,
    type ReportStock,
    type ReportMovement,
} from '../src/modules/inventory-reports/inventory-report.schema.ts';
const now = new Date('2026-11-07T23:30:00Z');
const item: ReportItem = {
    itemId: 1,
    sku: 'RM',
    itemName: 'Garlic',
    itemType: 'Raw Material - Bulk',
    labelItemId: null,
    labelItemName: null,
    primaryUomId: 1,
    primaryUomName: 'kg',
    isActive: true,
};
const stock: ReportStock = {
    ...item,
    stockId: 1,
    lotId: 1,
    lotNumber: 'LOT-1',
    qcStatus: 'Approved',
    expirationDate: '2026-11-07',
    locationId: 1,
    locationCode: 'WH',
    locationName: 'Warehouse',
    locationType: 'Warehouse',
    qtyOnHand: '10.0001',
    qtyReserved: '2.0000',
    qtyAvailable: '8.0001',
    sourceReference: 'PO-1',
};
const run = (
    query: Record<string, unknown>,
    stocks: ReportStock[] = [stock],
    items: ReportItem[] = [item],
    movements: ReportMovement[] = [],
) => buildInventoryReport(inventoryReportQuerySchema.parse(query), items, stocks, movements, now);
test('report inputs reject invalid dates, duplicate query values, unsupported filters and precision', () => {
    for (const query of [
        { report: 'wrong' },
        { locationId: '0' },
        { itemId: ['1', '2'] },
        { labelItemId: '2147483648' },
        { expiryDays: '3651' },
        { includeExpired: 'yes' },
        { threshold: '1e2' },
        { threshold: '0.00001' },
        { report: 'movement', fromDate: '2026-02-30' },
        { report: 'movement', fromDate: '2026-11-08', toDate: '2026-11-07' },
        { fromDate: '2026-11-07' },
        { report: 'movement', qcStatus: 'Approved' },
        { unknown: 'x' },
    ])
        assert.equal(
            inventoryReportQuerySchema.safeParse(query).success,
            false,
            JSON.stringify(query),
        );
    const defaults = inventoryReportQuerySchema.parse({});
    assert.equal(defaults.threshold, '10');
    assert.equal(defaults.expiryDays, 30);
    assert.equal(defaults.includeExpired, true);
});
test('location aggregation keeps locations and primary units separate with exact large totals', () => {
    const result = run({}, [
        stock,
        {
            ...stock,
            stockId: 2,
            lotId: 2,
            qtyOnHand: '9999999999.9999',
            qtyReserved: '0.0000',
            qtyAvailable: '9999999999.9999',
        },
        {
            ...stock,
            stockId: 3,
            locationId: 2,
            locationCode: 'TRANSIT',
            locationName: 'Transit',
            locationType: 'In Transit',
        },
        {
            ...stock,
            stockId: 4,
            itemId: 2,
            itemName: 'Pouch',
            itemType: 'Packaging - Hardware',
            primaryUomId: 2,
            primaryUomName: 'pc',
        },
    ]);
    assert.equal(result.rows.length, 3);
    assert.equal(
        result.rows.find((row) => row.itemId === 1 && row.locationId === 1)!.qtyOnHand,
        '10000000010.0000',
    );
    assert.equal(result.rows.find((row) => row.locationId === 1 && row.itemId === 1)!.lotCount, 2);
    assert.equal(result.totals.length, 2);
    assert.equal(
        result.totals.find((row) => row.primaryUomName === 'kg')!.qtyAvailable,
        '10000000016.0001',
    );
    assert.equal(result.summary.lotCount, 2);
    assert.equal(result.summary.locationCount, 2);
});
test('low stock includes never-stocked active items and respects location, label, QC and threshold', () => {
    const usable = { ...stock, expirationDate: '2026-12-31' };
    const empty = { ...item, itemId: 2, sku: 'ZERO', itemName: 'Unstocked' };
    const inactive = { ...empty, itemId: 3, isActive: false };
    const report = run({ report: 'low-stock', threshold: '0' }, [usable], [item, empty, inactive]);
    assert.deepEqual(
        report.rows.map((row) => row.sku),
        ['ZERO'],
    );
    assert.equal(report.rows[0]!.qtyAvailable, '0.0000');
    assert.equal(
        run({ report: 'low-stock', locationId: '2', threshold: '0' }, [usable], [item, empty]).rows
            .length,
        2,
    );
    assert.equal(
        run({ report: 'low-stock', qcStatus: 'Rejected', threshold: '0' }, [usable], [item])
            .rows[0]!.qtyAvailable,
        '0.0000',
    );
    assert.equal(
        run({ report: 'low-stock', labelItemId: '7' }, [usable], [item, empty]).rows.length,
        0,
    );
    assert.equal(
        run({ report: 'low-stock', threshold: '8.0001' }, [usable], [item]).rows.length,
        1,
    );
});
test('expiry uses UTC dates, positive balances, optional dates and inclusive window boundaries', () => {
    const stocks = [
        stock,
        ...['2026-11-06', '2026-12-07', '2026-12-08', null].map((date, index) => ({
            ...stock,
            stockId: index + 2,
            lotId: index + 2,
            expirationDate: date,
        })),
        { ...stock, stockId: 9, qtyOnHand: '0.0000' },
    ];
    const result = run({ report: 'near-expiry' }, stocks);
    assert.deepEqual(
        result.rows.map((row) => row.daysToExpiry),
        [-1, 0, 30],
    );
    assert.deepEqual(
        run({ report: 'near-expiry', includeExpired: 'false', expiryDays: '0' }, stocks).rows.map(
            (row) => row.daysToExpiry,
        ),
        [0],
    );
    assert.equal(run({ report: 'stock-by-lot' }, stocks).rows.length, 6);
});
test('movement date and search filters preserve signed transfer pairs and exact in/out/net totals', () => {
    const movement: ReportMovement = {
        ...item,
        transactionId: 1,
        transactionType: 'Transfer',
        qtyChange: '-2.0001',
        occurredAt: new Date('2026-11-07T00:00:00Z'),
        lotId: 1,
        lotNumber: 'LOT-1',
        locationId: 1,
        locationCode: 'WH',
        locationName: 'Warehouse',
        locationType: 'Warehouse',
        sourceReference: 'DO-1 / SO-1',
        referenceId: 'DO-1',
        actorName: 'Sample Admin',
        reasonCode: null,
    };
    const movements = [
        movement,
        {
            ...movement,
            transactionId: 2,
            qtyChange: '2.0001',
            locationId: 2,
            occurredAt: new Date('2026-11-07T23:59:59.999Z'),
        },
        { ...movement, transactionId: 3, transactionType: 'Sale', qtyChange: '-0.0001' },
        { ...movement, transactionId: 4, occurredAt: new Date('2026-11-08T00:00:00Z') },
    ];
    const result = run(
        { report: 'movement', fromDate: '2026-11-07', toDate: '2026-11-07', q: 'SO-1' },
        [],
        [item],
        movements,
    );
    assert.equal(result.rows.length, 3);
    assert.equal(result.totals[0]!.qtyIn, '2.0001');
    assert.equal(result.totals[0]!.qtyOut, '2.0002');
    assert.equal(result.totals[0]!.netChange, '-0.0001');
    const source = run(
        { report: 'movement', locationId: '1', transactionType: 'Transfer' },
        [],
        [item],
        movements,
    );
    assert.equal(source.rows.length, 2);
});
