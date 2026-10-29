import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/index.ts';
import { suppliers, supplierItems, items, uoms, purchaseOrders } from '../../db/schema.ts';
import { AppError } from '../../errors/app-error.ts';
import type {
    CreateSupplierInput,
    UpdateSupplierInput,
    CreateSupplierItemInput,
    UpdateSupplierItemInput,
} from './supplier.schema.ts';
import {
    assertSupplierDeactivation,
    assertSupplierItemDefinition,
    assertPreferredSupplierAvailable,
    supplierItemStatus,
} from './supplier.rules.ts';

type Reader = Pick<typeof db, 'select'>;
const supplierFields = {
    supplierId: suppliers.supplierId,
    name: suppliers.name,
    email: suppliers.email,
    isActive: suppliers.isActive,
    itemCount: sql<number>`(select count(*) from ${supplierItems} where ${supplierItems.supplierId}=${suppliers.supplierId})::integer`,
    activeItemCount: sql<number>`(select count(*) from ${supplierItems} where ${supplierItems.supplierId}=${suppliers.supplierId} and ${supplierItems.isActive})::integer`,
    preferredItemCount: sql<number>`(select count(*) from ${supplierItems} where ${supplierItems.supplierId}=${suppliers.supplierId} and ${supplierItems.isActive} and ${supplierItems.isPreferred})::integer`,
    hasOpenPurchaseOrders: sql<boolean>`exists(select 1 from ${purchaseOrders} where ${purchaseOrders.supplierId}=${suppliers.supplierId} and ${purchaseOrders.status} in ('Draft','Sent','Partially Received'))`,
    createdBy: suppliers.createdBy,
    createdAt: suppliers.createdAt,
    updatedBy: suppliers.updatedBy,
    updatedAt: suppliers.updatedAt,
};
const defaultUom = alias(uoms, 'supplier_default_uom');
const offerFields = {
    supplierItemId: supplierItems.supplierItemId,
    supplierId: supplierItems.supplierId,
    itemId: supplierItems.itemId,
    supplierItemCode: supplierItems.supplierItemCode,
    defaultUomId: supplierItems.defaultUomId,
    defaultPrice: supplierItems.defaultPrice,
    leadTimeDays: supplierItems.leadTimeDays,
    isPreferred: supplierItems.isPreferred,
    isActive: supplierItems.isActive,
    itemSku: items.sku,
    itemName: items.name,
    itemType: items.itemType,
    itemIsActive: items.isActive,
    primaryUomId: items.primaryUomId,
    primaryUomName: uoms.name,
    defaultUomName: defaultUom.name,
    uomClassId: uoms.uomClassId,
    createdBy: supplierItems.createdBy,
    createdAt: supplierItems.createdAt,
    updatedBy: supplierItems.updatedBy,
    updatedAt: supplierItems.updatedAt,
};
const offerQuery = (database: Reader) =>
    database
        .select(offerFields)
        .from(supplierItems)
        .innerJoin(items, eq(supplierItems.itemId, items.itemId))
        .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
        .leftJoin(defaultUom, eq(supplierItems.defaultUomId, defaultUom.uomId));

