import { asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import {
    items,
    uoms,
    lots,
    locations,
    inventoryStock,
    inventoryTransactions,
    inventoryReservations,
    purchaseOrders,
    purchaseOrderLines,
    suppliers,
    packingOrders,
    packingOrderMaterials,
    stockTransfers,
    stockTransferLines,
    deliveryOrders,
    deliveryOrderLines,
} from '../../db/schema.ts';
import {
    quantityUnits,
    quantityString,
    outstandingReservations,
} from '../inventory-stocks/inventory-stock.rules.ts';
import { purchaseOrderAmounts } from '../purchase-orders/purchase-order.rules.ts';
import { getSettings } from '../company-settings/company-setting.service.ts';
import { AppError } from '../../errors/app-error.ts';
import type { OperationalReportQuery, ReportSection } from './operational-report.schema.ts';
const section = (
    title: string,
    labels: Record<string, string>,
    rows: ReportSection['rows'],
): ReportSection => ({
    title,
    columns: Object.entries(labels).map(([key, label]) => ({ key, label })),
    rows,
});
const date = (value: Date | string | null) => (value instanceof Date ? value.toISOString() : value);
export async function getOperationalReport(q: OperationalReportQuery, database: typeof db = db) {
    return database.transaction(
        async (tx) => {
            const settings = await getSettings(tx);
            const inRange = (value: Date | string | null) => {
                const day = date(value)?.slice(0, 10);
                return Boolean(
                    day && (!q.fromDate || day >= q.fromDate) && (!q.toDate || day <= q.toDate),
                );
            };
            const result = {
                report: q.report,
                generatedAt: new Date().toISOString(),
                currencyCode: settings.currencyCode,
                sections: [] as ReportSection[],
            };
            if (q.report === 'purchasing') {
                const rows = await tx
                    .select({
                        po: purchaseOrders,
                        line: purchaseOrderLines,
                        supplier: suppliers.name,
                        sku: items.sku,
                        name: items.name,
                        uom: uoms.name,
                    })
                    .from(purchaseOrderLines)
                    .innerJoin(purchaseOrders, eq(purchaseOrders.poId, purchaseOrderLines.poId))
                    .innerJoin(suppliers, eq(suppliers.supplierId, purchaseOrders.supplierId))
                    .innerJoin(items, eq(items.itemId, purchaseOrderLines.itemId))
                    .innerJoin(uoms, eq(uoms.uomId, purchaseOrderLines.uomId))
                    .orderBy(asc(purchaseOrders.poId), asc(purchaseOrderLines.poLineId));
                result.sections.push(
                    section(
                        'Purchase order lines',
                        {
                            number: 'Purchase order',
                            supplier: 'Supplier',
                            status: 'Status',
                            orderedAt: 'Order date',
                            expected: 'Expected delivery',
                            sku: 'SKU',
                            item: 'Item',
                            ordered: 'Ordered',
                            received: 'Received',
                            remaining: 'Remaining',
                            uom: 'Purchase UOM',
                            total: 'Ordered value',
                            outstanding: 'Outstanding value',
                        },
                        rows
                            .filter((r) => inRange(r.po.orderDate))
                            .map((r) => {
                                const a = purchaseOrderAmounts([r.line]);
                                return {
                                    number: r.po.poNumber,
                                    supplier: r.supplier,
                                    status: r.po.status,
                                    orderedAt: date(r.po.orderDate),
                                    expected: r.po.expectedDeliveryDate,
                                    sku: r.sku,
                                    item: r.name,
                                    ordered: r.line.qtyOrdered,
                                    received: r.line.qtyReceived,
                                    remaining: quantityString(
                                        quantityUnits(r.line.qtyOrdered) -
                                            quantityUnits(r.line.qtyReceived),
                                    ),
                                    uom: r.uom,
                                    total: a.totalAmount,
                                    outstanding: a.outstandingAmount,
                                };
                            }),
                    ),
                );
            } else if (q.report === 'packing') {
                const source = alias(locations, 'report_pack_source'),
                    dest = alias(locations, 'report_pack_dest');
                const rows = await tx
                    .select({
                        order: packingOrders,
                        sku: items.sku,
                        name: items.name,
                        uom: uoms.name,
                        source: source.name,
                        destination: dest.name,
                    })
                    .from(packingOrders)
                    .innerJoin(items, eq(items.itemId, packingOrders.itemId))
                    .innerJoin(uoms, eq(uoms.uomId, items.primaryUomId))
                    .innerJoin(source, eq(source.locationId, packingOrders.sourceLocationId))
                    .innerJoin(dest, eq(dest.locationId, packingOrders.destinationLocationId))
                    .orderBy(asc(packingOrders.packingOrderId));
                const selected = rows.filter((r) => inRange(r.order.createdAt));
                const ids = new Set(selected.map((r) => r.order.packingOrderId));
                result.sections.push(
                    section(
                        'Packing output and variance',
                        {
                            number: 'Packing order',
                            sku: 'SKU',
                            item: 'Product',
                            status: 'Status',
                            target: 'Target',
                            actual: 'Actual',
                            variance: 'Actual − target (completed)',
                            uom: 'Primary UOM',
                            revision: 'Released revision request',
                            source: 'Material source',
                            destination: 'Finished destination',
                        },
                        selected.map((r) => ({
                            number: r.order.packingOrderNumber,
                            sku: r.sku,
                            item: r.name,
                            status: r.order.status,
                            target: r.order.targetQty,
                            actual: r.order.actualQty,
                            variance:
                                r.order.status === 'Completed'
                                    ? quantityString(
                                          quantityUnits(r.order.actualQty) -
                                              quantityUnits(r.order.targetQty),
                                      )
                                    : null,
                            uom: r.uom,
                            revision: r.order.formulaRevisionId
                                ? String(r.order.formulaRevisionId)
                                : 'Legacy published formula',
                            source: r.source,
                            destination: r.destination,
                        })),
                    ),
                );
                const materials = await tx
                    .select({
                        material: packingOrderMaterials,
                        number: packingOrders.packingOrderNumber,
                        sku: items.sku,
                        name: items.name,
                        uom: uoms.name,
                    })
                    .from(packingOrderMaterials)
                    .innerJoin(
                        packingOrders,
                        eq(packingOrders.packingOrderId, packingOrderMaterials.packingOrderId),
                    )
                    .innerJoin(items, eq(items.itemId, packingOrderMaterials.itemId))
                    .innerJoin(uoms, eq(uoms.uomId, items.primaryUomId));
                const consumes = await tx
                    .select()
                    .from(inventoryTransactions)
                    .where(eq(inventoryTransactions.transactionType, 'Consume'));
                result.sections.push(
                    section(
                        'Saved material requirements and actual consumption',
                        {
                            number: 'Packing order',
                            sku: 'Component SKU',
                            item: 'Component',
                            required: 'Saved requirement',
                            consumed: 'Ledger consumption',
                            uom: 'Primary UOM',
                        },
                        materials
                            .filter((r) => ids.has(r.material.packingOrderId))
                            .map((r) => ({
                                number: r.number,
                                sku: r.sku,
                                item: r.name,
                                required: r.material.requiredQty,
                                consumed: quantityString(
                                    consumes
                                        .filter(
                                            (t) =>
                                                t.packingOrderId === r.material.packingOrderId &&
                                                t.itemId === r.material.itemId,
                                        )
                                        .reduce((sum, t) => sum - quantityUnits(t.qtyChange), 0n),
                                ),
                                uom: r.uom,
                            })),
                    ),
                );
            } else if (q.report === 'transfers') {
                const source = alias(locations, 'report_transfer_source'),
                    dest = alias(locations, 'report_transfer_dest');
                const rows = await tx
                    .select({
                        transfer: stockTransfers,
                        line: stockTransferLines,
                        lot: lots.lotNumber,
                        sku: items.sku,
                        name: items.name,
                        uom: uoms.name,
                        source: source.name,
                        destination: dest.name,
                    })
                    .from(stockTransferLines)
                    .innerJoin(
                        stockTransfers,
                        eq(stockTransfers.transferId, stockTransferLines.transferId),
                    )
                    .innerJoin(lots, eq(lots.lotId, stockTransferLines.lotId))
                    .innerJoin(items, eq(items.itemId, lots.itemId))
                    .innerJoin(uoms, eq(uoms.uomId, items.primaryUomId))
                    .innerJoin(source, eq(source.locationId, stockTransfers.sourceLocationId))
                    .innerJoin(dest, eq(dest.locationId, stockTransfers.destinationLocationId))
                    .orderBy(
                        asc(stockTransfers.transferId),
                        asc(stockTransferLines.transferLineId),
                    );
                result.sections.push(
                    section(
                        'Transfers and outstanding transit',
                        {
                            number: 'Transfer',
                            status: 'Status',
                            source: 'Source',
                            destination: 'Destination',
                            sku: 'SKU',
                            item: 'Item',
                            lot: 'Lot',
                            quantity: 'Quantity',
                            inTransit: 'Outstanding In Transit',
                            uom: 'Primary UOM',
                            requested: 'Requested',
                            dispatched: 'Dispatched',
                            received: 'Received',
                        },
                        rows
                            .filter((r) => inRange(r.transfer.requestedAt))
                            .map((r) => ({
                                number: r.transfer.transferNumber,
                                status: r.transfer.status,
                                source: r.source,
                                destination: r.destination,
                                sku: r.sku,
                                item: r.name,
                                lot: r.lot,
                                quantity: r.line.qtyRequested,
                                inTransit: quantityString(
                                    quantityUnits(r.line.qtyShipped) -
                                        quantityUnits(r.line.qtyReceived),
                                ),
                                uom: r.uom,
                                requested: date(r.transfer.requestedAt),
                                dispatched: date(r.transfer.dispatchedAt),
                                received: date(r.transfer.receivedAt),
                            })),
                    ),
                );
            } else {
                const catalog = await tx
                    .select({ lot: lots, sku: items.sku, name: items.name, uom: uoms.name })
                    .from(lots)
                    .innerJoin(items, eq(items.itemId, lots.itemId))
                    .innerJoin(uoms, eq(uoms.uomId, items.primaryUomId))
                    .orderBy(asc(lots.lotId));
                if (q.lotId && !catalog.some((r) => r.lot.lotId === q.lotId))
                    throw new AppError(400, 'Select an existing lot.');
                const ledger = await tx
                    .select()
                    .from(inventoryTransactions)
                    .orderBy(asc(inventoryTransactions.transactionId));
                const edges: { parent: number; child: number; order: number; quantity: string }[] =
                    [];
                for (const produced of ledger.filter(
                    (t) => t.transactionType === 'Produce' && t.packingOrderId,
                ))
                    for (const consumed of ledger.filter(
                        (t) =>
                            t.transactionType === 'Consume' &&
                            t.packingOrderId === produced.packingOrderId,
                    ))
                        edges.push({
                            parent: consumed.lotId,
                            child: produced.lotId,
                            order: produced.packingOrderId!,
                            quantity: quantityString(-quantityUnits(consumed.qtyChange)),
                        });
                const ancestors = new Set<number>(),
                    descendants = new Set<number>();
                const walk = (id: number, direction: 'up' | 'down', seen: Set<number>) => {
                    if (seen.has(id)) return;
                    seen.add(id);
                    for (const e of edges)
                        if ((direction === 'up' ? e.child : e.parent) === id)
                            walk(direction === 'up' ? e.parent : e.child, direction, seen);
                };
                if (q.lotId) {
                    walk(q.lotId, 'up', ancestors);
                    walk(q.lotId, 'down', descendants);
                }
                const selected = new Set(
                    q.lotId ? [...ancestors, ...descendants] : catalog.map((r) => r.lot.lotId),
                );
                const orders = await tx.select().from(packingOrders),
                    poLines = await tx
                        .select({
                            line: purchaseOrderLines,
                            number: purchaseOrders.poNumber,
                            supplier: suppliers.name,
                        })
                        .from(purchaseOrderLines)
                        .innerJoin(purchaseOrders, eq(purchaseOrders.poId, purchaseOrderLines.poId))
                        .innerJoin(suppliers, eq(suppliers.supplierId, purchaseOrders.supplierId));
                result.sections.push(
                    section(
                        'Lot origins',
                        {
                            lot: 'Lot',
                            sku: 'SKU',
                            item: 'Item',
                            qc: 'QC status',
                            origin: 'Origin',
                            supplier: 'Supplier',
                            manufacture: 'Manufacture date',
                            expiry: 'Expiry date',
                            uom: 'Primary UOM',
                        },
                        catalog
                            .filter((r) => selected.has(r.lot.lotId))
                            .map((r) => {
                                const po = poLines.find((p) => p.line.poLineId === r.lot.poLineId),
                                    pack = orders.find(
                                        (p) => p.packingOrderId === r.lot.packingOrderId,
                                    );
                                return {
                                    lot: r.lot.lotNumber,
                                    sku: r.sku,
                                    item: r.name,
                                    qc: r.lot.qcStatus,
                                    origin:
                                        pack?.packingOrderNumber ??
                                        po?.number ??
                                        'Legacy / opening stock',
                                    supplier: po?.supplier ?? null,
                                    manufacture: r.lot.manufactureDate,
                                    expiry: r.lot.expirationDate,
                                    uom: r.uom,
                                };
                            }),
                    ),
                );
                result.sections.push(
                    section(
                        'Material genealogy',
                        {
                            parent: 'Input lot',
                            child: 'Finished lot',
                            order: 'Packing order',
                            consumed: 'Input quantity consumed',
                            uom: 'Input primary UOM',
                        },
                        edges
                            .filter(
                                (e) =>
                                    !q.lotId ||
                                    (ancestors.has(e.parent) && ancestors.has(e.child)) ||
                                    (descendants.has(e.parent) && descendants.has(e.child)),
                            )
                            .map((e) => ({
                                parent: catalog.find((r) => r.lot.lotId === e.parent)!.lot
                                    .lotNumber,
                                child: catalog.find((r) => r.lot.lotId === e.child)!.lot.lotNumber,
                                order: orders.find((r) => r.packingOrderId === e.order)!
                                    .packingOrderNumber,
                                consumed: e.quantity,
                                uom: catalog.find((r) => r.lot.lotId === e.parent)!.uom,
                            })),
                    ),
                );
                const stocks = await tx
                    .select({ stock: inventoryStock, location: locations.name })
                    .from(inventoryStock)
                    .innerJoin(locations, eq(locations.locationId, inventoryStock.locationId));
                const reservations = await tx.select().from(inventoryReservations);
                result.sections.push(
                    section(
                        'Current locations and reservations',
                        {
                            lot: 'Lot',
                            location: 'Location',
                            onhand: 'On hand',
                            reserved: 'Reserved',
                            available: 'Available',
                            uom: 'Primary UOM',
                        },
                        stocks
                            .filter((r) => selected.has(r.stock.lotId))
                            .map((r) => {
                                const lot = catalog.find((l) => l.lot.lotId === r.stock.lotId)!;
                                const reserved = outstandingReservations(
                                    reservations.filter(
                                        (t) =>
                                            t.lotId === r.stock.lotId &&
                                            t.locationId === r.stock.locationId,
                                    ),
                                );
                                return {
                                    lot: lot.lot.lotNumber,
                                    location: r.location,
                                    onhand: r.stock.qtyOnHand,
                                    reserved,
                                    available: quantityString(
                                        quantityUnits(r.stock.qtyOnHand) - quantityUnits(reserved),
                                    ),
                                    uom: lot.uom,
                                };
                            }),
                    ),
                );
                const transfers = await tx
                    .select({
                        id: stockTransferLines.transferLineId,
                        number: stockTransfers.transferNumber,
                    })
                    .from(stockTransferLines)
                    .innerJoin(
                        stockTransfers,
                        eq(stockTransfers.transferId, stockTransferLines.transferId),
                    );
                const deliveries = await tx
                    .select({
                        id: deliveryOrderLines.deliveryOrderLineId,
                        number: deliveryOrders.deliveryOrderNumber,
                    })
                    .from(deliveryOrderLines)
                    .innerJoin(
                        deliveryOrders,
                        eq(deliveryOrders.deliveryOrderId, deliveryOrderLines.deliveryOrderId),
                    );
                result.sections.push(
                    section(
                        'Complete lot movement history',
                        {
                            lot: 'Lot',
                            type: 'Movement',
                            quantity: 'Quantity change',
                            uom: 'Primary UOM',
                            reference: 'Reference',
                            at: 'Date',
                        },
                        ledger
                            .filter((t) => selected.has(t.lotId))
                            .map((t) => {
                                const lot = catalog.find((l) => l.lot.lotId === t.lotId)!;
                                return {
                                    lot: lot.lot.lotNumber,
                                    type: t.transactionType,
                                    quantity: t.qtyChange,
                                    uom: lot.uom,
                                    reference:
                                        transfers.find((r) => r.id === t.transferLineId)?.number ??
                                        deliveries.find((r) => r.id === t.deliveryOrderLineId)
                                            ?.number ??
                                        t.referenceId,
                                    at: date(t.createdAt),
                                };
                            }),
                    ),
                );
            }
            return result;
        },
        { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
}
