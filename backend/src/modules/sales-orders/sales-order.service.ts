import { packingMaterialSnapshot } from '../packing-orders/packing-order.service.ts';
import {
    aggregatePlanningMaterials,
    planningDemand,
    type PlanningMaterial,
} from './sales-order-planning.rules.ts';
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
    customers,
    items,
    uoms,
    salesOrders,
    salesOrderLines,
    deliveryOrders,
    deliveryOrderLines,
    locations,
    inventoryStock,
    lots,
    supplierItems,
    suppliers,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import { quantityUnits, quantityString } from '../inventory-stocks/inventory-stock.rules.ts';
import type { CreateSalesOrderInput, UpdateSalesOrderInput } from './sales-order.schema.ts';

type Reader = Pick<typeof db, 'select'>;
const fields = {
    salesOrderId: salesOrders.salesOrderId,
    salesOrderNumber: salesOrders.salesOrderNumber,
    customerId: salesOrders.customerId,
    customerPoNumber: salesOrders.customerPoNumber,
    customerName: customers.name,
    customerIsActive: customers.isActive,
    orderDate: salesOrders.orderDate,
    requestedDeliveryDate: salesOrders.requestedDeliveryDate,
    status: salesOrders.status,
    notes: salesOrders.notes,
    createdBy: salesOrders.createdBy,
    updatedBy: salesOrders.updatedBy,
    createdAt: salesOrders.createdAt,
    updatedAt: salesOrders.updatedAt,
};
const query = (database: Reader) =>
    database
        .select(fields)
        .from(salesOrders)
        .innerJoin(customers, eq(salesOrders.customerId, customers.customerId));
