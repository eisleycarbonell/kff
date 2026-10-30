import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import {
    billOfMaterials,
    inventoryReservations,
    inventoryStock,
    inventoryTransactions,
    items,
    locations,
    lots,
    packingOrderMaterials,
    packingOrders,
    uoms,
} from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import { requireActiveLocation } from '../locations/location.service.ts';
import { assertLotDates } from '../lots/lot.rules.ts';
import {
    allocatePackingMaterial,
    assertPackingLocation,
    assertPackingLot,
    assertPackingStatus,
    packingConsumption,
    packingMaximum,
    packingOutputStep,
    packingRequirement,
    packingUnitCost,
    quantityString,
    quantityUnits,
} from './packing-order.rules.ts';
import type {
    CompletePackingOrderInput,
    CreatePackingOrderInput,
    PreviewPackingOrderInput,
    UpdatePackingOrderInput,
} from './packing-order.schema.ts';

type Reader = Pick<typeof db, 'select'>;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const source = alias(locations, 'packing_source');
const destination = alias(locations, 'packing_destination');
const today = () => new Date().toISOString().slice(0, 10);
const zero = '0.0000';
const fields = {
    packingOrderId: packingOrders.packingOrderId,
    packingOrderNumber: packingOrders.packingOrderNumber,
    itemId: packingOrders.itemId,
    itemSku: items.sku,
    itemName: items.name,
    primaryUomId: items.primaryUomId,
    primaryUomName: uoms.name,
    targetQty: packingOrders.targetQty,
    actualQty: packingOrders.actualQty,
    status: packingOrders.status,
    sourceLocationId: packingOrders.sourceLocationId,
    sourceLocationCode: source.code,
    sourceLocationName: source.name,
    destinationLocationId: packingOrders.destinationLocationId,
    destinationLocationCode: destination.code,
    destinationLocationName: destination.name,
    scheduledDate: packingOrders.scheduledDate,
    startedAt: packingOrders.startedAt,
    completedAt: packingOrders.completedAt,
    notes: packingOrders.notes,
    createdBy: packingOrders.createdBy,
    createdAt: packingOrders.createdAt,
    updatedBy: packingOrders.updatedBy,
    updatedAt: packingOrders.updatedAt,
    materialCount: sql<number>`(select count(*) from ${packingOrderMaterials} where ${packingOrderMaterials.packingOrderId}=${packingOrders.packingOrderId})::integer`,
};
const orderQuery = (database: Reader) =>
    database
        .select(fields)
        .from(packingOrders)
        .innerJoin(items, eq(packingOrders.itemId, items.itemId))
        .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
        .innerJoin(source, eq(packingOrders.sourceLocationId, source.locationId))
        .innerJoin(destination, eq(packingOrders.destinationLocationId, destination.locationId));

