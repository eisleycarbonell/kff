import { and, desc, eq, type SQL } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
    inventoryTransactions,
    items,
    lots,
    locations,
    uoms,
    scrapReasonCodes,
    purchaseOrderLines,
    purchaseOrders,
    packingOrders,
    stockTransferLines,
    stockTransfers,
    users,
} from '../../db/schema.ts';
import type { InventoryMovementQuery } from './inventory-movement.schema.ts';

// Read the append-only ledger. Stock balances are never reconstructed from a mutable history view.
export async function listInventoryMovements(query: InventoryMovementQuery = {}) {
    const filters: SQL[] = [];
    if (query.transactionType)
        filters.push(eq(inventoryTransactions.transactionType, query.transactionType));
    if (query.itemId) filters.push(eq(inventoryTransactions.itemId, query.itemId));
    if (query.lotId) filters.push(eq(inventoryTransactions.lotId, query.lotId));
    if (query.locationId) filters.push(eq(inventoryTransactions.locationId, query.locationId));

    return db
        .select({
            transactionId: inventoryTransactions.transactionId,
            transactionType: inventoryTransactions.transactionType,
            qtyChange: inventoryTransactions.qtyChange,
            createdAt: inventoryTransactions.createdAt,
            itemId: items.itemId,
            itemSku: items.sku,
            itemName: items.name,
            primaryUomName: uoms.name,
            lotId: lots.lotId,
            lotNumber: lots.lotNumber,
            locationId: locations.locationId,
            locationCode: locations.code,
            locationName: locations.name,
            reasonCode: scrapReasonCodes.codeName,
            referenceId: inventoryTransactions.referenceId,
            poLineId: inventoryTransactions.poLineId,
            poNumber: purchaseOrders.poNumber,
            packingOrderId: inventoryTransactions.packingOrderId,
            packingOrderNumber: packingOrders.packingOrderNumber,
            transferLineId: inventoryTransactions.transferLineId,
            transferNumber: stockTransfers.transferNumber,
            authorizedByUserId: inventoryTransactions.authorizedByUserId,
            actorFirstName: users.firstName,
            actorLastName: users.lastName,
        })
        .from(inventoryTransactions)
        .innerJoin(items, eq(inventoryTransactions.itemId, items.itemId))
        .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
        .innerJoin(lots, eq(inventoryTransactions.lotId, lots.lotId))
        .innerJoin(locations, eq(inventoryTransactions.locationId, locations.locationId))
        .innerJoin(users, eq(inventoryTransactions.authorizedByUserId, users.userId))
        .leftJoin(scrapReasonCodes, eq(inventoryTransactions.reasonId, scrapReasonCodes.reasonId))
        .leftJoin(
            purchaseOrderLines,
            eq(inventoryTransactions.poLineId, purchaseOrderLines.poLineId),
        )
        .leftJoin(purchaseOrders, eq(purchaseOrderLines.poId, purchaseOrders.poId))
        .leftJoin(
            packingOrders,
            eq(inventoryTransactions.packingOrderId, packingOrders.packingOrderId),
        )
        .leftJoin(
            stockTransferLines,
            eq(inventoryTransactions.transferLineId, stockTransferLines.transferLineId),
        )
        .leftJoin(stockTransfers, eq(stockTransferLines.transferId, stockTransfers.transferId))
        .where(and(...filters))
        .orderBy(desc(inventoryTransactions.createdAt), desc(inventoryTransactions.transactionId));
}
