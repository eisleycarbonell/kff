import { z } from 'zod';

export const ITEM_TYPES = [
    'Raw Material - Bulk',
    'Packaging - Hardware',
    'Packaging - Label',
    'Finished Good',
] as const;

export const QC_STATUSES = ['Quarantine', 'Approved', 'Rejected', 'Expired'] as const;

const id = z.int().positive().max(2_147_483_647);
const timestamp = z.iso.datetime({ offset: true });
const decimal = z.string().trim();

export const dashboardSummarySchema = z.object({
    totalInventoryValue: decimal,
    rawMaterialValue: decimal,
    packagingValue: decimal,
    finishedGoodsValue: decimal,
    totalItemsCount: z.number().int().nonnegative(),
    rawMaterialsOnHand: decimal,
    rawMaterialsReserved: decimal,
    rawMaterialsAvailable: decimal,
    finishedGoodsOnHand: decimal,
    finishedGoodsReserved: decimal,
    finishedGoodsAvailable: decimal,
    activePackingOrdersCount: z.number().int().nonnegative(),
    pendingPurchaseOrdersCount: z.number().int().nonnegative(),
    activeTransfersCount: z.number().int().nonnegative(),
    lowStockItemsCount: z.number().int().nonnegative(),
    expiringLotsCount: z.number().int().nonnegative(),
});

export const dashboardStockByTypeSchema = z.object({
    itemType: z.enum(ITEM_TYPES),
    totalOnHand: decimal,
    totalReserved: decimal,
    totalAvailable: decimal,
    totalValue: decimal,
    itemCount: z.number().int().nonnegative(),
});

export const dashboardStockByLocationSchema = z.object({
    locationId: id,
    locationCode: z.string(),
    locationName: z.string(),
    locationType: z.string(),
    totalOnHand: decimal,
    totalReserved: decimal,
    totalAvailable: decimal,
    itemCount: z.number().int().nonnegative(),
});

export const dashboardActivePackingOrderSchema = z.object({
    packingOrderId: id,
    packingOrderNumber: z.string(),
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    targetQty: decimal,
    actualQty: decimal,
    primaryUomName: z.string(),
    status: z.string(),
    scheduledDate: z.string().nullable(),
    sourceLocationName: z.string(),
    destinationLocationName: z.string(),
});

export const dashboardPendingPurchaseOrderSchema = z.object({
    poId: id,
    poNumber: z.string(),
    supplierId: id,
    supplierName: z.string(),
    status: z.string(),
    orderDate: timestamp,
    expectedDeliveryDate: z.string().nullable(),
    lineCount: z.number().int().nonnegative(),
    totalAmount: decimal,
    receivedAmount: decimal,
    outstandingAmount: decimal,
});

export const dashboardActiveTransferSchema = z.object({
    transferId: id,
    transferNumber: z.string(),
    sourceLocationName: z.string(),
    destinationLocationName: z.string(),
    status: z.string(),
    requestedAt: timestamp,
    dispatchedAt: timestamp.nullable(),
    lineCount: z.number().int().nonnegative(),
});

export const dashboardExpiringLotSchema = z.object({
    lotId: id,
    lotNumber: z.string(),
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    itemType: z.enum(ITEM_TYPES),
    primaryUomName: z.string(),
    locationName: z.string(),
    qtyOnHand: decimal,
    expirationDate: z.string(),
    daysUntilExpiry: z.number().int(),
    qcStatus: z.string(),
});

export const dashboardLowStockItemSchema = z.object({
    itemId: id,
    itemSku: z.string(),
    itemName: z.string(),
    itemType: z.enum(ITEM_TYPES),
    primaryUomName: z.string(),
    qtyOnHand: decimal,
    qtyReserved: decimal,
    qtyAvailable: decimal,
});

export const dashboardRecentActivitySchema = z.object({
    transactionId: id,
    transactionType: z.string(),
    itemSku: z.string(),
    itemName: z.string(),
    lotNumber: z.string(),
    locationName: z.string(),
    qtyChange: decimal,
    primaryUomName: z.string(),
    createdAt: timestamp,
    referenceId: z.string().nullable(),
});

export const dashboardDataSchema = z.object({
    summary: dashboardSummarySchema,
    stockByType: z.array(dashboardStockByTypeSchema),
    stockByLocation: z.array(dashboardStockByLocationSchema),
    activePackingOrders: z.array(dashboardActivePackingOrderSchema),
    pendingPurchaseOrders: z.array(dashboardPendingPurchaseOrderSchema),
    activeTransfers: z.array(dashboardActiveTransferSchema),
    expiringLots: z.array(dashboardExpiringLotSchema),
    lowStockItems: z.array(dashboardLowStockItemSchema),
    recentActivity: z.array(dashboardRecentActivitySchema),
});

export type DashboardSummary = z.output<typeof dashboardSummarySchema>;
export type DashboardStockByType = z.output<typeof dashboardStockByTypeSchema>;
export type DashboardStockByLocation = z.output<typeof dashboardStockByLocationSchema>;
export type DashboardActivePackingOrder = z.output<typeof dashboardActivePackingOrderSchema>;
export type DashboardPendingPurchaseOrder = z.output<typeof dashboardPendingPurchaseOrderSchema>;
export type DashboardActiveTransfer = z.output<typeof dashboardActiveTransferSchema>;
export type DashboardExpiringLot = z.output<typeof dashboardExpiringLotSchema>;
export type DashboardLowStockItem = z.output<typeof dashboardLowStockItemSchema>;
export type DashboardRecentActivity = z.output<typeof dashboardRecentActivitySchema>;
export type DashboardData = z.output<typeof dashboardDataSchema>;
