import assert from 'node:assert/strict';
import { test } from 'node:test';
import { settingsInputSchema } from '../src/modules/company-settings/company-setting.schema.ts';
import { createItemSchema, updateItemSchema } from '../src/modules/items/item.schema.ts';
import {
    purchaseOrderLineTaxBreakdown,
    purchaseOrderTaxSummary,
} from '../src/modules/purchase-orders/purchase-order.rules.ts';
import { createPurchaseOrderSchema } from '../src/modules/purchase-orders/purchase-order.schema.ts';
import { createSalesOrderSchema } from '../src/modules/sales-orders/sales-order.schema.ts';
import { salesLineTaxAmounts } from '../src/modules/sales-orders/sales-order.service.ts';
import {
    computeVat4,
    formatScaled4,
    multiplyScaled4,
    scaled4,
    vatRateBasisPoints,
} from '../src/modules/accounting/accounting.rules.ts';

test('company settings VAT rate validates percentages between 0 and 100 with up to 2 decimals', () => {
    const base = {
        expectedVersion: 1,
        companyName: 'KFF Foods',
        address: null,
        email: null,
        phone: null,
        currencyCode: 'PHP' as const,
        defaultReorderLevel: '10',
        expiryWarningDays: 30,
    };
    assert.equal(
        settingsInputSchema.parse({ ...base, vatRatePercent: '12.00' }).vatRatePercent,
        '12.00',
    );
    assert.equal(settingsInputSchema.parse({ ...base, vatRatePercent: '0' }).vatRatePercent, '0');
    assert.equal(
        settingsInputSchema.parse({ ...base, vatRatePercent: '100.00' }).vatRatePercent,
        '100.00',
    );
    for (const invalid of ['-1', '100.01', '12.345', 'abc']) {
        assert.equal(
            settingsInputSchema.safeParse({ ...base, vatRatePercent: invalid }).success,
            false,
        );
    }
});

test('items support mixed VATable and VAT-exempt configuration across create and PATCH', () => {
    assert.equal(
        createItemSchema.parse({
            sku: 'FG-GARLIC',
            name: 'Garlic Powder 100g',
            itemType: 'Finished Good',
            primaryUomId: 1,
        }).isVatable,
        true,
    );
    assert.equal(
        createItemSchema.parse({
            sku: 'RM-PEPPER',
            name: 'Whole Pepper',
            itemType: 'Raw Material - Bulk',
            primaryUomId: 1,
            isVatable: false,
        }).isVatable,
        false,
    );
    assert.equal(updateItemSchema.parse({ isActive: true }).isVatable, undefined);
    assert.equal(updateItemSchema.parse({ isVatable: false }).isVatable, false);
});

test('purchase order schemas and rules compute Net, Input VAT, and Gross on mixed VATable/exempt lines', () => {
    const parsed = createPurchaseOrderSchema.parse({
        supplierId: 1,
        orderDate: '2026-11-19T00:00:00.000Z',
        lines: [
            {
                itemId: 1,
                uomId: 1,
                qtyOrdered: '10.0000',
                unitPrice: '100.0000',
                vatRatePercent: '12.00',
            },
            {
                itemId: 2,
                uomId: 1,
                qtyOrdered: '5.0000',
                unitPrice: '200.0000',
                vatRatePercent: '0.00',
            },
        ],
    });
    assert.equal(parsed.lines[0]?.vatRatePercent, '12.00');
    assert.equal(parsed.lines[1]?.vatRatePercent, '0.00');

    const line1 = purchaseOrderLineTaxBreakdown({
        qtyOrdered: '10.0000',
        qtyReceived: '4.0000',
        unitPrice: '100.0000',
        vatRatePercent: '12.00',
    });
    assert.equal(line1.vatRatePercent, '12.00');
    assert.equal(line1.netAmount, '1000.00000000');
    assert.equal(line1.vatAmount, '120.00000000');
    assert.equal(line1.lineTotal, '1120.00000000');
    assert.equal(line1.qtyRemaining, '6.0000');

    const summary = purchaseOrderTaxSummary([
        {
            qtyOrdered: '10.0000',
            qtyReceived: '4.0000',
            unitPrice: '100.0000',
            vatRatePercent: '12.00',
        },
        {
            qtyOrdered: '5.0000',
            qtyReceived: '5.0000',
            unitPrice: '200.0000',
            vatRatePercent: '0.00',
        },
    ]);
    assert.equal(summary.netAmount, '2000.00000000');
    assert.equal(summary.vatAmount, '120.00000000');
    assert.equal(summary.totalAmount, '2120.00000000');
    assert.equal(summary.receivedNetAmount, '1400.00000000');
    assert.equal(summary.receivedVatAmount, '48.00000000');
    assert.equal(summary.receivedAmount, '1448.00000000');
    assert.equal(summary.outstandingAmount, '672.00000000');
});

test('sales order lines and accounting VAT rules separate Net Revenue, Output VAT, Input VAT, and balanced GL', () => {
    const parsed = createSalesOrderSchema.parse({
        salesOrderNumber: 'SO-VAT-1',
        customerId: 1,
        orderDate: '2026-11-19',
        lines: [
            {
                itemId: 1,
                uomId: 1,
                qtyOrdered: '10.0000',
                unitPrice: '100.0000',
                vatRatePercent: '12',
            },
            {
                itemId: 2,
                uomId: 1,
                qtyOrdered: '3.0000',
                unitPrice: '50.0000',
                vatRatePercent: '0',
            },
        ],
    });
    assert.equal(parsed.lines[0]?.vatRatePercent, '12');

    const vatableSale = salesLineTaxAmounts({
        qtyOrdered: '10.0000',
        qtyDelivered: '6.0000',
        unitPrice: '100.0000',
        vatRatePercent: '12.00',
    });
    const exemptSale = salesLineTaxAmounts({
        qtyOrdered: '3.0000',
        qtyDelivered: '3.0000',
        unitPrice: '50.0000',
        vatRatePercent: '0.00',
    });
    assert.equal(vatableSale.netAmount, '1000.0000');
    assert.equal(vatableSale.vatAmount, '120.0000');
    assert.equal(vatableSale.lineTotal, '1120.0000');
    assert.equal(vatableSale.qtyRemaining, '4.0000');
    assert.equal(exemptSale.vatAmount, '0.0000');
    assert.equal(exemptSale.lineTotal, '150.0000');

    assert.equal(vatRateBasisPoints('12.00'), 1200n);
    const deliveredNet = multiplyScaled4(scaled4('6.0000'), scaled4('100.0000'));
    const outputVat = computeVat4(deliveredNet, '12.00');
    const receivedNet = multiplyScaled4(scaled4('4.0000'), scaled4('100.0000'));
    const inputVat = computeVat4(receivedNet, '12.00');
    assert.equal(formatScaled4(outputVat), '72.0000');
    assert.equal(formatScaled4(inputVat), '48.0000');
    assert.equal(formatScaled4(outputVat - inputVat), '24.0000');
});
