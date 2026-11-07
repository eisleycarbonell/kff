import { sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
    roles,
    brands,
    users,
    uomClasses,
    uoms,
    items,
    locations,
    customers,
    suppliers,
    supplierItems,
    scrapReasonCodes,
    billOfMaterials,
    itemPackaging,
    purchaseOrders,
    purchaseOrderLines,
    lots,
    packingOrders,
    packingOrderMaterials,
    inventoryReservations,
    inventoryTransactions,
    inventoryStock,
    stockTransfers,
    stockTransferLines,
    salesOrders,
    salesOrderLines,
    deliveryOrders,
    deliveryOrderLines,
    type NewInventoryTransaction,
    type Item,
    type Lot,
} from './schema.ts';
import { hashPassword } from '../utils/hashHandler.ts';
import {
    quantityString,
    quantityUnits,
} from '../modules/inventory-stocks/inventory-stock.rules.ts';
import { sampleProducts, samplePackaging } from './sample-catalog.ts';
import { sampleRoles, sampleAccounts, SAMPLE_ADMIN_EMAIL } from './sample-accounts.ts';
import {
    requireTestDataOptIn,
    lockTestDatabase,
    isApplicationDatabaseEmpty,
    type Database,
    type Transaction,
} from './test-database.ts';

export const SAMPLE_PASSWORD = 'KffDemo123!';
export { SAMPLE_ADMIN_EMAIL } from './sample-accounts.ts';

type SeedOptions = {
    database?: Database;
    schemaName?: string;
    now?: Date;
    environment?: NodeJS.ProcessEnv;
};

/** One atomic, repeatable import. Existing application data is never overwritten. */
export async function seedSampleData({
    database = db,
    schemaName = 'public',
    now = new Date(),
    environment = process.env,
}: SeedOptions = {}) {
    requireTestDataOptIn(environment);
    const passwordHash = await hashPassword(SAMPLE_PASSWORD);
    return database.transaction(async (transaction) => {
        await lockTestDatabase(transaction, schemaName);
        await transaction.execute(sql`set local lock_timeout = '10s'`);
        if (!(await isApplicationDatabaseEmpty(transaction, schemaName))) {
            return { status: 'skipped-existing' as const };
        }
        await populateSampleData(transaction, now, passwordHash);
        return { status: 'seeded' as const };
    });
}

