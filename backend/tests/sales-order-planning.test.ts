import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    planningDemand,
    aggregatePlanningMaterials,
} from '../src/modules/sales-orders/sales-order-planning.rules.ts';
import {
    createSalesOrderSchema,
    updateSalesOrderSchema,
    salesOrderMaterialPlanRequestSchema,
} from '../src/modules/sales-orders/sales-order.schema.ts';

test('customer demand excludes fulfillment and allocations without counting draft stock twice', () => {
    assert.deepEqual(
        planningDemand({
            qtyOrdered: '100',
            qtyDelivered: '0',
            qtyAllocated: '40',
            qtyDraftAllocated: '40',
            qtyFinishedAvailable: '40',
        }),
        {
            qtyDemand: '60.0000',
            qtyFinishedAvailable: '0.0000',
            qtyFromStock: '0.0000',
            qtyToPack: '60.0000',
        },
    );
    assert.deepEqual(
        planningDemand({
            qtyOrdered: '100',
            qtyDelivered: '20',
            qtyAllocated: '30',
            qtyDraftAllocated: '10',
            qtyFinishedAvailable: '25.0001',
        }),
        {
            qtyDemand: '50.0000',
            qtyFinishedAvailable: '15.0001',
            qtyFromStock: '15.0001',
            qtyToPack: '34.9999',
        },
    );
    assert.equal(
        planningDemand(
            {
                qtyOrdered: '100',
                qtyDelivered: '0',
                qtyAllocated: '0',
                qtyDraftAllocated: '0',
                qtyFinishedAvailable: '0',
            },
            true,
        ).qtyDemand,
        '0.0000',
    );
});
test('shared components aggregate across products before subtracting eligible available stock once', () => {
    const materials = aggregatePlanningMaterials(
        [
            {
                itemId: 1,
                itemSku: 'PKG-POUCH',
                itemName: 'Pouch',
                uomName: 'pc',
                requiredQty: '100',
            },
            {
                itemId: 2,
                itemSku: 'RM-GARLIC',
                itemName: 'Garlic',
                uomName: 'kg',
                requiredQty: '10.0001',
            },
            {
                itemId: 1,
                itemSku: 'PKG-POUCH',
                itemName: 'Pouch',
                uomName: 'pc',
                requiredQty: '200',
            },
        ],
        new Map([
            [1, '150'],
            [2, '2.0001'],
        ]),
        new Map([[1, [{ supplierId: 3, name: 'Packaging Supplier' }]]]),
    );
    assert.deepEqual(
        materials.map((row) => [row.itemId, row.qtyRequired, row.qtyAvailable, row.qtyShortage]),
        [
            [1, '300.0000', '150.0000', '150.0000'],
            [2, '10.0001', '2.0001', '8.0000'],
        ],
    );
    assert.deepEqual(materials[0]!.suppliers, [{ supplierId: 3, name: 'Packaging Supplier' }]);
    assert.deepEqual(materials[1]!.suppliers, []);
    assert.throws(
        () =>
            aggregatePlanningMaterials(
                [
                    {
                        itemId: 1,
                        itemSku: 'X',
                        itemName: 'X',
                        uomName: 'pc',
                        requiredQty: '9999999999.9999',
                    },
                    {
                        itemId: 1,
                        itemSku: 'X',
                        itemName: 'X',
                        uomName: 'pc',
                        requiredQty: '0.0001',
                    },
                ],
                new Map(),
                new Map(),
            ),
        /exceed/,
    );
});
test('customer PO reference preserves omission, clearing and normalizes text; plan source is mandatory', () => {
    assert.deepEqual(updateSalesOrderSchema.parse({ customerPoNumber: '  RET-PO-2026-001  ' }), {
        customerPoNumber: 'RET-PO-2026-001',
    });
    assert.deepEqual(updateSalesOrderSchema.parse({ customerPoNumber: '  ' }), {
        customerPoNumber: null,
    });
    assert.deepEqual(updateSalesOrderSchema.parse({ customerPoNumber: null }), {
        customerPoNumber: null,
    });
    assert.deepEqual(updateSalesOrderSchema.parse({ notes: null }), { notes: null });
    assert.equal(
        updateSalesOrderSchema.safeParse({ customerPoNumber: 'X'.repeat(101) }).success,
        false,
    );
    assert.deepEqual(
        salesOrderMaterialPlanRequestSchema.parse({
            params: { id: '1' },
            query: { sourceLocationId: '2' },
        }),
        { params: { id: 1 }, query: { sourceLocationId: 2 } },
    );
    for (const query of [
        {},
        { sourceLocationId: '0' },
        { sourceLocationId: '1.2' },
        { sourceLocationId: ['1', '2'] },
        { sourceLocationId: '2', reserve: true },
    ])
        assert.equal(
            salesOrderMaterialPlanRequestSchema.safeParse({ params: { id: '1' }, query }).success,
            false,
        );
    const body = {
        salesOrderNumber: 'SO-1',
        customerId: 1,
        customerPoNumber: ' CUST-123 ',
        orderDate: '2026-11-14',
        lines: [{ itemId: 1, uomId: 1, qtyOrdered: '1', unitPrice: '0' }],
    };
    assert.equal(createSalesOrderSchema.parse(body).customerPoNumber, 'CUST-123');
});