export async function listSuppliers() {
    return db
        .select(supplierFields)
        .from(suppliers)
        .orderBy(asc(suppliers.name), asc(suppliers.supplierId));
}
export async function getSupplier(
    id: number,
    database: Reader = db,
): Promise<Awaited<ReturnType<typeof listSuppliers>>[number] | null> {
    const [supplier] = await database
        .select(supplierFields)
        .from(suppliers)
        .where(eq(suppliers.supplierId, id))
        .limit(1);
    return supplier ?? null;
}
export async function getSupplierOptions() {
    const [itemOptions, units] = await Promise.all([
        db
            .select({
                itemId: items.itemId,
                sku: items.sku,
                name: items.name,
                itemType: items.itemType,
                primaryUomId: items.primaryUomId,
                primaryUomName: uoms.name,
                uomClassId: uoms.uomClassId,
                isActive: items.isActive,
            })
            .from(items)
            .innerJoin(uoms, eq(items.primaryUomId, uoms.uomId))
            .orderBy(asc(items.name), asc(items.sku)),
        db
            .select({ uomId: uoms.uomId, name: uoms.name, uomClassId: uoms.uomClassId })
            .from(uoms)
            .orderBy(asc(uoms.name)),
    ]);
    return { items: itemOptions, uoms: units };
}
export async function listSupplierItems(id: number) {
    if (!(await getSupplier(id))) return null;
    return offerQuery(db)
        .where(eq(supplierItems.supplierId, id))
        .orderBy(asc(items.name), asc(supplierItems.supplierItemId));
}
async function getSupplierItem(supplierId: number, offerId: number, database: Reader) {
    const [offer] = await offerQuery(database)
        .where(
            and(
                eq(supplierItems.supplierId, supplierId),
                eq(supplierItems.supplierItemId, offerId),
            ),
        )
        .limit(1);
    return offer ?? null;
}
export async function createSupplier(input: CreateSupplierInput, actorId: number) {
    return db.transaction(async (tx) => {
        const [created] = await tx
            .insert(suppliers)
            .values({ ...input, createdBy: actorId, updatedBy: actorId })
            .returning({ id: suppliers.supplierId });
        if (!created) throw new Error('The supplier could not be created.');
        const saved = await getSupplier(created.id, tx);
        if (!saved) throw new Error('The saved supplier could not be loaded.');
        return saved;
    });
}
export async function updateSupplier(id: number, input: UpdateSupplierInput, actorId: number) {
    return db.transaction(async (tx) => {
        const [locked] = await tx
            .select({ id: suppliers.supplierId })
            .from(suppliers)
            .where(eq(suppliers.supplierId, id))
            .for('update');
        if (!locked) return null;
        const current = await getSupplier(id, tx);
        if (!current) return null;
        assertSupplierDeactivation(
            current.hasOpenPurchaseOrders,
            input.isActive ?? current.isActive,
        );
        if (input.isActive === false) {
            await tx
                .update(supplierItems)
                .set({
                    isActive: false,
                    isPreferred: false,
                    updatedBy: actorId,
                    updatedAt: new Date(),
                })
                .where(eq(supplierItems.supplierId, id));
        }
        await tx
            .update(suppliers)
            .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
            .where(eq(suppliers.supplierId, id));
        return getSupplier(id, tx);
    });
}

