import assert from 'node:assert/strict';
import test from 'node:test';
import { planDemoMetadataUpgrade, upgradeDemoData } from '../src/db/upgrade-demo-data.ts';

test('legacy demo upgrade only plans exact metadata matches and preserves edited values', () => {
    const rows = {
        items: [
            { item_id: 1, sku: 'SAMPLE-RM-GARLIC', name: 'My corrected garlic description' },
            { item_id: 2, sku: 'SAMPLE-RM-REPORT-ZERO', name: 'Sample Unstocked Report Material' },
            { item_id: 3, sku: 'REAL-PEPPER', name: 'Actual business item' },
        ],
        suppliers: [
            {
                supplier_id: 1,
                name: 'Sample Philippine Spice Trading',
                email: 'edited@example.com',
            },
        ],
        users: [
            { user_id: 1, email: 'demo@spice.local', first_name: 'Elena', last_name: 'User edit' },
        ],
        purchase_orders: [{ po_id: 1, po_number: 'SAMPLE-PO-SPICES' }],
        customers: [{ customer_id: 1, name: 'Sample Kusina Restaurant' }],
        sales_orders: [
            {
                sales_order_id: 1,
                sales_order_number: 'SAMPLE-SO-DRAFT',
                customer_id: 1,
                customer_po_number: null,
            },
            {
                sales_order_id: 2,
                sales_order_number: 'SAMPLE-SO-CONFIRMED',
                customer_id: 1,
                customer_po_number: 'CUSTOM-REFERENCE',
            },
            {
                sales_order_id: 3,
                sales_order_number: 'CUSTOM-ORDER',
                customer_id: 1,
                customer_po_number: null,
            },
        ],
        inventory_transactions: [{ transaction_id: 1, reference_id: 'SAMPLE-PK-GARLIC-DONE' }],
    };
    const original = structuredClone(rows);
    const changes = planDemoMetadataUpgrade(rows);
    assert.deepEqual(rows, original);
    assert.equal(changes.find((c) => c.table === 'items' && c.id === 1)?.after, 'RM-GARLIC');
    assert.equal(
        changes.find((c) => c.table === 'items' && c.id === 2 && c.field === 'name')?.after,
        'Onion Powder Bulk',
    );
    assert.equal(
        changes.some((c) => c.table === 'items' && c.id === 3),
        false,
    );
    assert.equal(
        changes.some((c) => c.field === 'email' || c.table === 'users'),
        false,
    );
    assert.equal(
        changes.some((c) => c.table === 'purchase_orders' || c.table === 'inventory_transactions'),
        false,
    );
    assert.deepEqual(
        changes
            .filter((c) => c.table === 'sales_orders')
            .map((c) => ({ id: c.id, value: c.after })),
        [{ id: 1, value: 'LB-PO-2026-0001' }],
    );
});

test('metadata conversion is repeatable without planning additional writes', () => {
    const rows = {
        items: [{ item_id: 1, sku: 'SAMPLE-FG-GARLIC-100', name: 'Garlic Powder 100g' }],
        company_settings: [{ settings_id: 1, company_name: 'KFF Sample Trading & Packing' }],
    };
    for (const change of planDemoMetadataUpgrade(rows)) {
        const table = rows[change.table as keyof typeof rows] as Record<string, string | number>[];
        table.find((row) => row[change.key] === change.id)![change.field] = change.after;
    }
    assert.deepEqual(planDemoMetadataUpgrade(rows), []);
});

test('demo metadata writes require test-data opt in before connecting', async () => {
    const client = {
        begin: () => {
            throw new Error('must not connect');
        },
    };
    await assert.rejects(upgradeDemoData(client as never, {}), /Test data is disabled/);
});