export async function listPackingOrders(database: Reader = db) {
    return orderQuery(database).orderBy(
        desc(packingOrders.createdAt),
        desc(packingOrders.packingOrderId),
    );
}
export async function listPackingReservations(database: Reader = db, orderId?: number) {
    return database
        .select({
            reservationId: inventoryReservations.reservationId,
            packingOrderMaterialId: inventoryReservations.packingOrderMaterialId,
            packingOrderId: packingOrders.packingOrderId,
            packingOrderNumber: packingOrders.packingOrderNumber,
            orderStatus: packingOrders.status,
            itemId: items.itemId,
            itemSku: items.sku,
            itemName: items.name,
            primaryUomId: items.primaryUomId,
            primaryUomName: uoms.name,
            lotId: lots.lotId,
            lotNumber: lots.lotNumber,
            expirationDate: lots.expirationDate,
            locationId: locations.locationId,
            locationCode: locations.code,
            locationName: locations.name,
            qtyReserved: inventoryReservations.qtyReserved,
            qtyConsumed: inventoryReservations.qtyConsumed,
            qtyOutstanding: sql<string>`case when ${inventoryReservations.releasedAt} is null then (${inventoryReservations.qtyReserved}-${inventoryReservations.qtyConsumed})::text else '0.0000' end`,
            releasedAt: inventoryReservations.releasedAt,
            createdAt: inventoryReservations.createdAt,
            updatedAt: inventoryReservations.updatedAt,
        })
        .from(inventoryReservations)
        .innerJoin(
            packingOrderMaterials,
            eq(
                inventoryReservations.packingOrderMaterialId,
                packingOrderMaterials.packingOrderMaterialId,
            ),
        )
        .innerJoin(
            packingOrders,
            eq(packingOrderMaterials.packingOrderId, packingOrders.packingOrderId),
        )
        .innerJoin(items, eq(inventoryReservations.itemId, items.itemId))
        .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
        .innerJoin(lots, eq(inventoryReservations.lotId, lots.lotId))
        .innerJoin(locations, eq(inventoryReservations.locationId, locations.locationId))
        .where(orderId === undefined ? undefined : eq(packingOrders.packingOrderId, orderId))
        .orderBy(desc(inventoryReservations.createdAt), desc(inventoryReservations.reservationId));
}
export async function getPackingOrder(id: number, database: Reader = db) {
    const [order] = await orderQuery(database).where(eq(packingOrders.packingOrderId, id)).limit(1);
    if (!order) return null;
    const [materials, reservations, finishedLots] = await Promise.all([
        database
            .select({
                packingOrderMaterialId: packingOrderMaterials.packingOrderMaterialId,
                itemId: items.itemId,
                itemSku: items.sku,
                itemName: items.name,
                uomId: packingOrderMaterials.uomId,
                uomName: uoms.name,
                requiredQty: packingOrderMaterials.requiredQty,
                consumedQty: packingOrderMaterials.consumedQty,
                qtyReserved: sql<string>`coalesce((select sum(${inventoryReservations.qtyReserved}-${inventoryReservations.qtyConsumed}) from ${inventoryReservations} where ${inventoryReservations.packingOrderMaterialId}=${packingOrderMaterials.packingOrderMaterialId} and ${inventoryReservations.releasedAt} is null),0.0000)::text`,
            })
            .from(packingOrderMaterials)
            .innerJoin(items, eq(packingOrderMaterials.itemId, items.itemId))
            .innerJoin(uoms, eq(packingOrderMaterials.uomId, uoms.uomId))
            .where(eq(packingOrderMaterials.packingOrderId, id))
            .orderBy(asc(packingOrderMaterials.packingOrderMaterialId)),
        listPackingReservations(database, id),
        database
            .select({
                lotId: lots.lotId,
                lotNumber: lots.lotNumber,
                qcStatus: lots.qcStatus,
                manufactureDate: lots.manufactureDate,
                expirationDate: lots.expirationDate,
            })
            .from(lots)
            .where(eq(lots.packingOrderId, id))
            .orderBy(asc(lots.lotId)),
    ]);
    return { ...order, materials, reservations, finishedLots };
}
export async function getPackingOrderOptions(database: Reader = db) {
    const [products, locationRows] = await Promise.all([
        database
            .select({
                itemId: items.itemId,
                sku: items.sku,
                name: items.name,
                primaryUomId: items.primaryUomId,
                primaryUomName: uoms.name,
                hasBom: sql<boolean>`exists(select 1 from ${billOfMaterials} where ${billOfMaterials.parentItemId}=${items.itemId})`,
            })
            .from(items)
            .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
            .where(and(eq(items.isActive, true), eq(items.itemType, 'Finished Good')))
            .orderBy(asc(items.name)),
        database
            .select({
                locationId: locations.locationId,
                code: locations.code,
                name: locations.name,
                locationType: locations.locationType,
            })
            .from(locations)
            .where(
                and(
                    eq(locations.isActive, true),
                    inArray(locations.locationType, ['Warehouse', 'Packing']),
                ),
            )
            .orderBy(asc(locations.name)),
    ]);
    return { items: products, locations: locationRows };
}

