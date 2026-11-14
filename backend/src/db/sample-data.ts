import { sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
    roles,
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
    companySettings,
    reorderPolicies,
    reviewRequests,
    reviewEvents,
    countSessions,
    countObservations,
    inventoryDisposals,
    qcDecisions,
    formulaRevisions,
    formulaRevisionMaterials,
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
    const maker = userRows.find((u) => u.email === 'warehouse@spice.local')!.userId;
    await tx.insert(companySettings).values({
        settingsId: 1,
        companyName: 'Kusina Filipino Food Trading & Packing',
        currencyCode: 'PHP',
        defaultReorderLevel: '10.0000',
        expiryWarningDays: 30,
        createdBy: actor,
        updatedBy: actor,
    });
    const audit = { createdBy: actor, updatedBy: actor, createdAt: day(-40), updatedAt: day(-1) };
    await tx.update(roles).set({ createdBy: actor, updatedBy: actor });
    await tx.update(users).set({ createdBy: actor, updatedBy: actor });
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
                name: 'Lutong Bahay Restaurant',
                contactName: 'Liza Santos',
                email: 'kusina@kff-demo.example',
                address: 'Manila',
                ...audit,
            },
            {
                name: 'Barangay Fresh Mart',
                contactName: 'Ben Cruz',
                email: 'grocery@kff-demo.example',
                address: 'Quezon City',
                ...audit,
            },
        ])
        .returning();
    const [spiceSupplier, pantrySupplier, packagingSupplier] = await tx
        .insert(suppliers)
        .values([
            { name: 'Davao Harvest Spice Trading', email: 'spices@kff-demo.example', ...audit },
            { name: 'Laguna Pantry Ingredients', email: 'pantry@kff-demo.example', ...audit },
            { name: 'Metro Manila Food Packaging', email: 'packaging@kff-demo.example', ...audit },
        ])
        .returning();
    const [countReason, expiredReason] = await tx
        .insert(scrapReasonCodes)
        .values([
            {
                codeName: 'Physical Count Correction',
                category: 'Inventory Adjustment',
                description: 'Verified difference between physical count and recorded stock',
                ...audit,
            },
            {
                codeName: 'Expired Stock Disposal',
                category: 'Expired',
                description: 'Permanent removal of expired goods',
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
                poNumber: 'PO-2026-1001',
                supplierId: spiceSupplier!.supplierId,
                status: 'Completed',
                orderDate: day(-35),
                expectedDeliveryDate: date(-30),
                ...audit,
            },
            {
                poNumber: 'PO-2026-1002',
                supplierId: pantrySupplier!.supplierId,
                status: 'Completed',
                orderDate: day(-35),
                expectedDeliveryDate: date(-30),
                ...audit,
            },
            {
                poNumber: 'PO-2026-1003',
                supplierId: packagingSupplier!.supplierId,
                status: 'Completed',
                orderDate: day(-35),
                expectedDeliveryDate: date(-30),
                ...audit,
            },
            {
                poNumber: 'PO-2026-1004',
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
                lotNumber: `LOT-${code}`,
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
            referenceId: 'RECEIVING',
            createdAt: day(receivedDay),
        });
        return lot!;
    };

    for (const packaging of samplePackaging) {
        const [item] = await tx
            .insert(items)
            .values({
                sku: `PKG-${packaging.code}`,
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
                    sku: `RM-${product.code}`,
                    name: `${product.name} Bulk`,
                    itemType: 'Raw Material - Bulk',
                    primaryUomId: kg!.uomId,
                    unitCost: product.cost,
                    shelfLifeDays: product.shelfLife,
                    requiresQc: true,
                    ...audit,
                },
                {
                    sku: `LBL-${product.code}`,
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
                sku: `FG-${product.code}-${product.grams}`,
                labelItemId: label!.itemId,
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
        await tx.insert(itemPackaging).values({
            itemId: finished!.itemId,
            uomId: box!.uomId,
            baseQty: '12.0000',
            barcode: product.code + '-BOX',
            grossWeightG: String(product.grams * 12),
            ...audit,
        });
    }

    // Low Stock must include active catalog items that have never had a lot or receipt.
    await tx.insert(items).values({
        sku: 'RM-ONION',
        name: 'Onion Powder Bulk',
        itemType: 'Raw Material - Bulk',
        primaryUomId: kg!.uomId,
        unitCost: '0.0000',
        ...audit,
    });
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
                packingOrderNumber: `PK-${code}-${status === 'Completed' ? 'DONE' : 'OPEN'}`,
                itemId: finished.itemId,
                targetQty: String(output),
                actualQty: completed ? String(output) : '0',
                status,
                sourceLocationId: location('WH-RM'),
                destinationLocationId: location('WH-FG'),
                scheduledDate: date(completed ? -12 : 1),
                startedAt: completed ? day(-12) : status === 'In Progress' ? day(-1) : null,
                completedAt: completed ? day(-11) : null,
                notes: 'Retail replenishment run; materials use the saved packing formula.',
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
                    lotNumber: `FG-${code}`,
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
        referenceId: 'COUNT-001',
        createdAt: day(-2),
    });
    const [expiredLot] = await tx
        .select()
        .from(lots)
        .where(sql`${lots.lotNumber} = 'LOT-CHILI-EXPIRED'`);
    post({
        itemId: expiredLot!.itemId,
        lotId: expiredLot!.lotId,
        locationId: location('QC-HOLD'),
        qtyChange: '-0.2500',
        transactionType: 'Scrap',
        reasonId: expiredReason!.reasonId,
        referenceId: 'SCRAP-001',
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
                transferNumber: `TR-${transfer.code}`,
                sourceLocationId: location('WH-FG'),
                destinationLocationId: location(transfer.destination),
                status: transfer.status,
                requestedAt: day(-8),
                dispatchedAt: shipped ? day(-7) : null,
                receivedAt: transfer.status === 'Completed' ? day(-5) : null,
                notes: 'Branch replenishment; confirm received quantities after arrival.',
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
                customerPoNumber:
                    (customerId === restaurant!.customerId ? 'LB-PO-' : 'BFM-PO-') +
                    number.replace('SO-', ''),
                customerId,
                status,
                orderDate: date(-6),
                requestedDeliveryDate: date(status === 'Completed' ? -2 : 2),
                notes: 'Customer purchase order for retail packs; deliver against the confirmed order.',
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
                    notes: 'Deliver selected product lots to the customer delivery address.',
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
    await sale('SO-2026-0001', 'Draft', restaurant!.customerId, [
        { code: 'GARLIC', quantity: 1500, price: '25.0000' },
        { code: 'PEPPER', quantity: 1000, price: '45.0000' },
    ]);
    await sale(
        'SO-2026-0002',
        'Confirmed',
        grocery!.customerId,
        [
            { code: 'GARLIC', quantity: 80, price: '25.0000' },
            { code: 'CHILI', quantity: 40, price: '40.0000' },
        ],
        [
            {
                number: 'DO-2026-0001',
                status: 'Draft',
                products: [
                    { code: 'GARLIC', quantity: 20 },
                    { code: 'CHILI', quantity: 10 },
                ],
            },
            {
                number: 'DO-2026-0002',
                status: 'In Transit',
                products: [{ code: 'GARLIC', quantity: 20 }],
            },
        ],
    );
    await sale(
        'SO-2026-0003',
        'Partially Delivered',
        restaurant!.customerId,
        [
            { code: 'PEPPER', quantity: 30, price: '45.0000' },
            { code: 'NATA', quantity: 24, price: '50.0000' },
        ],
        [
            {
                number: 'DO-2026-0003',
                status: 'Completed',
                products: [
                    { code: 'PEPPER', quantity: 12 },
                    { code: 'NATA', quantity: 12 },
                ],
            },
            {
                number: 'DO-2026-0004',
                status: 'Draft',
                products: [
                    { code: 'PEPPER', quantity: 6 },
                    { code: 'NATA', quantity: 6 },
                ],
            },
        ],
    );
    await sale(
        'SO-2026-0004',
        'Completed',
        grocery!.customerId,
        [
            { code: 'CAYENNE', quantity: 10, price: '30.0000' },
            { code: 'KAONG', quantity: 12, price: '55.0000' },
        ],
        [
            {
                number: 'DO-2026-0005',
                status: 'Completed',
                products: [
                    { code: 'CAYENNE', quantity: 10 },
                    { code: 'KAONG', quantity: 12 },
                ],
            },
        ],
    );
    await sale(
        'SO-2026-0005',
        'Cancelled',
        restaurant!.customerId,
        [{ code: 'NOODLES', quantity: 15, price: '35.0000' }],
        [
            {
                number: 'DO-2026-0006',
                status: 'Cancelled',
                products: [{ code: 'NOODLES', quantity: 10 }],
            },
        ],
    );

    for (const pending of [
        { number: 'PO-2026-1005', status: 'Sent' as const, received: '0', ordered: '50' },
        {
            number: 'PO-2026-1006',
            status: 'Partially Received' as const,
            received: '10',
            ordered: '30',
        },
        { number: 'PO-2026-1007', status: 'Draft' as const, received: '0', ordered: '20' },
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
                    lotNumber: 'LOT-GARLIC-PARTIAL',
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
    await tx.insert(reorderPolicies).values([
        { itemId: garlic.itemId, reorderLevel: '25.0000', ...audit },
        { itemId: finishedItems.get('GARLIC')!.itemId, reorderLevel: '100.0000', ...audit },
    ]);
    async function request(
        number: string,
        kind: 'Count' | 'Scrap' | 'Disposition' | 'QC' | 'Formula',
        status: 'Draft' | 'Submitted' | 'Approved',
        notes: string,
    ) {
        const [row] = await tx
            .insert(reviewRequests)
            .values({
                requestNumber: number,
                kind,
                status,
                notes,
                evidenceReference: 'Training record ' + number,
                createdBy: maker,
                updatedBy: status === 'Approved' ? actor : maker,
                createdAt: now,
                updatedAt: now,
                ...(status !== 'Draft' ? { submittedBy: maker, submittedAt: now } : {}),
                ...(status === 'Approved'
                    ? {
                          reviewedBy: actor,
                          reviewedAt: now,
                          reviewNote: 'Independent review: unchanged physical count confirmed.',
                      }
                    : {}),
            })
            .returning();
        await tx.insert(reviewEvents).values([
            {
                requestId: row!.requestId,
                action: 'create',
                note: notes,
                actorId: maker,
                createdAt: now,
            },
            ...(status !== 'Draft'
                ? [
                      {
                          requestId: row!.requestId,
                          action: 'submit',
                          note: 'Prepared for independent review.',
                          actorId: maker,
                          createdAt: now,
                      },
                  ]
                : []),
            ...(status === 'Approved'
                ? [
                      {
                          requestId: row!.requestId,
                          action: 'approve',
                          note: 'Independent sample review: unchanged count confirmed.',
                          actorId: actor,
                          createdAt: now,
                      },
                  ]
                : []),
        ]);
        return row!.requestId;
    }
    const garlicLot = purchasedLots.get(garlic.itemId)!;
    const garlicBalance = quantityString(
        balances.get(garlicLot.lotId + ':' + location('WH-RM'))!.units,
    );
    for (const status of ['Draft', 'Approved'] as const) {
        const requestId = await request(
            'COUNT-SESSION-' + status.toUpperCase(),
            'Count',
            status,
            'Physical count observation for garlic; no ledger movement for unchanged counts.',
        );
        await tx
            .insert(countSessions)
            .values({ requestId, locationId: location('WH-RM'), reasonId: countReason!.reasonId });
        await tx.insert(countObservations).values({
            requestId,
            lotId: garlicLot.lotId,
            expectedQty: garlicBalance,
            countedQty: status === 'Approved' ? garlicBalance : null,
            observedBy: status === 'Approved' ? maker : null,
            observedAt: status === 'Approved' ? now : null,
        });
    }
    const scrapId = await request(
        'SCRAP-REVIEW',
        'Scrap',
        'Submitted',
        'Dispose of a measured portion of expired chili after independent review.',
    );
    await tx.insert(inventoryDisposals).values({
        requestId: scrapId,
        lotId: expiredLot!.lotId,
        sourceLocationId: location('QC-HOLD'),
        reasonId: expiredReason!.reasonId,
        quantity: '0.2500',
        expectedQty: quantityString(
            balances.get(expiredLot!.lotId + ':' + location('QC-HOLD'))!.units,
        ),
    });
    const [qcLot] = await tx
        .select()
        .from(lots)
        .where(sql`${lots.lotNumber} = 'LOT-GARLIC-QC'`);
    const qcId = await request(
        'QC-REVIEW',
        'QC',
        'Submitted',
        'Laboratory evidence supports approving quarantined garlic; release storage separately.',
    );
    await tx.insert(qcDecisions).values({
        requestId: qcId,
        lotId: qcLot!.lotId,
        previousStatus: 'Quarantine',
        newStatus: 'Approved',
    });
    const dispositionId = await request(
        'DISPOSITION-DRAFT',
        'Disposition',
        'Draft',
        'Move expired chili into the scrap holding location; this does not dispose of stock.',
    );
    await tx.insert(inventoryDisposals).values({
        requestId: dispositionId,
        lotId: expiredLot!.lotId,
        sourceLocationId: location('QC-HOLD'),
        destinationLocationId: location('SCRAP'),
        reasonId: expiredReason!.reasonId,
        quantity: '0.5000',
        expectedQty: quantityString(
            balances.get(expiredLot!.lotId + ':' + location('QC-HOLD'))!.units,
        ),
    });
    const revisionId = await request(
        'FORMULA-REVIEW',
        'Formula',
        'Submitted',
        'Release revision one of the garlic formula for future packing orders.',
    );
    await tx.insert(formulaRevisions).values({
        requestId: revisionId,
        itemId: finishedItems.get('GARLIC')!.itemId,
        revisionNumber: 1,
        effectiveDate: date(0),
        changeType: 'Replace',
    });
    const product = sampleProducts.find((p) => p.code === 'GARLIC')!;
    await tx.insert(formulaRevisionMaterials).values([
        {
            requestId: revisionId,
            componentItemId: garlic.itemId,
            quantity: quantityString(BigInt(product.grams) * 10n),
            uomId: kg!.uomId,
        },
        ...[
            componentItems.get(product.pack)!,
            componentItems.get('LABEL-GARLIC')!,
            componentItems.get('SEAL')!,
        ].map((item) => ({
            requestId: revisionId,
            componentItemId: item.itemId,
            quantity: '1.000000',
            uomId: pc!.uomId,
        })),
    ]);
}
