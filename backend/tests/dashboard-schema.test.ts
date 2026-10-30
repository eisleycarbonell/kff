import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    dashboardDataSchema,
    dashboardSummarySchema,
    dashboardStockByTypeSchema,
    dashboardStockByLocationSchema,
    dashboardActivePackingOrderSchema,
    dashboardPendingPurchaseOrderSchema,
    dashboardActiveTransferSchema,
    dashboardExpiringLotSchema,
    dashboardLowStockItemSchema,
    dashboardRecentActivitySchema,
} from '../src/modules/dashboard/dashboard.schema.ts';

test('dashboard summary schema parses valid summary payload', () => {
    const valid = {
        totalInventoryValue: '125000.0000',
        rawMaterialValue: '50000.0000',
        packagingValue: '15000.0000',
        finishedGoodsValue: '60000.0000',
        totalItemsCount: 42,
        rawMaterialsOnHand: '500.0000',
        rawMaterialsReserved: '100.0000',
        rawMaterialsAvailable: '400.0000',
        finishedGoodsOnHand: '250.0000',
        finishedGoodsReserved: '50.0000',
        finishedGoodsAvailable: '200.0000',
        activePackingOrdersCount: 5,
        pendingPurchaseOrdersCount: 3,
        activeTransfersCount: 2,
        lowStockItemsCount: 4,
        expiringLotsCount: 1,
    };
    const result = dashboardSummarySchema.safeParse(valid);
    assert.equal(result.success, true);
});

test('dashboard summary schema rejects negative integer counts', () => {
    const invalid = {
        totalInventoryValue: '125000.0000',
        rawMaterialValue: '50000.0000',
        packagingValue: '15000.0000',
        finishedGoodsValue: '60000.0000',
        totalItemsCount: -1,
        rawMaterialsOnHand: '500.0000',
        rawMaterialsReserved: '100.0000',
        rawMaterialsAvailable: '400.0000',
        finishedGoodsOnHand: '250.0000',
        finishedGoodsReserved: '50.0000',
        finishedGoodsAvailable: '200.0000',
        activePackingOrdersCount: 5,
        pendingPurchaseOrdersCount: 3,
        activeTransfersCount: 2,
        lowStockItemsCount: 4,
        expiringLotsCount: 1,
    };
    const result = dashboardSummarySchema.safeParse(invalid);
    assert.equal(result.success, false);
});

test('dashboard full data schema validates comprehensive payload', () => {
    const full = {
        summary: {
            totalInventoryValue: '125000.0000',
            rawMaterialValue: '50000.0000',
            packagingValue: '15000.0000',
            finishedGoodsValue: '60000.0000',
            totalItemsCount: 42,
            rawMaterialsOnHand: '500.0000',
            rawMaterialsReserved: '100.0000',
            rawMaterialsAvailable: '400.0000',
            finishedGoodsOnHand: '250.0000',
            finishedGoodsReserved: '50.0000',
            finishedGoodsAvailable: '200.0000',
            activePackingOrdersCount: 2,
            pendingPurchaseOrdersCount: 1,
            activeTransfersCount: 1,
            lowStockItemsCount: 1,
            expiringLotsCount: 1,
        },
        stockByType: [
            {
                itemType: 'Raw Material - Bulk',
                totalOnHand: '500.0000',
                totalReserved: '100.0000',
                totalAvailable: '400.0000',
                totalValue: '50000.0000',
                itemCount: 12,
            },
        ],
        stockByLocation: [
            {
                locationId: 1,
                locationCode: 'WH-01',
                locationName: 'Main Warehouse',
                locationType: 'Warehouse',
                totalOnHand: '500.0000',
                totalReserved: '100.0000',
                totalAvailable: '400.0000',
                itemCount: 12,
            },
        ],
        activePackingOrders: [
            {
                packingOrderId: 10,
                packingOrderNumber: 'PO-2026-001',
                itemId: 5,
                itemSku: 'FG-GARLIC-100G',
                itemName: 'Garlic Powder 100g',
                targetQty: '50.0000',
                actualQty: '0.0000',
                primaryUomName: 'pouch',
                status: 'Planned',
                scheduledDate: '2026-11-01',
                sourceLocationName: 'Main Warehouse',
                destinationLocationName: 'Packing Station',
            },
        ],
        pendingPurchaseOrders: [
            {
                poId: 20,
                poNumber: 'PO-SP-001',
                supplierId: 2,
                supplierName: 'Spice Supplier Co.',
                status: 'Sent',
                orderDate: '2026-10-25T08:00:00Z',
                expectedDeliveryDate: '2026-11-05',
                lineCount: 3,
                totalAmount: '45000.00000000',
                receivedAmount: '0.00000000',
                outstandingAmount: '45000.00000000',
            },
        ],
        activeTransfers: [
            {
                transferId: 30,
                transferNumber: 'TR-2026-001',
                sourceLocationName: 'Main Warehouse',
                destinationLocationName: 'Branch North',
                status: 'In Transit',
                requestedAt: '2026-10-28T09:00:00Z',
                dispatchedAt: '2026-10-28T14:00:00Z',
                lineCount: 2,
            },
        ],
        expiringLots: [
            {
                lotId: 50,
                lotNumber: 'LOT-CHILI-01',
                itemId: 3,
                itemSku: 'RM-CHILI',
                itemName: 'Chili Powder',
                itemType: 'Raw Material - Bulk',
                primaryUomName: 'kg',
                locationName: 'Main Warehouse',
                qtyOnHand: '25.0000',
                expirationDate: '2026-11-10',
                daysUntilExpiry: 11,
                qcStatus: 'Approved',
            },
        ],
        lowStockItems: [
            {
                itemId: 4,
                itemSku: 'RM-PEPPER',
                itemName: 'Black Pepper',
                itemType: 'Raw Material - Bulk',
                primaryUomName: 'kg',
                qtyOnHand: '5.0000',
                qtyReserved: '3.0000',
                qtyAvailable: '2.0000',
            },
        ],
        recentActivity: [
            {
                transactionId: 100,
                transactionType: 'Receive',
                itemSku: 'RM-GARLIC',
                itemName: 'Garlic Powder',
                lotNumber: 'LOT-GARLIC-02',
                locationName: 'Main Warehouse',
                qtyChange: '100.0000',
                primaryUomName: 'kg',
                createdAt: '2026-10-29T10:00:00Z',
                referenceId: 'PO-SP-001',
            },
        ],
    };
    const result = dashboardDataSchema.safeParse(full);
    assert.equal(result.success, true);
});