async function populateSampleData(tx: Transaction, now: Date, passwordHash: string) {
    const day = (offset: number) =>
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
    const date = (offset: number) => day(offset).toISOString().slice(0, 10);
    const roleRows = await tx
        .insert(roles)
        .values(sampleRoles.map((role) => ({ ...role })))
        .returning();
    const roleIds = new Map(roleRows.map((role) => [role.name, role.roleId]));
    const userRows = await tx
        .insert(users)
        .values(
            sampleAccounts.map(({ roleName, ...account }) => {
                const roleId = roleIds.get(roleName);
                if (!roleId) throw new Error('A sample account role was not created.');
                return { ...account, roleId, passwordHash, isEmailVerified: true };
            }),
        )
        .returning();
    const admin = userRows.find((user) => user.email === SAMPLE_ADMIN_EMAIL);
    if (!admin) throw new Error('The sample administrator was not created.');
    const actor = admin.userId;
    const audit = { createdBy: actor, updatedBy: actor, createdAt: day(-40), updatedAt: day(-1) };
    await tx.update(roles).set({ createdBy: actor, updatedBy: actor });
    await tx.update(users).set({ createdBy: actor, updatedBy: actor });
    const brandRows = await tx
        .insert(brands)
        .values([
            {
                code: 'SAMPLE-KFF',
                name: 'Sample KFF Spices',
                description: 'Spice and seasoning products.',
                ...audit,
            },
            {
                code: 'SAMPLE-PANTRY',
                name: 'Sample KFF Pantry',
                description: 'Pantry and preserved food products.',
                ...audit,
            },
            {
                code: 'SAMPLE-ARCHIVE',
                name: 'Sample Archived Brand',
                description: 'Inactive brand retained for reference.',
                isActive: false,
                ...audit,
            },
        ])
        .returning();
    const brandFor = (code: string) =>
        brandRows.find(
            (row) =>
                row.code ===
                (['NATA', 'KAONG', 'NOODLES'].includes(code) ? 'SAMPLE-PANTRY' : 'SAMPLE-KFF'),
        )!.brandId;
    const [mass, count] = await tx
        .insert(uomClasses)
        .values([
            { name: 'Mass', ...audit },
            { name: 'Count', ...audit },
        ])
        .returning();
    const [kg, , pc, box] = await tx
        .insert(uoms)
        .values([
            {
                name: 'kg',
                uomClassId: mass!.uomClassId,
                factorToBase: '1.00000000',
                isBase: true,
                ...audit,
            },
            { name: 'g', uomClassId: mass!.uomClassId, factorToBase: '0.00100000', ...audit },
            {
                name: 'pc',
                uomClassId: count!.uomClassId,
                factorToBase: '1.00000000',
                isBase: true,
                ...audit,
            },
            { name: 'box', uomClassId: count!.uomClassId, factorToBase: '12.00000000', ...audit },
        ])
        .returning();
    const locationRows = await tx
        .insert(locations)
        .values([
            {
                code: 'WH-RM',
                name: 'Raw Ingredients and Packaging Warehouse',
                locationType: 'Warehouse',
                ...audit,
            },
            {
                code: 'WH-FG',
                name: 'Finished Goods Warehouse',
                locationType: 'Warehouse',
                ...audit,
            },
            { code: 'PACK-01', name: 'Packing Area', locationType: 'Packing', ...audit },
            { code: 'BR-MNL', name: 'Manila Branch', locationType: 'Branch', ...audit },
            { code: 'STORE-QC', name: 'Quezon City Store', locationType: 'Store', ...audit },
            { code: 'TRANSIT', name: 'Goods In Transit', locationType: 'In Transit', ...audit },
            { code: 'QC-HOLD', name: 'Quality Hold', locationType: 'Quarantine', ...audit },
            { code: 'SCRAP', name: 'Scrap Area', locationType: 'Scrap', ...audit },
            {
                code: 'WH-OLD',
                name: 'Inactive Warehouse',
                locationType: 'Warehouse',
                isActive: false,
                ...audit,
            },
        ])
        .returning();
    const location = (code: string) => locationRows.find((row) => row.code === code)!.locationId;
    const [restaurant, grocery] = await tx
        .insert(customers)
        .values([
            {
                name: 'Sample Kusina Restaurant',
                contactName: 'Liza Santos',
                email: 'kusina@example.test',
                address: 'Manila',
                ...audit,
            },
            {
                name: 'Sample Neighborhood Grocery',
                contactName: 'Ben Cruz',
                email: 'grocery@example.test',
                address: 'Quezon City',
                ...audit,
            },
        ])
        .returning();
    const [spiceSupplier, pantrySupplier, packagingSupplier] = await tx
        .insert(suppliers)
        .values([
            { name: 'Sample Philippine Spice Trading', email: 'spices@example.test', ...audit },
            { name: 'Sample Pantry Ingredients', email: 'pantry@example.test', ...audit },
            { name: 'Sample Food Packaging Supplies', email: 'packaging@example.test', ...audit },
        ])
        .returning();
    const [countReason, expiredReason] = await tx
        .insert(scrapReasonCodes)
        .values([
            {
                codeName: 'Sample Physical Count',
                category: 'Inventory Adjustment',
                description: 'Test counted-stock correction',
                ...audit,
            },
            {
                codeName: 'Sample Expired Stock',
                category: 'Expired',
                description: 'Test expired-stock disposal',
                ...audit,
            },
        ])
        .returning();

    const rawItems = new Map<string, Item>();
    const finishedItems = new Map<string, Item>();
    const componentItems = new Map<string, Item>();
    const purchasedLots = new Map<number, Lot>();
    const ledger: NewInventoryTransaction[] = [];
    const balances = new Map<
        string,
        { itemId: number; lotId: number; locationId: number; units: bigint; lastUpdated: Date }
    >();
    const post = (entry: Omit<NewInventoryTransaction, 'authorizedByUserId'>) => {
        const key = `${entry.lotId}:${entry.locationId}`;
        const balance = balances.get(key) ?? {
            itemId: entry.itemId,
            lotId: entry.lotId,
            locationId: entry.locationId,
            units: 0n,
            lastUpdated: entry.createdAt ?? now,
        };
        balance.units += quantityUnits(entry.qtyChange);
        if (balance.units < 0n) throw new Error('Sample movement would create negative stock.');
        balance.lastUpdated = entry.createdAt ?? now;
        balances.set(key, balance);
        ledger.push({ ...entry, authorizedByUserId: actor });
    };
    const [spicePo, pantryPo, packagingPo, qcPo] = await tx
        .insert(purchaseOrders)
        .values([
            {
                poNumber: 'SAMPLE-PO-SPICES',
                supplierId: spiceSupplier!.supplierId,
                status: 'Completed',
                orderDate: day(-35),
                expectedDeliveryDate: date(-30),
                ...audit,
            },
            {
                poNumber: 'SAMPLE-PO-PANTRY',
                supplierId: pantrySupplier!.supplierId,
                status: 'Completed',
                orderDate: day(-35),
                expectedDeliveryDate: date(-30),
                ...audit,
            },
            {
                poNumber: 'SAMPLE-PO-PACKAGING',
                supplierId: packagingSupplier!.supplierId,
                status: 'Completed',
                orderDate: day(-35),
                expectedDeliveryDate: date(-30),
                ...audit,
            },
            {
                poNumber: 'SAMPLE-PO-QC',
                supplierId: spiceSupplier!.supplierId,
                status: 'Completed',
                orderDate: day(-20),
                expectedDeliveryDate: date(-18),
                ...audit,
            },
        ])
        .returning();

    const receive = async (
        item: Item,
        poId: number,
        supplierId: number,
        quantity: string,
        code: string,
        options: {
            expiry?: number;
            qc?: Lot['qcStatus'];
            location?: string;
            receivedDay?: number;
            manufactureDay?: number;
            offer?: boolean;
        } = {},
    ) => {
        const receivedDay = options.receivedDay ?? -30;
        if (options.offer !== false)
            await tx.insert(supplierItems).values({
                supplierId,
                itemId: item.itemId,
                defaultUomId: item.primaryUomId,
                defaultPrice: item.unitCost,
                isPreferred: true,
                leadTimeDays: 7,
                supplierItemCode: code,
                ...audit,
            });
        const [line] = await tx
            .insert(purchaseOrderLines)
            .values({
                poId,
                itemId: item.itemId,
                uomId: item.primaryUomId,
                qtyOrdered: quantity,
                qtyReceived: quantity,
                unitPrice: item.unitCost,
                ...audit,
            })
            .returning();
        const [lot] = await tx
            .insert(lots)
            .values({
                lotNumber: `SAMPLE-LOT-${code}`,
                supplierLotNumber: `SUP-${code}`,
                itemId: item.itemId,
                poLineId: line!.poLineId,
                manufactureDate:
                    options.expiry === undefined ? null : date(options.manufactureDay ?? -40),
                expirationDate: options.expiry === undefined ? null : date(options.expiry),
                qcStatus: options.qc ?? 'Approved',
                unitCost: item.unitCost,
                ...audit,
            })
            .returning();
        post({
            itemId: item.itemId,
            lotId: lot!.lotId,
            locationId: location(options.location ?? 'WH-RM'),
            qtyChange: quantity,
            transactionType: 'Receive',
            poLineId: line!.poLineId,
            referenceId: 'SAMPLE-RECEIVING',
            createdAt: day(receivedDay),
        });
        return lot!;
    };

    for (const packaging of samplePackaging) {
        const [item] = await tx
            .insert(items)
            .values({
                sku: `SAMPLE-PKG-${packaging.code}`,
                name: packaging.name,
                itemType: 'Packaging - Hardware',
                primaryUomId: pc!.uomId,
                unitCost: packaging.cost,
                ...audit,
            })
            .returning();
        componentItems.set(packaging.code, item!);
        purchasedLots.set(
            item!.itemId,
            await receive(
                item!,
                packagingPo!.poId,
                packagingSupplier!.supplierId,
                '5000.0000',
                packaging.code,
            ),
        );
    }
    for (const product of sampleProducts) {
        const [raw, label] = await tx
            .insert(items)
            .values([
                {
                    sku: `SAMPLE-RM-${product.code}`,
                    name: `${product.name} Bulk`,
                    itemType: 'Raw Material - Bulk',
                    primaryUomId: kg!.uomId,
                    unitCost: product.cost,
                    shelfLifeDays: product.shelfLife,
                    requiresQc: true,
                    ...audit,
                },
                {
                    sku: `SAMPLE-LBL-${product.code}`,
                    name: `${product.name} ${product.grams}g Label`,
                    itemType: 'Packaging - Label',
                    primaryUomId: pc!.uomId,
                    unitCost: '0.3500',
                    ...audit,
                },
            ])
            .returning();
        rawItems.set(product.code, raw!);
        componentItems.set(`LABEL-${product.code}`, label!);
        const pantry = ['NATA', 'KAONG', 'NOODLES'].includes(product.code);
        purchasedLots.set(
            raw!.itemId,
            await receive(
                raw!,
                pantry ? pantryPo!.poId : spicePo!.poId,
                pantry ? pantrySupplier!.supplierId : spiceSupplier!.supplierId,
                product.received,
                product.code,
                { expiry: product.shelfLife - 40 },
            ),
        );
        purchasedLots.set(
            label!.itemId,
            await receive(
                label!,
                packagingPo!.poId,
                packagingSupplier!.supplierId,
                '2000.0000',
                `LBL-${product.code}`,
            ),
        );
        const perUnit = quantityString(BigInt(product.grams) * 10n);
        const packageItem = componentItems.get(product.pack)!;
        const seal = componentItems.get('SEAL')!;
        const cost = quantityString(
            (quantityUnits(perUnit) * quantityUnits(raw!.unitCost)) / 10_000n +
                quantityUnits(packageItem.unitCost) +
                quantityUnits(label!.unitCost) +
                quantityUnits(seal.unitCost),
        );
        const [finished] = await tx
            .insert(items)
            .values({
                sku: `SAMPLE-FG-${product.code}-${product.grams}`,
                brandId: brandFor(product.code),
                name: `${product.name} ${product.grams}g`,
                itemType: 'Finished Good',
                primaryUomId: pc!.uomId,
                netWeightG: String(product.grams),
                shelfLifeDays: product.shelfLife,
                unitCost: cost,
                ...audit,
            })
            .returning();
        finishedItems.set(product.code, finished!);
        await tx.insert(billOfMaterials).values([
            {
                parentItemId: finished!.itemId,
                componentItemId: raw!.itemId,
                quantity: perUnit,
                uomId: kg!.uomId,
                ...audit,
            },
            ...[packageItem, label!, seal].map((component) => ({
                parentItemId: finished!.itemId,
                componentItemId: component.itemId,
                quantity: '1.000000',
                uomId: pc!.uomId,
                ...audit,
            })),
        ]);
        await tx
            .insert(itemPackaging)
            .values({ itemId: finished!.itemId, uomId: box!.uomId, baseQty: '12.0000', ...audit });
    }

    const packedLots = new Map<string, Lot>();
    const pack = async (
        code: string,
        output: number,
        status: 'Completed' | 'Planned' | 'In Progress' | 'Draft',
    ) => {
        const product = sampleProducts.find((row) => row.code === code)!;
        const raw = rawItems.get(code)!;
        const finished = finishedItems.get(code)!;
        const completed = status === 'Completed';
        const [order] = await tx
            .insert(packingOrders)
            .values({
                packingOrderNumber: `SAMPLE-PK-${code}-${status === 'Completed' ? 'DONE' : 'OPEN'}`,
                itemId: finished.itemId,
                targetQty: String(output),
                actualQty: completed ? String(output) : '0',
                status,
                sourceLocationId: location('WH-RM'),
                destinationLocationId: location('WH-FG'),
                scheduledDate: date(completed ? -12 : 1),
                startedAt: completed ? day(-12) : status === 'In Progress' ? day(-1) : null,
                completedAt: completed ? day(-11) : null,
                notes: 'Testing only: saved material snapshot.',
                ...audit,
            })
            .returning();
        const components = [
            { item: raw, perUnit: quantityString(BigInt(product.grams) * 10n) },
            ...[
                componentItems.get(product.pack)!,
                componentItems.get(`LABEL-${code}`)!,
                componentItems.get('SEAL')!,
            ].map((item) => ({ item, perUnit: '1.0000' })),
        ];
        for (const component of components) {
            const required = quantityString(quantityUnits(component.perUnit) * BigInt(output));
            const [material] = await tx
                .insert(packingOrderMaterials)
                .values({
                    packingOrderId: order!.packingOrderId,
                    itemId: component.item.itemId,
                    uomId: component.item.primaryUomId,
                    requiredQty: required,
                    consumedQty: completed ? required : '0',
                    ...audit,
                })
                .returning();
            const lot = purchasedLots.get(component.item.itemId)!;
            if (status !== 'Draft')
                await tx.insert(inventoryReservations).values({
                    packingOrderMaterialId: material!.packingOrderMaterialId,
                    itemId: component.item.itemId,
                    lotId: lot.lotId,
                    locationId: location('WH-RM'),
                    qtyReserved: required,
                    qtyConsumed: completed ? required : '0',
                    releasedAt: completed ? day(-11) : null,
                    ...audit,
                });
            if (completed)
                post({
                    itemId: component.item.itemId,
                    lotId: lot.lotId,
                    locationId: location('WH-RM'),
                    qtyChange: quantityString(-quantityUnits(required)),
                    transactionType: 'Consume',
                    packingOrderId: order!.packingOrderId,
                    referenceId: order!.packingOrderNumber,
                    createdAt: day(-11),
                });
        }
        if (completed) {
            const [lot] = await tx
                .insert(lots)
                .values({
                    lotNumber: `SAMPLE-FG-${code}`,
                    itemId: finished.itemId,
                    packingOrderId: order!.packingOrderId,
                    manufactureDate: date(-11),
                    expirationDate: date(product.shelfLife - 40),
                    qcStatus: 'Approved',
                    unitCost: finished.unitCost,
                    ...audit,
                })
                .returning();
            packedLots.set(code, lot!);
            post({
                itemId: finished.itemId,
                lotId: lot!.lotId,
                locationId: location('WH-FG'),
                qtyChange: String(output),
                transactionType: 'Produce',
                packingOrderId: order!.packingOrderId,
                referenceId: order!.packingOrderNumber,
                createdAt: day(-11),
            });
        }
    };
    for (const product of sampleProducts) await pack(product.code, product.output, 'Completed');
    await pack('GARLIC', 100, 'Planned');
    await pack('PEPPER', 50, 'In Progress');
    await pack('NOODLES', 80, 'Draft');

    for (const extra of [
        {
            code: 'GARLIC',
            quantity: '12.0000',
            suffix: 'QC',
            expiry: 180,
            qc: 'Quarantine' as const,
            location: 'QC-HOLD',
        },
        {
            code: 'CHILI',
            quantity: '3.0000',
            suffix: 'EXPIRED',
            expiry: -1,
            qc: 'Expired' as const,
            location: 'QC-HOLD',
        },
        {
            code: 'LAUREL',
            quantity: '2.0000',
            suffix: 'NEAR-EXPIRY',
            expiry: 10,
            qc: 'Approved' as const,
            location: 'WH-RM',
        },
        {
            code: 'CAYENNE',
            quantity: '2.0000',
            suffix: 'REJECTED',
            expiry: 180,
            qc: 'Rejected' as const,
            location: 'QC-HOLD',
        },
    ])
        await receive(
            rawItems.get(extra.code)!,
            qcPo!.poId,
            spiceSupplier!.supplierId,
            extra.quantity,
            `${extra.code}-${extra.suffix}`,
            {
                expiry: extra.expiry,
                qc: extra.qc,
                location: extra.location,
                receivedDay: -18,
                manufactureDay: -90,
                offer: false,
            },
        );

    const garlic = rawItems.get('GARLIC')!;
    post({
        itemId: garlic.itemId,
        lotId: purchasedLots.get(garlic.itemId)!.lotId,
        locationId: location('WH-RM'),
        qtyChange: '-0.5000',
        transactionType: 'Adjustment',
        reasonId: countReason!.reasonId,
        referenceId: 'SAMPLE-COUNT-001',
        createdAt: day(-2),
    });
    const [expiredLot] = await tx
        .select()
        .from(lots)
        .where(sql`${lots.lotNumber} = 'SAMPLE-LOT-CHILI-EXPIRED'`);
    post({
        itemId: expiredLot!.itemId,
        lotId: expiredLot!.lotId,
        locationId: location('QC-HOLD'),
        qtyChange: '-0.2500',
        transactionType: 'Scrap',
        reasonId: expiredReason!.reasonId,
        referenceId: 'SAMPLE-SCRAP-001',
        createdAt: day(0),
    });

    for (const transfer of [
        {
            code: 'PEPPER',
            qty: 40,
            received: 40,
            destination: 'BR-MNL',
            status: 'Completed' as const,
        },
        {
            code: 'GARLIC',
            qty: 60,
            received: 0,
            destination: 'STORE-QC',
            status: 'In Transit' as const,
        },
        {
            code: 'CAYENNE',
            qty: 40,
            received: 20,
            destination: 'BR-MNL',
            status: 'In Transit' as const,
        },
        { code: 'NATA', qty: 15, received: 0, destination: 'STORE-QC', status: 'Draft' as const },
    ]) {
        const lot = packedLots.get(transfer.code)!;
        const shipped = transfer.status === 'Draft' ? 0 : transfer.qty;
        const [order] = await tx
            .insert(stockTransfers)
            .values({
                transferNumber: `SAMPLE-TR-${transfer.code}`,
                sourceLocationId: location('WH-FG'),
                destinationLocationId: location(transfer.destination),
                status: transfer.status,
                requestedAt: day(-8),
                dispatchedAt: shipped ? day(-7) : null,
                receivedAt: transfer.status === 'Completed' ? day(-5) : null,
                notes: 'Testing only: dispatch through In Transit.',
                ...audit,
            })
            .returning();
        const [line] = await tx
            .insert(stockTransferLines)
            .values({
                transferId: order!.transferId,
                itemId: lot.itemId,
                lotId: lot.lotId,
                qtyRequested: String(transfer.qty),
                qtyShipped: String(shipped),
                qtyReceived: String(transfer.received),
                ...audit,
            })
            .returning();
        const move = (from: string, to: string, quantity: number, offset: number) => {
            const entry = {
                itemId: lot.itemId,
                lotId: lot.lotId,
                transactionType: 'Transfer' as const,
                transferLineId: line!.transferLineId,
                referenceId: order!.transferNumber,
                createdAt: day(offset),
            };
            post({ ...entry, locationId: location(from), qtyChange: String(-quantity) });
            post({ ...entry, locationId: location(to), qtyChange: String(quantity) });
        };
        if (shipped) move('WH-FG', 'TRANSIT', shipped, -7);
        if (transfer.received) move('TRANSIT', transfer.destination, transfer.received, -5);
    }

    type ProductCode = (typeof sampleProducts)[number]['code'];
    const sale = async (
        number: string,
        status: typeof salesOrders.$inferSelect.status,
        customerId: number,
        products: { code: ProductCode; quantity: number; price: string }[],
        shipments: {
            number: string;
            status: typeof deliveryOrders.$inferSelect.status;
            products: { code: ProductCode; quantity: number }[];
        }[] = [],
    ) => {
        const fulfilled = new Map<ProductCode, bigint>();
        for (const shipment of shipments) {
            if (shipment.status !== 'Completed') continue;
            for (const product of shipment.products)
                fulfilled.set(
                    product.code,
                    (fulfilled.get(product.code) ?? 0n) + BigInt(product.quantity) * 10_000n,
                );
        }
        const [order] = await tx
            .insert(salesOrders)
            .values({
                salesOrderNumber: number,
                customerId,
                status,
                orderDate: date(-6),
                requestedDeliveryDate: date(status === 'Completed' ? -2 : 2),
                notes: 'Testing only: customer order and lot-level delivery examples.',
                ...audit,
                createdAt: day(-6),
            })
            .returning();
        const linesByCode = new Map<ProductCode, typeof salesOrderLines.$inferSelect>();
        for (const product of products) {
            const item = finishedItems.get(product.code)!;
            const [line] = await tx
                .insert(salesOrderLines)
                .values({
                    salesOrderId: order!.salesOrderId,
                    itemId: item.itemId,
                    uomId: item.primaryUomId,
                    qtyOrdered: quantityString(BigInt(product.quantity) * 10_000n),
                    qtyDelivered: quantityString(fulfilled.get(product.code) ?? 0n),
                    unitPrice: product.price,
                    ...audit,
                    createdAt: day(-6),
                })
                .returning();
            linesByCode.set(product.code, line!);
        }
        for (const shipment of shipments) {
            const dispatched = ['In Transit', 'Completed'].includes(shipment.status);
            const completed = shipment.status === 'Completed';
            const [delivery] = await tx
                .insert(deliveryOrders)
                .values({
                    deliveryOrderNumber: shipment.number,
                    salesOrderId: order!.salesOrderId,
                    sourceLocationId: location('WH-FG'),
                    transitLocationId: dispatched ? location('TRANSIT') : null,
                    status: shipment.status,
                    deliveryDate: date(completed ? -2 : shipment.status === 'In Transit' ? 1 : 2),
                    dispatchedAt: dispatched ? day(-3) : null,
                    completedAt: completed ? day(-2) : null,
                    notes: 'Testing only: drafts allocate demand; dispatch protects stock in transit.',
                    ...audit,
                    createdAt: day(-4),
                })
                .returning();
            for (const product of shipment.products) {
                const salesLine = linesByCode.get(product.code)!;
                const lot = packedLots.get(product.code)!;
                const amount = BigInt(product.quantity) * 10_000n;
                const quantity = quantityString(amount);
                const [line] = await tx
                    .insert(deliveryOrderLines)
                    .values({
                        deliveryOrderId: delivery!.deliveryOrderId,
                        salesOrderLineId: salesLine.salesOrderLineId,
                        itemId: salesLine.itemId,
                        lotId: lot.lotId,
                        qtyDelivered: quantity,
                        ...audit,
                        createdAt: day(-4),
                    })
                    .returning();
                if (!dispatched) continue;
                const entry = {
                    itemId: salesLine.itemId,
                    lotId: lot.lotId,
                    deliveryOrderLineId: line!.deliveryOrderLineId,
                    referenceId: shipment.number,
                };
                post({
                    ...entry,
                    locationId: location('WH-FG'),
                    qtyChange: quantityString(-amount),
                    transactionType: 'Transfer',
                    createdAt: day(-3),
                });
                post({
                    ...entry,
                    locationId: location('TRANSIT'),
                    qtyChange: quantity,
                    transactionType: 'Transfer',
                    createdAt: day(-3),
                });
                await tx.insert(inventoryReservations).values({
                    packingOrderMaterialId: null,
                    deliveryOrderLineId: line!.deliveryOrderLineId,
                    itemId: salesLine.itemId,
                    lotId: lot.lotId,
                    locationId: location('TRANSIT'),
                    qtyReserved: quantity,
                    qtyConsumed: completed ? quantity : '0.0000',
                    releasedAt: completed ? day(-2) : null,
                    ...audit,
                    createdAt: day(-3),
                    updatedAt: day(completed ? -2 : -3),
                });
                if (completed)
                    post({
                        ...entry,
                        locationId: location('TRANSIT'),
                        qtyChange: quantityString(-amount),
                        transactionType: 'Sale',
                        createdAt: day(-2),
                    });
            }
        }
    };
    await sale('SAMPLE-SO-DRAFT', 'Draft', restaurant!.customerId, [
        { code: 'GARLIC', quantity: 24, price: '25.0000' },
        { code: 'PEPPER', quantity: 12, price: '45.0000' },
    ]);
    await sale(
        'SAMPLE-SO-CONFIRMED',
        'Confirmed',
        grocery!.customerId,
        [
            { code: 'GARLIC', quantity: 80, price: '25.0000' },
            { code: 'CHILI', quantity: 40, price: '40.0000' },
        ],
        [
            {
                number: 'SAMPLE-DO-DRAFT',
                status: 'Draft',
                products: [
                    { code: 'GARLIC', quantity: 20 },
                    { code: 'CHILI', quantity: 10 },
                ],
            },
            {
                number: 'SAMPLE-DO-TRANSIT',
                status: 'In Transit',
                products: [{ code: 'GARLIC', quantity: 20 }],
            },
        ],
    );
    await sale(
        'SAMPLE-SO-PARTIAL',
        'Partially Delivered',
        restaurant!.customerId,
        [
            { code: 'PEPPER', quantity: 30, price: '45.0000' },
            { code: 'NATA', quantity: 24, price: '50.0000' },
        ],
        [
            {
                number: 'SAMPLE-DO-PARTIAL-COMPLETED',
                status: 'Completed',
                products: [
                    { code: 'PEPPER', quantity: 12 },
                    { code: 'NATA', quantity: 12 },
                ],
            },
            {
                number: 'SAMPLE-DO-PARTIAL-DRAFT',
                status: 'Draft',
                products: [
                    { code: 'PEPPER', quantity: 6 },
                    { code: 'NATA', quantity: 6 },
                ],
            },
        ],
    );
    await sale(
        'SAMPLE-SO-COMPLETED',
        'Completed',
        grocery!.customerId,
        [
            { code: 'CAYENNE', quantity: 10, price: '30.0000' },
            { code: 'KAONG', quantity: 12, price: '55.0000' },
        ],
        [
            {
                number: 'SAMPLE-DO-COMPLETED',
                status: 'Completed',
                products: [
                    { code: 'CAYENNE', quantity: 10 },
                    { code: 'KAONG', quantity: 12 },
                ],
            },
        ],
    );
    await sale(
        'SAMPLE-SO-CANCELLED',
        'Cancelled',
        restaurant!.customerId,
        [{ code: 'NOODLES', quantity: 15, price: '35.0000' }],
        [
            {
                number: 'SAMPLE-DO-CANCELLED',
                status: 'Cancelled',
                products: [{ code: 'NOODLES', quantity: 10 }],
            },
        ],
    );

    for (const pending of [
        { number: 'SAMPLE-PO-SENT', status: 'Sent' as const, received: '0', ordered: '50' },
        {
            number: 'SAMPLE-PO-PARTIAL',
            status: 'Partially Received' as const,
            received: '10',
            ordered: '30',
        },
        { number: 'SAMPLE-PO-DRAFT', status: 'Draft' as const, received: '0', ordered: '20' },
    ]) {
        const [order] = await tx
            .insert(purchaseOrders)
            .values({
                poNumber: pending.number,
                supplierId: spiceSupplier!.supplierId,
                status: pending.status,
                orderDate: day(-5),
                expectedDeliveryDate: date(5),
                ...audit,
            })
            .returning();
        const [line] = await tx
            .insert(purchaseOrderLines)
            .values({
                poId: order!.poId,
                itemId: garlic.itemId,
                uomId: kg!.uomId,
                qtyOrdered: pending.ordered,
                qtyReceived: pending.received,
                unitPrice: garlic.unitCost,
                ...audit,
            })
            .returning();
        if (pending.status === 'Partially Received') {
            const [lot] = await tx
                .insert(lots)
                .values({
                    lotNumber: 'SAMPLE-LOT-GARLIC-PARTIAL',
                    itemId: garlic.itemId,
                    poLineId: line!.poLineId,
                    manufactureDate: date(-15),
                    expirationDate: date(350),
                    qcStatus: 'Approved',
                    unitCost: garlic.unitCost,
                    ...audit,
                })
                .returning();
            post({
                itemId: garlic.itemId,
                lotId: lot!.lotId,
                locationId: location('WH-RM'),
                qtyChange: pending.received,
                transactionType: 'Receive',
                poLineId: line!.poLineId,
                referenceId: pending.number,
                createdAt: day(-3),
            });
        }
    }
    await tx.insert(inventoryTransactions).values(ledger);
    // Derive every final balance from the exact same movement entries.
    await tx.insert(inventoryStock).values(
        [...balances.values()].map(({ units, ...balance }) => ({
            ...balance,
            qtyOnHand: quantityString(units),
        })),
    );
}