async function packingLocations(database: Reader, ids: number[]) {
    for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
        await requireActiveLocation(database, id);
        const [row] = await database
            .select({ locationType: locations.locationType })
            .from(locations)
            .where(eq(locations.locationId, id));
        if (!row) throw new AppError(400, 'Select an existing packing location.');
        assertPackingLocation(row.locationType);
    }
}
async function snapshot(database: Reader, input: PreviewPackingOrderInput, lock = false) {
    const productQuery = database
        .select({
            itemId: items.itemId,
            itemSku: items.sku,
            itemName: items.name,
            itemType: items.itemType,
            isActive: items.isActive,
            primaryUomId: items.primaryUomId,
        })
        .from(items)
        .where(eq(items.itemId, input.itemId));
    const [product] = await (lock ? productQuery.for('update') : productQuery);
    if (!product || !product.isActive || product.itemType !== 'Finished Good')
        throw new AppError(400, 'Select an active finished product.');
    const bomQuery = database
        .select()
        .from(billOfMaterials)
        .where(eq(billOfMaterials.parentItemId, input.itemId))
        .orderBy(asc(billOfMaterials.componentItemId));
    const bom = await (lock ? bomQuery.for('share') : bomQuery);
    if (bom.length === 0)
        throw new AppError(
            400,
            'The finished product needs a valid BOM before creating or planning a packing order.',
        );
    const componentQuery = database
        .select({
            itemId: items.itemId,
            itemSku: items.sku,
            itemName: items.name,
            primaryUomId: items.primaryUomId,
            isActive: items.isActive,
            itemType: items.itemType,
        })
        .from(items)
        .where(
            inArray(
                items.itemId,
                bom.map((row) => row.componentItemId),
            ),
        )
        .orderBy(asc(items.itemId));
    const components = await (lock ? componentQuery.for('share') : componentQuery);
    const unitIds = [
        ...new Set([
            product.primaryUomId,
            ...bom.map((row) => row.uomId),
            ...components.map((row) => row.primaryUomId),
        ]),
    ].sort((a, b) => a - b);
    const unitQuery = database
        .select()
        .from(uoms)
        .where(inArray(uoms.uomId, unitIds))
        .orderBy(asc(uoms.uomId));
    const units = await (lock ? unitQuery.for('share') : unitQuery);
    const primary = units.find((row) => row.uomId === product.primaryUomId);
    if (!primary) throw new AppError(400, 'The product primary unit is unavailable.');
    const materials = bom.map((row) => {
        const item = components.find((item) => item.itemId === row.componentItemId);
        if (!item || !item.isActive || item.itemType === 'Finished Good')
            throw new AppError(
                400,
                'BOM components must be active raw materials, packaging, or labels.',
            );
        const bomUnit = units.find((unit) => unit.uomId === row.uomId);
        const primaryUnit = units.find((unit) => unit.uomId === item.primaryUomId);
        if (!bomUnit || !primaryUnit || bomUnit.uomClassId !== primaryUnit.uomClassId)
            throw new AppError(
                400,
                'Every BOM unit must be compatible with its component primary unit.',
            );
        return {
            itemId: item.itemId,
            itemSku: item.itemSku,
            itemName: item.itemName,
            uomId: primaryUnit.uomId,
            uomName: primaryUnit.name,
            requiredQty: packingRequirement(
                row.quantity,
                input.targetQty,
                bomUnit.factorToBase,
                primaryUnit.factorToBase,
            ),
        };
    });
    return {
        itemId: product.itemId,
        itemSku: product.itemSku,
        itemName: product.itemName,
        primaryUomId: product.primaryUomId,
        primaryUomName: primary.name,
        targetQty: quantityString(quantityUnits(input.targetQty)),
        sourceLocationId: input.sourceLocationId,
        materials,
    };
}
type ReservationRow = typeof inventoryReservations.$inferSelect;
const outstanding = (rows: Pick<ReservationRow, 'qtyReserved' | 'qtyConsumed'>[]) =>
    rows.reduce(
        (sum, row) => sum + quantityUnits(row.qtyReserved) - quantityUnits(row.qtyConsumed),
        0n,
    );