test('dashboard sub-schemas validate individual component structures', () => {
    assert.equal(
        dashboardStockByTypeSchema.safeParse({
            itemType: 'Raw Material - Bulk',
            totalOnHand: '100.0000',
            totalReserved: '10.0000',
            totalAvailable: '90.0000',
            totalValue: '5000.0000',
            itemCount: 4,
        }).success,
        true,
    );
    assert.equal(
        dashboardStockByLocationSchema.safeParse({
            locationId: 1,
            locationCode: 'WH-01',
            locationName: 'Warehouse',
            locationType: 'Warehouse',
            totalOnHand: '100.0000',
            totalReserved: '10.0000',
            totalAvailable: '90.0000',
            itemCount: 4,
        }).success,
        true,
    );
    assert.equal(
        dashboardActivePackingOrderSchema.safeParse({
            packingOrderId: 1,
            packingOrderNumber: 'PO-01',
            itemId: 2,
            itemSku: 'SKU',
            itemName: 'Item',
            targetQty: '10.0000',
            actualQty: '0.0000',
            primaryUomName: 'kg',
            status: 'Planned',
            scheduledDate: null,
            sourceLocationName: 'WH',
            destinationLocationName: 'Station',
        }).success,
        true,
    );
    assert.equal(
        dashboardPendingPurchaseOrderSchema.safeParse({
            poId: 1,
            poNumber: 'PO-01',
            supplierId: 1,
            supplierName: 'Sup',
            status: 'Sent',
            orderDate: '2026-10-25T00:00:00Z',
            expectedDeliveryDate: null,
            lineCount: 1,
            totalAmount: '100.0000',
            receivedAmount: '0.0000',
            outstandingAmount: '100.0000',
        }).success,
        true,
    );
    assert.equal(
        dashboardActiveTransferSchema.safeParse({
            transferId: 1,
            transferNumber: 'TR-01',
            sourceLocationName: 'WH',
            destinationLocationName: 'Branch',
            status: 'In Transit',
            requestedAt: '2026-10-25T00:00:00Z',
            dispatchedAt: null,
            lineCount: 1,
        }).success,
        true,
    );
    assert.equal(
        dashboardExpiringLotSchema.safeParse({
            lotId: 1,
            lotNumber: 'LOT',
            itemId: 1,
            itemSku: 'SKU',
            itemName: 'Name',
            itemType: 'Raw Material - Bulk',
            primaryUomName: 'kg',
            locationName: 'WH',
            qtyOnHand: '10.0000',
            expirationDate: '2026-11-01',
            daysUntilExpiry: 5,
            qcStatus: 'Approved',
        }).success,
        true,
    );
    assert.equal(
        dashboardLowStockItemSchema.safeParse({
            itemId: 1,
            itemSku: 'SKU',
            itemName: 'Name',
            itemType: 'Raw Material - Bulk',
            primaryUomName: 'kg',
            qtyOnHand: '1.0000',
            qtyReserved: '0.0000',
            qtyAvailable: '1.0000',
        }).success,
        true,
    );
    assert.equal(
        dashboardRecentActivitySchema.safeParse({
            transactionId: 1,
            transactionType: 'Receive',
            itemSku: 'SKU',
            itemName: 'Name',
            lotNumber: 'LOT',
            locationName: 'WH',
            qtyChange: '10.0000',
            primaryUomName: 'kg',
            createdAt: '2026-10-25T00:00:00Z',
            referenceId: null,
        }).success,
        true,
    );
});