const lineFields = {
    salesOrderLineId: salesOrderLines.salesOrderLineId,
    salesOrderId: salesOrderLines.salesOrderId,
    itemId: salesOrderLines.itemId,
    itemSku: items.sku,
    itemName: items.name,
    uomId: salesOrderLines.uomId,
    uomName: uoms.name,
    qtyOrdered: salesOrderLines.qtyOrdered,
    qtyDelivered: salesOrderLines.qtyDelivered,
    unitPrice: salesOrderLines.unitPrice,
    qtyAllocated: sql<string>`coalesce((select sum(${deliveryOrderLines.qtyDelivered}) from ${deliveryOrderLines} inner join ${deliveryOrders} on ${deliveryOrderLines.deliveryOrderId}=${deliveryOrders.deliveryOrderId} where ${deliveryOrderLines.salesOrderLineId}=${salesOrderLines.salesOrderLineId} and ${deliveryOrders.status} in ('Draft','In Transit')),0)::numeric(14,4)::text`,
};
export function salesLineAmounts(line: {
    qtyOrdered: string;
    qtyDelivered: string;
    unitPrice: string;
}) {
    const ordered = quantityUnits(line.qtyOrdered);
    return {
        qtyRemaining: quantityString(ordered - quantityUnits(line.qtyDelivered)),
        lineTotal: quantityString((ordered * quantityUnits(line.unitPrice) + 5000n) / 10000n),
    };
}
async function linesFor(ids: number[], database: Reader) {
    if (!ids.length) return [];
    const rows = await database
        .select(lineFields)
        .from(salesOrderLines)
        .innerJoin(items, eq(salesOrderLines.itemId, items.itemId))
        .innerJoin(uoms, eq(salesOrderLines.uomId, uoms.uomId))
        .where(inArray(salesOrderLines.salesOrderId, ids))
        .orderBy(asc(salesOrderLines.salesOrderLineId));
    return rows.map((row) => ({ ...row, ...salesLineAmounts(row) }));
}
export async function listSalesOrders(database: Reader = db) {
    const headers = await query(database).orderBy(
        desc(salesOrders.orderDate),
        desc(salesOrders.salesOrderId),
    );
    const lines = await linesFor(
        headers.map((header) => header.salesOrderId),
        database,
    );
    return headers.map((header) => {
        const matching = lines.filter((line) => line.salesOrderId === header.salesOrderId);
        return {
            ...header,
            lines: matching,
            lineCount: matching.length,
            totalAmount: quantityString(
                matching.reduce((total, line) => total + quantityUnits(line.lineTotal), 0n),
            ),
        };
    });
}
export async function getSalesOrder(id: number, database: Reader = db) {
    const [header] = await query(database).where(eq(salesOrders.salesOrderId, id)).limit(1);
    if (!header) return null;
    const lines = await linesFor([id], database);
    return {
        ...header,
        lines,
        lineCount: lines.length,
        totalAmount: quantityString(
            lines.reduce((total, line) => total + quantityUnits(line.lineTotal), 0n),
        ),
    };
}
export async function getSalesOrderOptions() {
    const [customerRows, itemRows, sourceLocations] = await Promise.all([
        db
            .select({
                customerId: customers.customerId,
                name: customers.name,
                isActive: customers.isActive,
            })
            .from(customers)
            .orderBy(asc(customers.name)),
        db
            .select({
                itemId: items.itemId,
                sku: items.sku,
                name: items.name,
                primaryUomId: items.primaryUomId,
                primaryUomName: uoms.name,
                isActive: items.isActive,
            })
            .from(items)
            .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
            .where(eq(items.itemType, 'Finished Good'))
            .orderBy(asc(items.name)),
        db
            .select({
                locationId: locations.locationId,
                code: locations.code,
                name: locations.name,
                isActive: locations.isActive,
            })
            .from(locations)
            .where(inArray(locations.locationType, ['Warehouse', 'Packing']))
            .orderBy(asc(locations.name)),
    ]);
    return { customers: customerRows, items: itemRows, sourceLocations };
}
export async function lockSalesOrder(database: Reader, id: number) {
    const [header] = await database
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, id))
        .for('update');
    return header ?? null;
}
async function validateDefinitions(
    database: Reader,
    customerId: number,
    lines: { itemId: number; uomId: number }[],
) {
    const [customer] = await database
        .select()
        .from(customers)
        .where(eq(customers.customerId, customerId))
        .for('share');
    if (!customer?.isActive) throw new AppError(409, 'Select an active customer.');
    const ids = [...new Set(lines.map((line) => line.itemId))].sort((a, b) => a - b);
    if (!ids.length || ids.length !== lines.length)
        throw new AppError(400, 'Add each finished product only once.');
    const products = await database
        .select()
        .from(items)
        .where(inArray(items.itemId, ids))
        .orderBy(asc(items.itemId))
        .for('share');
    for (const line of lines) {
        const item = products.find((row) => row.itemId === line.itemId);
        if (
            !item?.isActive ||
            item.itemType !== 'Finished Good' ||
            item.primaryUomId !== line.uomId
        )
            throw new AppError(409, 'Sales require active finished goods in their primary UOM.');
    }
}
function datesValid(orderDate: string, deliveryDate: string | null | undefined) {
    if (deliveryDate && deliveryDate < orderDate)
        throw new AppError(400, 'Delivery date cannot precede the order date.');
}
async function saveLines(
    database: Parameters<Parameters<typeof db.transaction>[0]>[0],
    id: number,
    lines: CreateSalesOrderInput['lines'],
    actorId: number,
) {
    await database.insert(salesOrderLines).values(
        lines.map((line) => ({
            ...line,
            salesOrderId: id,
            createdBy: actorId,
            updatedBy: actorId,
        })),
    );
}
async function saved(database: Reader, id: number) {
    const result = await getSalesOrder(id, database);
    if (!result) throw new Error('The saved sales order could not be loaded.');
    return result;
}
export async function createSalesOrder(
    input: CreateSalesOrderInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        await validateDefinitions(tx, input.customerId, input.lines);
        datesValid(input.orderDate, input.requestedDeliveryDate);
        const { lines, ...header } = input;
        const [created] = await tx
            .insert(salesOrders)
            .values({ ...header, createdBy: actorId, updatedBy: actorId })
            .returning({ id: salesOrders.salesOrderId });
        if (!created) throw new Error('The sales order could not be created.');
        await saveLines(tx, created.id, lines, actorId);
        return saved(tx, created.id);
    });
}
export async function updateSalesOrder(
    id: number,
    input: UpdateSalesOrderInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const header = await lockSalesOrder(tx, id);
        if (!header) return null;
        if (header.status !== 'Draft')
            throw new AppError(409, 'Only draft sales orders can be edited.');
        const currentLines = await tx
            .select()
            .from(salesOrderLines)
            .where(eq(salesOrderLines.salesOrderId, id))
            .orderBy(asc(salesOrderLines.salesOrderLineId))
            .for('update');
        await validateDefinitions(
            tx,
            input.customerId ?? header.customerId,
            input.lines ?? currentLines,
        );
        datesValid(
            input.orderDate ?? header.orderDate,
            input.requestedDeliveryDate === undefined
                ? header.requestedDeliveryDate
                : input.requestedDeliveryDate,
        );
        const { lines, ...changes } = input;
        await tx
            .update(salesOrders)
            .set({ ...changes, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(salesOrders.salesOrderId, id));
        if (lines) {
            await tx.delete(salesOrderLines).where(eq(salesOrderLines.salesOrderId, id));
            await saveLines(tx, id, lines, actorId);
        }
        return saved(tx, id);
    });
}
export async function confirmSalesOrder(id: number, actorId: number, database: typeof db = db) {
    return database.transaction(async (tx) => {
        const header = await lockSalesOrder(tx, id);
        if (!header) return null;
        if (header.status !== 'Draft')
            throw new AppError(409, 'Only draft sales orders can be confirmed.');
        const lines = await tx
            .select()
            .from(salesOrderLines)
            .where(eq(salesOrderLines.salesOrderId, id));
        await validateDefinitions(tx, header.customerId, lines);
        await tx
            .update(salesOrders)
            .set({ status: 'Confirmed', updatedBy: actorId, updatedAt: new Date() })
            .where(eq(salesOrders.salesOrderId, id));
        return saved(tx, id);
    });
}
export async function cancelSalesOrder(id: number, actorId: number, database: typeof db = db) {
    return database.transaction(async (tx) => {
        const header = await lockSalesOrder(tx, id);
        if (!header) return null;
        if (!['Draft', 'Confirmed'].includes(header.status))
            throw new AppError(
                409,
                'Only unfulfilled draft or confirmed sales orders can be cancelled.',
            );
        const [delivery] = await tx
            .select({ id: deliveryOrders.deliveryOrderId })
            .from(deliveryOrders)
            .where(and(eq(deliveryOrders.salesOrderId, id), ne(deliveryOrders.status, 'Cancelled')))
            .limit(1);
        if (delivery)
            throw new AppError(
                409,
                'Cancel draft deliveries before cancelling this sales order. Dispatched deliveries cannot be cancelled.',
            );
        await tx
            .update(salesOrders)
            .set({ status: 'Cancelled', updatedBy: actorId, updatedAt: new Date() })
            .where(eq(salesOrders.salesOrderId, id));
        return saved(tx, id);
    });
}