const lockLots = (tx: Transaction, lotIds: number[]) =>
    tx
        .select()
        .from(lots)
        .where(inArray(lots.lotId, lotIds))
        .orderBy(asc(lots.lotId))
        .for('update');
const lockBalances = (tx: Transaction, lotIds: number[], locationId: number) =>
    tx
        .select()
        .from(inventoryStock)
        .where(
            and(inArray(inventoryStock.lotId, lotIds), eq(inventoryStock.locationId, locationId)),
        )
        .orderBy(asc(inventoryStock.lotId))
        .for('update');
const activeReserved = sql`coalesce((select sum(${inventoryReservations.qtyReserved}-${inventoryReservations.qtyConsumed}) from ${inventoryReservations} where ${inventoryReservations.lotId}=${inventoryStock.lotId} and ${inventoryReservations.locationId}=${inventoryStock.locationId} and ${inventoryReservations.releasedAt} is null),0)`;
async function eligibleStocks(
    database: Reader,
    itemIds: number[],
    locationId: number,
    lotIds?: number[],
) {
    if (lotIds?.length === 0) return [];
    return database
        .select({
            stockId: inventoryStock.stockId,
            itemId: inventoryStock.itemId,
            lotId: inventoryStock.lotId,
            qtyOnHand: inventoryStock.qtyOnHand,
            qtyReserved: sql<string>`${activeReserved}::text`,
            expirationDate: lots.expirationDate,
        })
        .from(inventoryStock)
        .innerJoin(lots, eq(inventoryStock.lotId, lots.lotId))
        .where(
            and(
                inArray(inventoryStock.itemId, itemIds),
                eq(inventoryStock.locationId, locationId),
                eq(lots.qcStatus, 'Approved'),
                or(isNull(lots.expirationDate), sql`${lots.expirationDate} > ${today()}`),
                lotIds ? inArray(lots.lotId, lotIds) : undefined,
            ),
        )
        .orderBy(asc(sql`coalesce(${lots.expirationDate}, '9999-12-31'::date)`), asc(lots.lotId));
}
export async function previewPackingOrder(input: PreviewPackingOrderInput, database: Reader = db) {
    const saved = await snapshot(database, input);
    await packingLocations(database, [input.sourceLocationId]);
    const stocks = await eligibleStocks(
        database,
        saved.materials.map((row) => row.itemId),
        input.sourceLocationId,
    );
    const materials = saved.materials.map((row) => {
        const selected = stocks.filter((stock) => stock.itemId === row.itemId);
        const onHand = selected.reduce((sum, stock) => sum + quantityUnits(stock.qtyOnHand), 0n);
        const reserved = selected.reduce(
            (sum, stock) => sum + quantityUnits(stock.qtyReserved),
            0n,
        );
        const available = onHand - reserved;
        const shortage = quantityUnits(row.requiredQty) - available;
        return {
            ...row,
            qtyOnHand: quantityString(onHand),
            qtyReserved: quantityString(reserved),
            qtyAvailable: quantityString(available),
            maxProducible: packingMaximum(
                quantityString(available),
                row.requiredQty,
                input.targetQty,
            ),
            shortageQty: quantityString(shortage > 0n ? shortage : 0n),
        };
    });
    const maximum = materials.reduce(
        (min, row) =>
            quantityUnits(row.maxProducible) < min ? quantityUnits(row.maxProducible) : min,
        99_999_999_999_999n,
    );
    const step = packingOutputStep(
        materials.map((row) => row.requiredQty),
        input.targetQty,
    );
    return {
        ...saved,
        maxProducible: quantityString((maximum / step) * step),
        canPlan: materials.every((row) => quantityUnits(row.shortageQty) === 0n),
        materials,
    };
}
async function savedOrder(id: number, database: Reader) {
    const saved = await getPackingOrder(id, database);
    if (!saved) throw new Error('The saved packing order could not be loaded.');
    return saved;
}
export async function createPackingOrder(
    input: CreatePackingOrderInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        if (input.sourceLocationId === input.destinationLocationId)
            throw new AppError(
                400,
                'Select different material source and finished-goods destination locations.',
            );
        const copied = await snapshot(tx, input, true);
        await packingLocations(tx, [input.sourceLocationId, input.destinationLocationId]);
        const [created] = await tx
            .insert(packingOrders)
            .values({
                ...input,
                targetQty: copied.targetQty,
                createdBy: actorId,
                updatedBy: actorId,
            })
            .returning({ id: packingOrders.packingOrderId });
        if (!created) throw new Error('The packing order could not be created.');
        await tx.insert(packingOrderMaterials).values(
            copied.materials.map((row) => ({
                packingOrderId: created.id,
                itemId: row.itemId,
                uomId: row.uomId,
                requiredQty: row.requiredQty,
                createdBy: actorId,
                updatedBy: actorId,
            })),
        );
        return savedOrder(created.id, tx);
    });
}
async function lockOrder(tx: Transaction, id: number) {
    const [order] = await tx
        .select()
        .from(packingOrders)
        .where(eq(packingOrders.packingOrderId, id))
        .for('update');
    return order ?? null;
}
async function lockMaterials(tx: Transaction, id: number) {
    const materials = await tx
        .select()
        .from(packingOrderMaterials)
        .where(eq(packingOrderMaterials.packingOrderId, id))
        .orderBy(asc(packingOrderMaterials.packingOrderMaterialId))
        .for('update');
    if (materials.length === 0)
        throw new AppError(409, 'The packing order has no historical material snapshot.');
    return materials;
}
async function validateItems(
    tx: Transaction,
    productId: number,
    materials: Awaited<ReturnType<typeof lockMaterials>>,
) {
    const rows = await tx
        .select()
        .from(items)
        .where(
            inArray(
                items.itemId,
                [...new Set([productId, ...materials.map((row) => row.itemId)])].sort(
                    (a, b) => a - b,
                ),
            ),
        )
        .orderBy(asc(items.itemId))
        .for('share');
    const product = rows.find((row) => row.itemId === productId);
    if (!product || !product.isActive || product.itemType !== 'Finished Good')
        throw new AppError(409, 'The packing product must remain an active finished good.');
    for (const material of materials) {
        const item = rows.find((row) => row.itemId === material.itemId);
        if (
            !item ||
            !item.isActive ||
            item.itemType === 'Finished Good' ||
            item.primaryUomId !== material.uomId
        )
            throw new AppError(
                409,
                'Snapshot materials must remain active and use their original primary units.',
            );
    }
    return product;
}
export async function updatePackingOrder(
    id: number,
    input: UpdatePackingOrderInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const order = await lockOrder(tx, id);
        if (!order) return null;
        assertPackingStatus(order.status, ['Draft']);
        if ((input.destinationLocationId ?? order.destinationLocationId) === order.sourceLocationId)
            throw new AppError(
                400,
                'Select different material source and finished-goods destination locations.',
            );
        await packingLocations(tx, [
            order.sourceLocationId,
            input.destinationLocationId ?? order.destinationLocationId,
        ]);
        await tx
            .update(packingOrders)
            .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(packingOrders.packingOrderId, id));
        return savedOrder(id, tx);
    });
}
export async function planPackingOrder(id: number, actorId: number, database: typeof db = db) {
    return database.transaction(async (tx) => {
        const order = await lockOrder(tx, id);
        if (!order) return null;
        assertPackingStatus(order.status, ['Draft']);
        const materials = await lockMaterials(tx, id);
        await validateItems(tx, order.itemId, materials);
        const observed = await eligibleStocks(
            tx,
            materials.map((row) => row.itemId),
            order.sourceLocationId,
        );
        const lotIds = [...new Set(observed.map((row) => row.lotId))].sort((a, b) => a - b);
        // Every inventory writer locks parent lots before locations, stock, then reservations.
        // The parent lock also guards FK insertion of reservations during availability checks.
        if (lotIds.length) await lockLots(tx, lotIds);
        await packingLocations(tx, [order.sourceLocationId, order.destinationLocationId]);
        const balances = lotIds.length
            ? await lockBalances(tx, lotIds, order.sourceLocationId)
            : [];
        const reservations = lotIds.length
            ? await tx
                  .select()
                  .from(inventoryReservations)
                  .where(
                      and(
                          inArray(inventoryReservations.lotId, lotIds),
                          eq(inventoryReservations.locationId, order.sourceLocationId),
                      ),
                  )
                  .orderBy(asc(inventoryReservations.reservationId))
                  .for('update')
            : [];
        // Re-read eligibility only after parent locks, so QC/expiry changes cannot race planning.
        const eligible = await eligibleStocks(
            tx,
            materials.map((row) => row.itemId),
            order.sourceLocationId,
            lotIds,
        );
        for (const material of materials) {
            const candidates = eligible
                .filter((row) => row.itemId === material.itemId)
                .map((row) => ({
                    lotId: row.lotId,
                    qtyOnHand:
                        balances.find((balance) => balance.stockId === row.stockId)?.qtyOnHand ??
                        zero,
                    qtyReserved: quantityString(
                        outstanding(
                            reservations.filter(
                                (reservation) =>
                                    reservation.lotId === row.lotId &&
                                    reservation.releasedAt === null,
                            ),
                        ),
                    ),
                }));
            const allocations = allocatePackingMaterial(material.requiredQty, candidates);
            for (const allocation of allocations)
                await tx.insert(inventoryReservations).values({
                    ...allocation,
                    packingOrderMaterialId: material.packingOrderMaterialId,
                    itemId: material.itemId,
                    locationId: order.sourceLocationId,
                    createdBy: actorId,
                    updatedBy: actorId,
                });
        }
        await tx
            .update(packingOrders)
            .set({ status: 'Planned', updatedBy: actorId, updatedAt: new Date() })
            .where(eq(packingOrders.packingOrderId, id));
        return savedOrder(id, tx);
    });
}