async function lockSupplier(database: Reader, id: number) {
    const [supplier] = await database
        .select({ isActive: suppliers.isActive })
        .from(suppliers)
        .where(eq(suppliers.supplierId, id))
        .for('update');
    return supplier ?? null;
}
async function lockItemDefinition(database: Reader, itemId: number, defaultUomId: number | null) {
    // Serialize item identity edits and competing preferred offers for this item.
    const [item] = await database
        .select({
            isActive: items.isActive,
            itemType: items.itemType,
            primaryUomId: items.primaryUomId,
        })
        .from(items)
        .where(eq(items.itemId, itemId))
        .for('update');
    if (!item) throw new AppError(400, 'Select an existing item.');
    const unitIds = [...new Set([item.primaryUomId, defaultUomId ?? item.primaryUomId])].sort(
        (a, b) => a - b,
    );
    const units = [];
    for (const unitId of unitIds) {
        const [unit] = await database
            .select({ uomId: uoms.uomId, uomClassId: uoms.uomClassId })
            .from(uoms)
            .where(eq(uoms.uomId, unitId))
            .for('share');
        if (!unit) throw new AppError(400, 'Select an existing unit of measure.');
        units.push(unit);
    }
    return {
        ...item,
        primaryClassId: units.find((unit) => unit.uomId === item.primaryUomId)!.uomClassId,
        defaultClassId: units.find((unit) => unit.uomId === (defaultUomId ?? item.primaryUomId))!
            .uomClassId,
    };
}
async function requirePreferredAvailable(
    database: Reader,
    itemId: number,
    excludedOfferId?: number,
) {
    const [other] = await database
        .select({ id: supplierItems.supplierItemId })
        .from(supplierItems)
        .where(
            and(
                eq(supplierItems.itemId, itemId),
                eq(supplierItems.isActive, true),
                eq(supplierItems.isPreferred, true),
                excludedOfferId === undefined
                    ? undefined
                    : ne(supplierItems.supplierItemId, excludedOfferId),
            ),
        )
        .limit(1);
    assertPreferredSupplierAvailable(Boolean(other));
}
export async function createSupplierItem(
    id: number,
    input: CreateSupplierItemInput,
    actorId: number,
) {
    return db.transaction(async (tx) => {
        const supplier = await lockSupplier(tx, id);
        if (!supplier) return null;
        if (!supplier.isActive)
            throw new AppError(409, 'Reactivate the supplier before adding item offers.');
        const item = await lockItemDefinition(tx, input.itemId, input.defaultUomId ?? null);
        if (!item.isActive || item.itemType === 'Finished Good')
            throw new AppError(400, 'Select an active raw material, packaging material, or label.');
        const status = supplierItemStatus({ isActive: true, isPreferred: false }, input);
        assertSupplierItemDefinition({
            supplierActive: supplier.isActive,
            itemActive: item.isActive,
            itemType: item.itemType,
            itemUomClassId: item.primaryClassId,
            defaultUomClassId: item.defaultClassId,
            isActive: status.isActive,
        });
        const [duplicate] = await tx
            .select({ id: supplierItems.supplierItemId })
            .from(supplierItems)
            .where(and(eq(supplierItems.supplierId, id), eq(supplierItems.itemId, input.itemId)))
            .limit(1);
        if (duplicate)
            throw new AppError(
                409,
                'This item is already linked to this supplier. Edit or reactivate the existing offer.',
            );
        if (status.isPreferred) await requirePreferredAvailable(tx, input.itemId);
        const [created] = await tx
            .insert(supplierItems)
            .values({ ...input, ...status, supplierId: id, createdBy: actorId, updatedBy: actorId })
            .returning({ id: supplierItems.supplierItemId });
        if (!created) throw new Error('The supplier item could not be created.');
        const saved = await getSupplierItem(id, created.id, tx);
        if (!saved) throw new Error('The saved supplier item could not be loaded.');
        return saved;
    });
}
export async function updateSupplierItem(
    id: number,
    offerId: number,
    input: UpdateSupplierItemInput,
    actorId: number,
) {
    return db.transaction(async (tx) => {
        const supplier = await lockSupplier(tx, id);
        if (!supplier) return null;
        const current = await getSupplierItem(id, offerId, tx);
        if (!current) return null;
        const defaultUomId =
            input.defaultUomId === undefined ? current.defaultUomId : input.defaultUomId;
        const item = await lockItemDefinition(tx, current.itemId, defaultUomId);
        const status = supplierItemStatus(current, input);
        assertSupplierItemDefinition({
            supplierActive: supplier.isActive,
            itemActive: item.isActive,
            itemType: item.itemType,
            itemUomClassId: item.primaryClassId,
            defaultUomClassId: item.defaultClassId,
            isActive: status.isActive,
        });
        if (status.isPreferred) await requirePreferredAvailable(tx, current.itemId, offerId);
        await tx
            .update(supplierItems)
            .set({ ...input, ...status, updatedBy: actorId, updatedAt: new Date() })
            .where(
                and(eq(supplierItems.supplierId, id), eq(supplierItems.supplierItemId, offerId)),
            );
        return getSupplierItem(id, offerId, tx);
    });
}
