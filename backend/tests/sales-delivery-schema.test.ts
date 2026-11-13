import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createSalesOrderSchema,
    updateSalesOrderSchema,
} from '../src/modules/sales-orders/sales-order.schema.ts';
import {
    createDeliveryOrderSchema,
    updateDeliveryOrderSchema,
    dispatchDeliveryOrderSchema,
} from '../src/modules/delivery-orders/delivery-order.schema.ts';
import { salesLineAmounts } from '../src/modules/sales-orders/sales-order.service.ts';

const sales = {
    salesOrderNumber: ' so-1 ',
    customerId: 1,
    orderDate: '2026-11-05',
    lines: [{ itemId: 2, uomId: 3, qtyOrdered: '0.0001', unitPrice: '9999999999.9999' }],
};
const delivery = {
    deliveryOrderNumber: ' do-1 ',
    salesOrderId: 1,
    sourceLocationId: 2,
    deliveryDate: '2026-11-06',
    lines: [{ salesOrderLineId: 3, lotId: 4, qtyDelivered: '0.0001' }],
};

test('sales and delivery schemas normalize human text and preserve exact decimal strings', () => {
    assert.deepEqual(createSalesOrderSchema.parse({ ...sales, notes: '   ' }), {
        ...sales,
        salesOrderNumber: 'SO-1',
        notes: null,
    });
    assert.deepEqual(
        createDeliveryOrderSchema.parse({ ...delivery, notes: '  Customer collection  ' }),
        {
            ...delivery,
            deliveryOrderNumber: 'DO-1',
            notes: 'Customer collection',
        },
    );
    for (const schema of [updateSalesOrderSchema, updateDeliveryOrderSchema]) {
        assert.deepEqual(schema.parse({ notes: null }), { notes: null });
        assert.equal(schema.safeParse({}).success, false);
        assert.equal(schema.safeParse({ status: 'Completed' }).success, false);
        assert.equal(schema.safeParse({ updatedBy: 99 }).success, false);
    }
});

test('sales reject duplicate products, invalid dates, incompatible request values and audit overrides', () => {
    for (const input of [
        { ...sales, requestedDeliveryDate: '2026-11-04' },
        { ...sales, orderDate: '2026-02-30' },
        { ...sales, lines: [sales.lines[0], sales.lines[0]] },
        { ...sales, createdBy: 99 },
        { ...sales, customerId: 2147483648 },
        ...['0', '-1', '1e3', '0.00001', '10000000000'].map((qtyOrdered) => ({
            ...sales,
            lines: [{ ...sales.lines[0], qtyOrdered }],
        })),
    ])
        assert.equal(createSalesOrderSchema.safeParse(input).success, false);
    assert.equal(
        createSalesOrderSchema.safeParse({
            ...sales,
            lines: [{ ...sales.lines[0], unitPrice: '0' }],
        }).success,
        true,
    );
});

test('delivery rejects duplicate lots, unknown derived item fields, and invalid dispatch locations', () => {
    for (const input of [
        { ...delivery, lines: [delivery.lines[0], delivery.lines[0]] },
        { ...delivery, lines: [{ ...delivery.lines[0], itemId: 2 }] },
        { ...delivery, deliveryDate: '2026-02-30' },
        { ...delivery, lines: [{ ...delivery.lines[0], qtyDelivered: 1 }] },
        { ...delivery, transitLocationId: 3 },
    ])
        assert.equal(createDeliveryOrderSchema.safeParse(input).success, false);
    for (const input of [
        { transitLocationId: 0 },
        { transitLocationId: '3' },
        { transitLocationId: 3, updatedBy: 99 },
    ])
        assert.equal(dispatchDeliveryOrderSchema.safeParse(input).success, false);
    assert.deepEqual(dispatchDeliveryOrderSchema.parse({ transitLocationId: 3 }), {
        transitLocationId: 3,
    });
});

test('sales line amounts use exact decimal arithmetic and round half up at four places', () => {
    assert.deepEqual(
        salesLineAmounts({ qtyOrdered: '3.0000', qtyDelivered: '0.0001', unitPrice: '0.1000' }),
        {
            qtyRemaining: '2.9999',
            lineTotal: '0.3000',
        },
    );
    assert.equal(
        salesLineAmounts({ qtyOrdered: '0.0001', qtyDelivered: '0', unitPrice: '0.5000' })
            .lineTotal,
        '0.0001',
    );
    assert.equal(
        salesLineAmounts({
            qtyOrdered: '9999999999.9999',
            qtyDelivered: '0',
            unitPrice: '9999999999.9999',
        }).lineTotal,
        '99999999999998000000.0000',
    );
});