async function guardedReservations(
    tx: Transaction,
    order: NonNullable<Awaited<ReturnType<typeof lockOrder>>>,
    materials: Awaited<ReturnType<typeof lockMaterials>>,
    validate = true,
) {
    const ids = materials.map((row) => row.packingOrderMaterialId);
    const observed = await tx
        .select()
        .from(inventoryReservations)
        .where(inArray(inventoryReservations.packingOrderMaterialId, ids));
    const lotIds = [...new Set(observed.map((row) => row.lotId))].sort((a, b) => a - b);
    const lockedLots = lotIds.length ? await lockLots(tx, lotIds) : [];
    if (validate) await packingLocations(tx, [order.sourceLocationId, order.destinationLocationId]);
    const balances = lotIds.length ? await lockBalances(tx, lotIds, order.sourceLocationId) : [];
    const all = lotIds.length
        ? await tx
              .select()
              .from(inventoryReservations)
              .where(inArray(inventoryReservations.lotId, lotIds))
              .orderBy(asc(inventoryReservations.reservationId))
              .for('update')
        : [];
    const own = all.filter((row) => ids.includes(row.packingOrderMaterialId));
    if (validate) {
        for (const row of own) {
            const lot = lockedLots.find((lot) => lot.lotId === row.lotId);
            const material = materials.find(
                (material) => material.packingOrderMaterialId === row.packingOrderMaterialId,
            );
            if (
                !lot ||
                !material ||
                lot.itemId !== material.itemId ||
                row.itemId !== material.itemId ||
                row.locationId !== order.sourceLocationId ||
                row.releasedAt !== null
            )
                throw new AppError(409, 'The packing reservations are no longer valid.');
            assertPackingLot(lot.qcStatus, lot.expirationDate, today());
        }
        for (const material of materials) {
            const reserved = outstanding(
                own.filter((row) => row.packingOrderMaterialId === material.packingOrderMaterialId),
            );
            if (
                reserved !== quantityUnits(material.requiredQty) ||
                quantityUnits(material.consumedQty) !== 0n
            )
                throw new AppError(409, 'Every material must be fully reserved before packing.');
        }
        for (const lotId of lotIds) {
            const balance = balances.find((row) => row.lotId === lotId);
            const total = outstanding(
                all.filter(
                    (row) =>
                        row.lotId === lotId &&
                        row.locationId === order.sourceLocationId &&
                        row.releasedAt === null,
                ),
            );
            if (!balance || quantityUnits(balance.qtyOnHand) < total)
                throw new AppError(
                    409,
                    'The reserved stock is no longer available. Refresh the packing order.',
                );
        }
    }
    return { own, balances, lockedLots };
}
export async function startPackingOrder(id: number, actorId: number, database: typeof db = db) {
    return database.transaction(async (tx) => {
        const order = await lockOrder(tx, id);
        if (!order) return null;
        assertPackingStatus(order.status, ['Planned']);
        const materials = await lockMaterials(tx, id);
        await validateItems(tx, order.itemId, materials);
        await guardedReservations(tx, order, materials);
        // Allocation stays protected while work is in progress. Consumption and output
        // commit together on completion so a failed output never leaves deducted inputs.
        await tx
            .update(packingOrders)
            .set({
                status: 'In Progress',
                startedAt: new Date(),
                updatedBy: actorId,
                updatedAt: new Date(),
            })
            .where(eq(packingOrders.packingOrderId, id));
        return savedOrder(id, tx);
    });
}
export async function cancelPackingOrder(id: number, actorId: number, database: typeof db = db) {
    return database.transaction(async (tx) => {
        const order = await lockOrder(tx, id);
        if (!order) return null;
        assertPackingStatus(order.status, ['Draft', 'Planned', 'In Progress']);
        const materials = await lockMaterials(tx, id);
        const { own } = await guardedReservations(tx, order, materials, false);
        const now = new Date();
        for (const reservation of own.filter((row) => row.releasedAt === null))
            await tx
                .update(inventoryReservations)
                .set({ releasedAt: now, updatedBy: actorId, updatedAt: now })
                .where(eq(inventoryReservations.reservationId, reservation.reservationId));
        await tx
            .update(packingOrders)
            .set({ status: 'Cancelled', updatedBy: actorId, updatedAt: now })
            .where(eq(packingOrders.packingOrderId, id));
        return savedOrder(id, tx);
    });
}
export async function completePackingOrder(
    id: number,
    input: CompletePackingOrderInput,
    actorId: number,
    database: typeof db = db,
) {
    return database.transaction(async (tx) => {
        const order = await lockOrder(tx, id);
        if (!order) return null;
        assertPackingStatus(order.status, ['In Progress']);
        assertLotDates(input.manufactureDate, input.expirationDate);
        const materials = await lockMaterials(tx, id);
        const product = await validateItems(tx, order.itemId, materials);
        const guarded = await guardedReservations(tx, order, materials);
        const consumed: { qtyConsumed: string; unitCost: string | null }[] = [];
        const now = new Date();
        for (const material of materials) {
            const consumption = packingConsumption(
                material.requiredQty,
                input.actualQty,
                order.targetQty,
            );
            let remaining = quantityUnits(consumption);
            for (const reservation of guarded.own.filter(
                (row) => row.packingOrderMaterialId === material.packingOrderMaterialId,
            )) {
                const reserved = outstanding([reservation]);
                const amount = remaining < reserved ? remaining : reserved;
                const lot = guarded.lockedLots.find((row) => row.lotId === reservation.lotId);
                const balance = guarded.balances.find((row) => row.lotId === reservation.lotId);
                if (!lot || !balance)
                    throw new AppError(409, 'The reserved stock is no longer available.');
                if (amount > 0n) {
                    const next = quantityUnits(balance.qtyOnHand) - amount;
                    if (next < 0n)
                        throw new AppError(409, 'The reserved stock is no longer available.');
                    balance.qtyOnHand = quantityString(next);
                    await tx
                        .update(inventoryStock)
                        .set({ qtyOnHand: balance.qtyOnHand, lastUpdated: now })
                        .where(eq(inventoryStock.stockId, balance.stockId));
                    await tx.insert(inventoryTransactions).values({
                        itemId: material.itemId,
                        lotId: reservation.lotId,
                        locationId: order.sourceLocationId,
                        qtyChange: quantityString(-amount),
                        transactionType: 'Consume',
                        packingOrderId: id,
                        referenceId: order.packingOrderNumber,
                        authorizedByUserId: actorId,
                    });
                    consumed.push({ qtyConsumed: quantityString(amount), unitCost: lot.unitCost });
                }
                await tx
                    .update(inventoryReservations)
                    .set({
                        qtyConsumed: quantityString(
                            quantityUnits(reservation.qtyConsumed) + amount,
                        ),
                        releasedAt: now,
                        updatedBy: actorId,
                        updatedAt: now,
                    })
                    .where(eq(inventoryReservations.reservationId, reservation.reservationId));
                remaining -= amount;
            }
            if (remaining !== 0n)
                throw new AppError(
                    409,
                    'The packing order does not have enough reserved material.',
                );
            await tx
                .update(packingOrderMaterials)
                .set({ consumedQty: consumption, updatedBy: actorId, updatedAt: now })
                .where(
                    eq(
                        packingOrderMaterials.packingOrderMaterialId,
                        material.packingOrderMaterialId,
                    ),
                );
        }
        const [lot] = await tx
            .insert(lots)
            .values({
                lotNumber: input.lotNumber,
                itemId: order.itemId,
                poLineId: null,
                packingOrderId: id,
                manufactureDate: input.manufactureDate,
                expirationDate: input.expirationDate,
                qcStatus: product.requiresQc ? 'Quarantine' : 'Approved',
                unitCost: packingUnitCost(consumed, input.actualQty),
                createdBy: actorId,
                updatedBy: actorId,
            })
            .returning({ lotId: lots.lotId });
        if (!lot) throw new Error('The finished-product lot could not be created.');
        const actualQty = quantityString(quantityUnits(input.actualQty));
        await tx.insert(inventoryStock).values({
            itemId: order.itemId,
            lotId: lot.lotId,
            locationId: order.destinationLocationId,
            qtyOnHand: actualQty,
        });
        await tx.insert(inventoryTransactions).values({
            itemId: order.itemId,
            lotId: lot.lotId,
            locationId: order.destinationLocationId,
            qtyChange: actualQty,
            transactionType: 'Produce',
            packingOrderId: id,
            referenceId: order.packingOrderNumber,
            authorizedByUserId: actorId,
        });
        await tx
            .update(packingOrders)
            .set({
                actualQty,
                status: 'Completed',
                completedAt: now,
                updatedBy: actorId,
                updatedAt: now,
            })
            .where(eq(packingOrders.packingOrderId, id));
        return savedOrder(id, tx);
    });
}