/** Advisory customer-demand calculation; operational writers recheck stock under locks. */
export async function getSalesOrderMaterialPlan(
    id: number,
    sourceLocationId: number,
    database: typeof db = db,
) {
    return database.transaction(
        async (tx) => {
            const order = await getSalesOrder(id, tx);
            if (!order) return null;
            const [source] = await tx
                .select()
                .from(locations)
                .where(eq(locations.locationId, sourceLocationId));
            if (!source?.isActive || !['Warehouse', 'Packing'].includes(source.locationType))
                throw new AppError(400, 'Select an active warehouse or packing source.');
            const productIds = order.lines.map((line) => line.itemId);
            const productRows = productIds.length
                ? await tx.select().from(items).where(inArray(items.itemId, productIds))
                : [];
            const draftRows = await tx
                .select({
                    itemId: deliveryOrderLines.itemId,
                    qty: sql<string>`sum(${deliveryOrderLines.qtyDelivered})::text`,
                })
                .from(deliveryOrderLines)
                .innerJoin(
                    deliveryOrders,
                    eq(deliveryOrders.deliveryOrderId, deliveryOrderLines.deliveryOrderId),
                )
                .where(and(eq(deliveryOrders.salesOrderId, id), eq(deliveryOrders.status, 'Draft')))
                .groupBy(deliveryOrderLines.itemId);
            const reserved = sql`coalesce((select sum(r.qty_reserved-r.qty_consumed) from inventory_reservations r where r.item_id=inventory_stock.item_id and r.lot_id=inventory_stock.lot_id and r.location_id=inventory_stock.location_id and r.released_at is null),0)`;
            const eligible = await tx
                .select({
                    itemId: inventoryStock.itemId,
                    locationId: inventoryStock.locationId,
                    locationType: locations.locationType,
                    packingOrderId: lots.packingOrderId,
                    qtyAvailable: sql<string>`greatest(${inventoryStock.qtyOnHand}-${reserved},0)::text`,
                })
                .from(inventoryStock)
                .innerJoin(items, eq(items.itemId, inventoryStock.itemId))
                .innerJoin(
                    lots,
                    and(
                        eq(lots.lotId, inventoryStock.lotId),
                        eq(lots.itemId, inventoryStock.itemId),
                    ),
                )
                .innerJoin(locations, eq(locations.locationId, inventoryStock.locationId))
                .where(
                    and(
                        eq(items.isActive, true),
                        eq(locations.isActive, true),
                        eq(lots.qcStatus, 'Approved'),
                        or(
                            isNull(lots.expirationDate),
                            sql`${lots.expirationDate} > ${new Date().toISOString().slice(0, 10)}`,
                        ),
                    ),
                );
            const addSupply = (map: Map<number, string>, itemId: number, qty: string) => {
                map.set(
                    itemId,
                    quantityString(quantityUnits(map.get(itemId) ?? '0') + quantityUnits(qty)),
                );
            };
            const finished = new Map<number, string>();
            const materialSupply = new Map<number, string>();
            for (const row of eligible) {
                if (
                    row.packingOrderId !== null &&
                    ['Warehouse', 'Branch', 'Store'].includes(row.locationType)
                )
                    addSupply(finished, row.itemId, row.qtyAvailable);
                if (row.locationId === sourceLocationId)
                    addSupply(materialSupply, row.itemId, row.qtyAvailable);
            }
            const requirements: PlanningMaterial[] = [];
            const products = [];
            for (const line of order.lines) {
                const demand = planningDemand(
                    {
                        ...line,
                        qtyDraftAllocated:
                            draftRows.find((row) => row.itemId === line.itemId)?.qty ?? '0',
                        qtyFinishedAvailable: finished.get(line.itemId) ?? '0',
                    },
                    order.status === 'Cancelled',
                );
                let issue: string | null = null;
                const product = productRows.find((row) => row.itemId === line.itemId);
                if (
                    quantityUnits(demand.qtyDemand) > 0n &&
                    (!product?.isActive || product.itemType !== 'Finished Good')
                )
                    issue = 'The finished product is inactive or unavailable.';
                else if (quantityUnits(demand.qtyToPack) > 0n) {
                    try {
                        const snapshot = await packingMaterialSnapshot(tx, {
                            itemId: line.itemId,
                            targetQty: demand.qtyToPack,
                            sourceLocationId,
                        });
                        requirements.push(...snapshot.materials);
                    } catch (error) {
                        if (!(error instanceof AppError)) throw error;
                        issue = error.message;
                    }
                }
                products.push({
                    salesOrderLineId: line.salesOrderLineId,
                    itemId: line.itemId,
                    itemSku: line.itemSku,
                    itemName: line.itemName,
                    uomName: line.uomName,
                    ...demand,
                    issue,
                });
            }
            const supplierRows = await tx
                .select({
                    itemId: supplierItems.itemId,
                    supplierId: suppliers.supplierId,
                    name: suppliers.name,
                })
                .from(supplierItems)
                .innerJoin(suppliers, eq(suppliers.supplierId, supplierItems.supplierId))
                .where(and(eq(supplierItems.isActive, true), eq(suppliers.isActive, true)))
                .orderBy(asc(suppliers.name));
            const supplierMap = new Map<number, { supplierId: number; name: string }[]>();
            for (const row of supplierRows) {
                const linked = supplierMap.get(row.itemId) ?? [];
                linked.push({ supplierId: row.supplierId, name: row.name });
                supplierMap.set(row.itemId, linked);
            }
            const materials = aggregatePlanningMaterials(requirements, materialSupply, supplierMap);
            return {
                salesOrderId: order.salesOrderId,
                salesOrderNumber: order.salesOrderNumber,
                customerPoNumber: order.customerPoNumber,
                sourceLocationId,
                sourceLocationName: source.name,
                advisory: true as const,
                products,
                materials,
                canPack:
                    products.every((row) => row.issue === null) &&
                    materials.every((row) => quantityUnits(row.qtyShortage) === 0n),
            };
        },
        { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
}
