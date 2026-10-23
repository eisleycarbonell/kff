/**
 * Development seed for the Spice Trading & Packing System.
 *
 * IMPORTANT:
 * - Intended for a fresh/local/dev database.
 * - This script clears application tables before inserting sample data.
 * - Adjust the `db` and schema import paths if your project uses different paths.
 *
 * Demo login:
 *   email: admin@spice.local
 *   password: Admin123!
 */

import { db } from "./index.ts";
import {
    roles,
    users,
    uomClasses,
    uoms,
    items,
    locations,
    scrapReasonCodes,
    suppliers,
    supplierItems,
    billOfMaterials,
    itemPackaging,
    purchaseOrders,
    purchaseOrderLines,
    packingOrders,
    packingOrderMaterials,
    lots,
    inventoryStock,
    inventoryReservations,
    stockTransfers,
    stockTransferLines,
    inventoryTransactions,
} from "./schema.ts";

const DEMO_PASSWORD_HASH =
    "$argon2id$v=19$m=65536,t=3,p=4$5xwnaBH0FN6IYG+e99XFfg$u/Cc6IJ5tM4ZPJrrxET9QNPfOFw9oQ6NOgR6jUgUzaM";

const by = <T extends Record<string, any>, K extends keyof T>(
    rows: T[],
    key: K,
) => new Map(rows.map((row) => [row[key], row]));

async function seed() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Refusing to run development seed in production.");
    }

    await db.transaction(async (tx: any) => {
        // ---------------------------------------------------------------------
        // RESET — reverse dependency order
        // ---------------------------------------------------------------------
        await tx.delete(inventoryTransactions);
        await tx.delete(stockTransferLines);
        await tx.delete(stockTransfers);
        await tx.delete(inventoryReservations);
        await tx.delete(inventoryStock);
        await tx.delete(lots);
        await tx.delete(packingOrderMaterials);
        await tx.delete(packingOrders);
        await tx.delete(purchaseOrderLines);
        await tx.delete(purchaseOrders);
        await tx.delete(itemPackaging);
        await tx.delete(billOfMaterials);
        await tx.delete(supplierItems);
        await tx.delete(suppliers);
        await tx.delete(scrapReasonCodes);
        await tx.delete(locations);
        await tx.delete(items);
        await tx.delete(uoms);
        await tx.delete(uomClasses);
        await tx.delete(users);
        await tx.delete(roles);

        // ---------------------------------------------------------------------
        // 1. ROLES & USERS
        // ---------------------------------------------------------------------
        const roleRows = await tx
            .insert(roles)
            .values([
                {
                    name: "Administrator",
                    description: "Full system access",
                    settings: {
                        canManageInventory: true,
                        canManagePurchasing: true,
                        canManagePacking: true,
                        canManageTransfers: true,
                        canManageUsers: true,
                    },
                },
                {
                    name: "Warehouse Manager",
                    description: "Inventory, packing and transfer operations",
                    settings: {
                        canManageInventory: true,
                        canManagePurchasing: false,
                        canManagePacking: true,
                        canManageTransfers: true,
                        canManageUsers: false,
                    },
                },
                {
                    name: "Purchasing",
                    description: "Suppliers and purchase orders",
                    settings: {
                        canManageInventory: false,
                        canManagePurchasing: true,
                        canManagePacking: false,
                        canManageTransfers: false,
                        canManageUsers: false,
                    },
                },
            ])
            .returning();

        const roleMap = by(roleRows, "name");

        const userRows = await tx
            .insert(users)
            .values([
                {
                    firstName: "System",
                    lastName: "Administrator",
                    email: "admin@spice.local",
                    passwordHash: DEMO_PASSWORD_HASH,
                    isEmailVerified: true,
                    roleId: roleMap.get("Administrator")!.roleId,
                },
                {
                    firstName: "Maria",
                    lastName: "Santos",
                    email: "warehouse@spice.local",
                    passwordHash: DEMO_PASSWORD_HASH,
                    isEmailVerified: true,
                    roleId: roleMap.get("Warehouse Manager")!.roleId,
                },
                {
                    firstName: "Carlo",
                    lastName: "Reyes",
                    email: "purchasing@spice.local",
                    passwordHash: DEMO_PASSWORD_HASH,
                    isEmailVerified: true,
                    roleId: roleMap.get("Purchasing")!.roleId,
                },
            ])
            .returning();

        const userMap = by(userRows, "email");
        const adminId = userMap.get("admin@spice.local")!.userId;

        // ---------------------------------------------------------------------
        // 2. UOM CLASSES & UOMS
        // ---------------------------------------------------------------------
        const uomClassRows = await tx
            .insert(uomClasses)
            .values([
                { name: "Mass", createdBy: adminId, updatedBy: adminId },
                { name: "Count", createdBy: adminId, updatedBy: adminId },
            ])
            .returning();

        const classMap = by(uomClassRows, "name");

        const uomRows = await tx
            .insert(uoms)
            .values([
                {
                    uomClassId: classMap.get("Mass")!.uomClassId,
                    name: "g",
                    factorToBase: "1",
                    isBase: true,
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    uomClassId: classMap.get("Mass")!.uomClassId,
                    name: "kg",
                    factorToBase: "1000",
                    isBase: false,
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    uomClassId: classMap.get("Count")!.uomClassId,
                    name: "pc",
                    factorToBase: "1",
                    isBase: true,
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    uomClassId: classMap.get("Count")!.uomClassId,
                    name: "box",
                    factorToBase: "12",
                    isBase: false,
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    uomClassId: classMap.get("Count")!.uomClassId,
                    name: "case",
                    factorToBase: "48",
                    isBase: false,
                    createdBy: adminId,
                    updatedBy: adminId,
                },
            ])
            .returning();

        const uomMap = by(uomRows, "name");

        // ---------------------------------------------------------------------
        // 3. LOCATIONS
        // ---------------------------------------------------------------------
        const locationRows = await tx
            .insert(locations)
            .values([
                {
                    code: "WH-RM",
                    name: "Warehouse 1 - Raw & Packaging Materials",
                    locationType: "Warehouse",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    code: "PACK-01",
                    name: "Main Packing Area",
                    locationType: "Packing",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    code: "WH-FG",
                    name: "Warehouse 2 - Finished Goods",
                    locationType: "Warehouse",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    code: "BR-MNL",
                    name: "Manila Branch",
                    locationType: "Branch",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    code: "BR-QC",
                    name: "Quezon City Branch",
                    locationType: "Branch",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    code: "STORE-01",
                    name: "Flagship Store",
                    locationType: "Store",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    code: "QUAR-01",
                    name: "Quarantine Area",
                    locationType: "Quarantine",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    code: "SCRAP-01",
                    name: "Scrap Area",
                    locationType: "Scrap",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    code: "TRANSIT",
                    name: "Goods In Transit",
                    locationType: "In Transit",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
            ])
            .returning();

        const locationMap = by(locationRows, "code");

        // ---------------------------------------------------------------------
        // 4. REASON CODES
        // ---------------------------------------------------------------------
        await tx.insert(scrapReasonCodes).values([
            {
                codeName: "DAMAGED-PACK",
                category: "Packing Damage",
                description: "Pouch, bottle, seal or label damaged during packing",
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                codeName: "EXPIRED",
                category: "Expired",
                description: "Expired inventory",
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                codeName: "COUNT-ADJ",
                category: "Inventory Adjustment",
                description: "Physical count adjustment",
                createdBy: adminId,
                updatedBy: adminId,
            },
        ]);

        // ---------------------------------------------------------------------
        // 5. ITEMS
        // ---------------------------------------------------------------------
        const itemRows = await tx
            .insert(items)
            .values([
                // Raw spices
                {
                    sku: "RM-GARLIC-PWD",
                    name: "Garlic Powder Bulk",
                    itemType: "Raw Material - Bulk",
                    primaryUomId: uomMap.get("kg")!.uomId,
                    shelfLifeDays: 365,
                    requiresQc: true,
                    unitCost: "110.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    sku: "RM-CHILI-PWD",
                    name: "Chili Powder Bulk",
                    itemType: "Raw Material - Bulk",
                    primaryUomId: uomMap.get("kg")!.uomId,
                    shelfLifeDays: 365,
                    requiresQc: true,
                    unitCost: "140.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    sku: "RM-PEPPER-PWD",
                    name: "Black Pepper Powder Bulk",
                    itemType: "Raw Material - Bulk",
                    primaryUomId: uomMap.get("kg")!.uomId,
                    shelfLifeDays: 365,
                    requiresQc: true,
                    unitCost: "180.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },

                // Packaging hardware
                {
                    sku: "PKG-POUCH-100G",
                    name: "Stand-up Pouch 100g",
                    itemType: "Packaging - Hardware",
                    primaryUomId: uomMap.get("pc")!.uomId,
                    requiresQc: false,
                    unitCost: "1.2000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    sku: "PKG-POUCH-250G",
                    name: "Stand-up Pouch 250g",
                    itemType: "Packaging - Hardware",
                    primaryUomId: uomMap.get("pc")!.uomId,
                    requiresQc: false,
                    unitCost: "1.6000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    sku: "PKG-SEAL",
                    name: "Tamper Seal",
                    itemType: "Packaging - Hardware",
                    primaryUomId: uomMap.get("pc")!.uomId,
                    requiresQc: false,
                    unitCost: "0.1500",
                    createdBy: adminId,
                    updatedBy: adminId,
                },

                // Labels
                {
                    sku: "LBL-GARLIC-A-100G",
                    name: "Garlic Powder 100g - Label A",
                    itemType: "Packaging - Label",
                    primaryUomId: uomMap.get("pc")!.uomId,
                    requiresQc: false,
                    unitCost: "0.2500",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    sku: "LBL-GARLIC-B-100G",
                    name: "Garlic Powder 100g - Label B",
                    itemType: "Packaging - Label",
                    primaryUomId: uomMap.get("pc")!.uomId,
                    requiresQc: false,
                    unitCost: "0.2600",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    sku: "LBL-GARLIC-A-250G",
                    name: "Garlic Powder 250g - Label A",
                    itemType: "Packaging - Label",
                    primaryUomId: uomMap.get("pc")!.uomId,
                    requiresQc: false,
                    unitCost: "0.3000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    sku: "LBL-CHILI-A-100G",
                    name: "Chili Powder 100g - Label A",
                    itemType: "Packaging - Label",
                    primaryUomId: uomMap.get("pc")!.uomId,
                    requiresQc: false,
                    unitCost: "0.2500",
                    createdBy: adminId,
                    updatedBy: adminId,
                },

                // Finished goods
                {
                    sku: "FG-GARLIC-100-A",
                    name: "Garlic Powder 100g - Label A",
                    itemType: "Finished Good",
                    primaryUomId: uomMap.get("pc")!.uomId,
                    netWeightG: "100.0000",
                    shelfLifeDays: 365,
                    requiresQc: false,
                    unitCost: "12.6000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    sku: "FG-GARLIC-100-B",
                    name: "Garlic Powder 100g - Label B",
                    itemType: "Finished Good",
                    primaryUomId: uomMap.get("pc")!.uomId,
                    netWeightG: "100.0000",
                    shelfLifeDays: 365,
                    requiresQc: false,
                    unitCost: "12.6100",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    sku: "FG-GARLIC-250-A",
                    name: "Garlic Powder 250g - Label A",
                    itemType: "Finished Good",
                    primaryUomId: uomMap.get("pc")!.uomId,
                    netWeightG: "250.0000",
                    shelfLifeDays: 365,
                    requiresQc: false,
                    unitCost: "29.5500",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    sku: "FG-CHILI-100-A",
                    name: "Chili Powder 100g - Label A",
                    itemType: "Finished Good",
                    primaryUomId: uomMap.get("pc")!.uomId,
                    netWeightG: "100.0000",
                    shelfLifeDays: 365,
                    requiresQc: false,
                    unitCost: "15.6000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
            ])
            .returning();

        const itemMap = by(itemRows, "sku");

        // ---------------------------------------------------------------------
        // 6. SUPPLIERS + MULTI-SUPPLIER CATALOG
        // ---------------------------------------------------------------------
        const supplierRows = await tx
            .insert(suppliers)
            .values([
                {
                    name: "Davao Spices Trading",
                    email: "sales@davaospices.test",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    name: "Mindanao Ingredients Corp.",
                    email: "orders@mindanaoingredients.test",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    name: "PackRight Packaging",
                    email: "sales@packright.test",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    name: "Flexible Packs Inc.",
                    email: "orders@flexpacks.test",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    name: "Prime Labels PH",
                    email: "orders@primelabels.test",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
            ])
            .returning();

        const supplierMap = by(supplierRows, "name");

        await tx.insert(supplierItems).values([
            // Same garlic item from two suppliers
            {
                supplierId: supplierMap.get("Davao Spices Trading")!.supplierId,
                itemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                supplierItemCode: "DST-GARLIC-PWD",
                defaultUomId: uomMap.get("kg")!.uomId,
                defaultPrice: "110.0000",
                leadTimeDays: 3,
                isPreferred: true,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                supplierId: supplierMap.get("Mindanao Ingredients Corp.")!.supplierId,
                itemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                supplierItemCode: "MIC-GAR-PWD",
                defaultUomId: uomMap.get("kg")!.uomId,
                defaultPrice: "108.5000",
                leadTimeDays: 5,
                isPreferred: false,
                createdBy: adminId,
                updatedBy: adminId,
            },

            // Same chili item from two suppliers
            {
                supplierId: supplierMap.get("Davao Spices Trading")!.supplierId,
                itemId: itemMap.get("RM-CHILI-PWD")!.itemId,
                supplierItemCode: "DST-CHILI-PWD",
                defaultUomId: uomMap.get("kg")!.uomId,
                defaultPrice: "140.0000",
                leadTimeDays: 3,
                isPreferred: true,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                supplierId: supplierMap.get("Mindanao Ingredients Corp.")!.supplierId,
                itemId: itemMap.get("RM-CHILI-PWD")!.itemId,
                supplierItemCode: "MIC-CHILI-PWD",
                defaultUomId: uomMap.get("kg")!.uomId,
                defaultPrice: "138.0000",
                leadTimeDays: 5,
                isPreferred: false,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                supplierId: supplierMap.get("Mindanao Ingredients Corp.")!.supplierId,
                itemId: itemMap.get("RM-PEPPER-PWD")!.itemId,
                supplierItemCode: "MIC-PEPPER-PWD",
                defaultUomId: uomMap.get("kg")!.uomId,
                defaultPrice: "180.0000",
                leadTimeDays: 5,
                isPreferred: true,
                createdBy: adminId,
                updatedBy: adminId,
            },

            // Same pouch item from two suppliers
            {
                supplierId: supplierMap.get("PackRight Packaging")!.supplierId,
                itemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                supplierItemCode: "PR-PCH100",
                defaultUomId: uomMap.get("pc")!.uomId,
                defaultPrice: "1.2000",
                leadTimeDays: 4,
                isPreferred: true,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                supplierId: supplierMap.get("Flexible Packs Inc.")!.supplierId,
                itemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                supplierItemCode: "FP-PCH100",
                defaultUomId: uomMap.get("pc")!.uomId,
                defaultPrice: "1.1500",
                leadTimeDays: 6,
                isPreferred: false,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                supplierId: supplierMap.get("PackRight Packaging")!.supplierId,
                itemId: itemMap.get("PKG-POUCH-250G")!.itemId,
                supplierItemCode: "PR-PCH250",
                defaultUomId: uomMap.get("pc")!.uomId,
                defaultPrice: "1.6000",
                leadTimeDays: 4,
                isPreferred: true,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                supplierId: supplierMap.get("PackRight Packaging")!.supplierId,
                itemId: itemMap.get("PKG-SEAL")!.itemId,
                supplierItemCode: "PR-SEAL",
                defaultUomId: uomMap.get("pc")!.uomId,
                defaultPrice: "0.1500",
                leadTimeDays: 4,
                isPreferred: true,
                createdBy: adminId,
                updatedBy: adminId,
            },

            // Labels
            ...[
                ["LBL-GARLIC-A-100G", "PLA-GA100", "0.2500"],
                ["LBL-GARLIC-B-100G", "PLA-GB100", "0.2600"],
                ["LBL-GARLIC-A-250G", "PLA-GA250", "0.3000"],
                ["LBL-CHILI-A-100G", "PLA-CA100", "0.2500"],
            ].map(([sku, code, price]) => ({
                supplierId: supplierMap.get("Prime Labels PH")!.supplierId,
                itemId: itemMap.get(sku)!.itemId,
                supplierItemCode: code,
                defaultUomId: uomMap.get("pc")!.uomId,
                defaultPrice: price,
                leadTimeDays: 3,
                isPreferred: true,
                createdBy: adminId,
                updatedBy: adminId,
            })),
        ]);

        // ---------------------------------------------------------------------
        // 7. BOM / PACKING FORMULAS
        // ---------------------------------------------------------------------
        await tx.insert(billOfMaterials).values([
            // Garlic 100g Label A
            {
                parentItemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                componentItemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                quantity: "0.100000",
                uomId: uomMap.get("kg")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                componentItemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                componentItemId: itemMap.get("LBL-GARLIC-A-100G")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                componentItemId: itemMap.get("PKG-SEAL")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },

            // Garlic 100g Label B
            {
                parentItemId: itemMap.get("FG-GARLIC-100-B")!.itemId,
                componentItemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                quantity: "0.100000",
                uomId: uomMap.get("kg")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-GARLIC-100-B")!.itemId,
                componentItemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-GARLIC-100-B")!.itemId,
                componentItemId: itemMap.get("LBL-GARLIC-B-100G")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-GARLIC-100-B")!.itemId,
                componentItemId: itemMap.get("PKG-SEAL")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },

            // Garlic 250g Label A
            {
                parentItemId: itemMap.get("FG-GARLIC-250-A")!.itemId,
                componentItemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                quantity: "0.250000",
                uomId: uomMap.get("kg")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-GARLIC-250-A")!.itemId,
                componentItemId: itemMap.get("PKG-POUCH-250G")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-GARLIC-250-A")!.itemId,
                componentItemId: itemMap.get("LBL-GARLIC-A-250G")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-GARLIC-250-A")!.itemId,
                componentItemId: itemMap.get("PKG-SEAL")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },

            // Chili 100g Label A
            {
                parentItemId: itemMap.get("FG-CHILI-100-A")!.itemId,
                componentItemId: itemMap.get("RM-CHILI-PWD")!.itemId,
                quantity: "0.100000",
                uomId: uomMap.get("kg")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-CHILI-100-A")!.itemId,
                componentItemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-CHILI-100-A")!.itemId,
                componentItemId: itemMap.get("LBL-CHILI-A-100G")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                parentItemId: itemMap.get("FG-CHILI-100-A")!.itemId,
                componentItemId: itemMap.get("PKG-SEAL")!.itemId,
                quantity: "1.000000",
                uomId: uomMap.get("pc")!.uomId,
                createdBy: adminId,
                updatedBy: adminId,
            },
        ]);

        // Selling/handling packs for one finished SKU
        await tx.insert(itemPackaging).values([
            {
                itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                uomId: uomMap.get("box")!.uomId,
                baseQty: "12.0000",
                barcode: "4800000000012",
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                uomId: uomMap.get("case")!.uomId,
                baseQty: "48.0000",
                barcode: "4800000000048",
                createdBy: adminId,
                updatedBy: adminId,
            },
        ]);

        // ---------------------------------------------------------------------
        // 8. PURCHASE ORDERS + RECEIVED LINES
        // ---------------------------------------------------------------------
        const poRows = await tx
            .insert(purchaseOrders)
            .values([
                {
                    poNumber: "PO-2026-0001",
                    supplierId: supplierMap.get("Davao Spices Trading")!.supplierId,
                    status: "Completed",
                    orderDate: new Date("2026-09-25T08:00:00+08:00"),
                    expectedDeliveryDate: "2026-09-29",
                    notes: "Initial raw spice inventory",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    poNumber: "PO-2026-0002",
                    supplierId: supplierMap.get("PackRight Packaging")!.supplierId,
                    status: "Completed",
                    orderDate: new Date("2026-09-25T08:30:00+08:00"),
                    expectedDeliveryDate: "2026-09-30",
                    notes: "Initial pouch and seal inventory",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    poNumber: "PO-2026-0003",
                    supplierId: supplierMap.get("Prime Labels PH")!.supplierId,
                    status: "Completed",
                    orderDate: new Date("2026-09-26T09:00:00+08:00"),
                    expectedDeliveryDate: "2026-09-30",
                    notes: "Initial label inventory",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    poNumber: "PO-2026-0004",
                    supplierId: supplierMap.get("Mindanao Ingredients Corp.")!.supplierId,
                    status: "Draft",
                    orderDate: new Date("2026-10-12T09:00:00+08:00"),
                    expectedDeliveryDate: "2026-10-18",
                    notes: "Sample alternate-supplier PO",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
            ])
            .returning();

        const poMap = by(poRows, "poNumber");

        const poLineRows = await tx
            .insert(purchaseOrderLines)
            .values([
                {
                    poId: poMap.get("PO-2026-0001")!.poId,
                    itemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                    uomId: uomMap.get("kg")!.uomId,
                    qtyOrdered: "200.0000",
                    qtyReceived: "200.0000",
                    unitPrice: "110.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    poId: poMap.get("PO-2026-0001")!.poId,
                    itemId: itemMap.get("RM-CHILI-PWD")!.itemId,
                    uomId: uomMap.get("kg")!.uomId,
                    qtyOrdered: "100.0000",
                    qtyReceived: "100.0000",
                    unitPrice: "140.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },

                {
                    poId: poMap.get("PO-2026-0002")!.poId,
                    itemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    qtyOrdered: "5000.0000",
                    qtyReceived: "5000.0000",
                    unitPrice: "1.2000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    poId: poMap.get("PO-2026-0002")!.poId,
                    itemId: itemMap.get("PKG-POUCH-250G")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    qtyOrdered: "2000.0000",
                    qtyReceived: "2000.0000",
                    unitPrice: "1.6000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    poId: poMap.get("PO-2026-0002")!.poId,
                    itemId: itemMap.get("PKG-SEAL")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    qtyOrdered: "7000.0000",
                    qtyReceived: "7000.0000",
                    unitPrice: "0.1500",
                    createdBy: adminId,
                    updatedBy: adminId,
                },

                {
                    poId: poMap.get("PO-2026-0003")!.poId,
                    itemId: itemMap.get("LBL-GARLIC-A-100G")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    qtyOrdered: "3000.0000",
                    qtyReceived: "3000.0000",
                    unitPrice: "0.2500",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    poId: poMap.get("PO-2026-0003")!.poId,
                    itemId: itemMap.get("LBL-GARLIC-B-100G")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    qtyOrdered: "2000.0000",
                    qtyReceived: "2000.0000",
                    unitPrice: "0.2600",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    poId: poMap.get("PO-2026-0003")!.poId,
                    itemId: itemMap.get("LBL-GARLIC-A-250G")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    qtyOrdered: "1500.0000",
                    qtyReceived: "1500.0000",
                    unitPrice: "0.3000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    poId: poMap.get("PO-2026-0003")!.poId,
                    itemId: itemMap.get("LBL-CHILI-A-100G")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    qtyOrdered: "2000.0000",
                    qtyReceived: "2000.0000",
                    unitPrice: "0.2500",
                    createdBy: adminId,
                    updatedBy: adminId,
                },

                // Draft line: not received yet
                {
                    poId: poMap.get("PO-2026-0004")!.poId,
                    itemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                    uomId: uomMap.get("kg")!.uomId,
                    qtyOrdered: "100.0000",
                    qtyReceived: "0.0000",
                    unitPrice: "108.5000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
            ])
            .returning();

        const poLineKey = (poNumber: string, sku: string) =>
            poLineRows.find(
                (line: (typeof poLineRows)[number]) =>
                    line.poId === poMap.get(poNumber)!.poId &&
                    line.itemId === itemMap.get(sku)!.itemId,
            )!;

        // ---------------------------------------------------------------------
        // 9. COMPLETED PACKING ORDER + PLANNED PACKING ORDER
        // ---------------------------------------------------------------------
        const packingRows = await tx
            .insert(packingOrders)
            .values([
                {
                    packingOrderNumber: "PK-2026-0001",
                    itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                    targetQty: "500.0000",
                    actualQty: "500.0000",
                    status: "Completed",
                    sourceLocationId: locationMap.get("WH-RM")!.locationId,
                    destinationLocationId: locationMap.get("WH-FG")!.locationId,
                    scheduledDate: "2026-10-05",
                    startedAt: new Date("2026-10-05T08:00:00+08:00"),
                    completedAt: new Date("2026-10-05T11:30:00+08:00"),
                    notes: "Completed sample packing run",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    packingOrderNumber: "PK-2026-0002",
                    itemId: itemMap.get("FG-GARLIC-100-B")!.itemId,
                    targetQty: "300.0000",
                    actualQty: "0.0000",
                    status: "Planned",
                    sourceLocationId: locationMap.get("WH-RM")!.locationId,
                    destinationLocationId: locationMap.get("WH-FG")!.locationId,
                    scheduledDate: "2026-10-13",
                    notes: "Planned order with active reservations",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
            ])
            .returning();

        const packingMap = by(packingRows, "packingOrderNumber");

        const materialRows = await tx
            .insert(packingOrderMaterials)
            .values([
                // Completed PK-2026-0001
                {
                    packingOrderId: packingMap.get("PK-2026-0001")!.packingOrderId,
                    itemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                    uomId: uomMap.get("kg")!.uomId,
                    requiredQty: "50.0000",
                    consumedQty: "50.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    packingOrderId: packingMap.get("PK-2026-0001")!.packingOrderId,
                    itemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    requiredQty: "500.0000",
                    consumedQty: "500.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    packingOrderId: packingMap.get("PK-2026-0001")!.packingOrderId,
                    itemId: itemMap.get("LBL-GARLIC-A-100G")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    requiredQty: "500.0000",
                    consumedQty: "500.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    packingOrderId: packingMap.get("PK-2026-0001")!.packingOrderId,
                    itemId: itemMap.get("PKG-SEAL")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    requiredQty: "500.0000",
                    consumedQty: "500.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },

                // Planned PK-2026-0002
                {
                    packingOrderId: packingMap.get("PK-2026-0002")!.packingOrderId,
                    itemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                    uomId: uomMap.get("kg")!.uomId,
                    requiredQty: "30.0000",
                    consumedQty: "0.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    packingOrderId: packingMap.get("PK-2026-0002")!.packingOrderId,
                    itemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    requiredQty: "300.0000",
                    consumedQty: "0.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    packingOrderId: packingMap.get("PK-2026-0002")!.packingOrderId,
                    itemId: itemMap.get("LBL-GARLIC-B-100G")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    requiredQty: "300.0000",
                    consumedQty: "0.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    packingOrderId: packingMap.get("PK-2026-0002")!.packingOrderId,
                    itemId: itemMap.get("PKG-SEAL")!.itemId,
                    uomId: uomMap.get("pc")!.uomId,
                    requiredQty: "300.0000",
                    consumedQty: "0.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
            ])
            .returning();

        const materialFor = (packingOrderNumber: string, sku: string) =>
            materialRows.find(
                (row: (typeof materialRows)[number]) =>
                    row.packingOrderId ===
                    packingMap.get(packingOrderNumber)!.packingOrderId &&
                    row.itemId === itemMap.get(sku)!.itemId,
            )!;

        // ---------------------------------------------------------------------
        // 10. LOTS
        // ---------------------------------------------------------------------
        const lotRows = await tx
            .insert(lots)
            .values([
                {
                    lotNumber: "LOT-GAR-20260929-01",
                    supplierLotNumber: "DST-GAR-0926-A",
                    itemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                    poLineId: poLineKey("PO-2026-0001", "RM-GARLIC-PWD").poLineId,
                    manufactureDate: "2026-09-15",
                    expirationDate: "2027-09-15",
                    qcStatus: "Approved",
                    unitCost: "110.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    lotNumber: "LOT-CHI-20260929-01",
                    supplierLotNumber: "DST-CHI-0926-A",
                    itemId: itemMap.get("RM-CHILI-PWD")!.itemId,
                    poLineId: poLineKey("PO-2026-0001", "RM-CHILI-PWD").poLineId,
                    manufactureDate: "2026-09-14",
                    expirationDate: "2027-09-14",
                    qcStatus: "Approved",
                    unitCost: "140.0000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    lotNumber: "LOT-PCH100-20260930-01",
                    itemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                    poLineId: poLineKey("PO-2026-0002", "PKG-POUCH-100G").poLineId,
                    qcStatus: "Approved",
                    unitCost: "1.2000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    lotNumber: "LOT-PCH250-20260930-01",
                    itemId: itemMap.get("PKG-POUCH-250G")!.itemId,
                    poLineId: poLineKey("PO-2026-0002", "PKG-POUCH-250G").poLineId,
                    qcStatus: "Approved",
                    unitCost: "1.6000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    lotNumber: "LOT-SEAL-20260930-01",
                    itemId: itemMap.get("PKG-SEAL")!.itemId,
                    poLineId: poLineKey("PO-2026-0002", "PKG-SEAL").poLineId,
                    qcStatus: "Approved",
                    unitCost: "0.1500",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    lotNumber: "LOT-LBLA100-20260930-01",
                    itemId: itemMap.get("LBL-GARLIC-A-100G")!.itemId,
                    poLineId: poLineKey("PO-2026-0003", "LBL-GARLIC-A-100G").poLineId,
                    qcStatus: "Approved",
                    unitCost: "0.2500",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    lotNumber: "LOT-LBLB100-20260930-01",
                    itemId: itemMap.get("LBL-GARLIC-B-100G")!.itemId,
                    poLineId: poLineKey("PO-2026-0003", "LBL-GARLIC-B-100G").poLineId,
                    qcStatus: "Approved",
                    unitCost: "0.2600",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    lotNumber: "LOT-LBLA250-20260930-01",
                    itemId: itemMap.get("LBL-GARLIC-A-250G")!.itemId,
                    poLineId: poLineKey("PO-2026-0003", "LBL-GARLIC-A-250G").poLineId,
                    qcStatus: "Approved",
                    unitCost: "0.3000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
                {
                    lotNumber: "LOT-LBLCHIA100-20260930-01",
                    itemId: itemMap.get("LBL-CHILI-A-100G")!.itemId,
                    poLineId: poLineKey("PO-2026-0003", "LBL-CHILI-A-100G").poLineId,
                    qcStatus: "Approved",
                    unitCost: "0.2500",
                    createdBy: adminId,
                    updatedBy: adminId,
                },

                // Finished lot produced by PK-2026-0001
                {
                    lotNumber: "FG-GAR-A100-20261005-01",
                    itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                    packingOrderId:
                        packingMap.get("PK-2026-0001")!.packingOrderId,
                    manufactureDate: "2026-10-05",
                    expirationDate: "2027-10-05",
                    qcStatus: "Approved",
                    unitCost: "12.6000",
                    createdBy: adminId,
                    updatedBy: adminId,
                },
            ])
            .returning();

        const lotMap = by(lotRows, "lotNumber");

        // ---------------------------------------------------------------------
        // 11. CURRENT INVENTORY STOCK
        //
        // Received:
        // - Garlic 200kg, then 50kg consumed = 150kg
        // - Pouch100 5000, then 500 consumed = 4500
        // - Label A100 3000, then 500 consumed = 2500
        // - Seal 7000, then 500 consumed = 6500
        //
        // Finished:
        // - 500 Garlic A 100g produced
        // - 200 transferred to Manila branch
        // - 300 remain in WH-FG
        // ---------------------------------------------------------------------
        await tx.insert(inventoryStock).values([
            {
                itemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                lotId: lotMap.get("LOT-GAR-20260929-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyOnHand: "150.0000",
            },
            {
                itemId: itemMap.get("RM-CHILI-PWD")!.itemId,
                lotId: lotMap.get("LOT-CHI-20260929-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyOnHand: "100.0000",
            },
            {
                itemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                lotId: lotMap.get("LOT-PCH100-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyOnHand: "4500.0000",
            },
            {
                itemId: itemMap.get("PKG-POUCH-250G")!.itemId,
                lotId: lotMap.get("LOT-PCH250-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyOnHand: "2000.0000",
            },
            {
                itemId: itemMap.get("PKG-SEAL")!.itemId,
                lotId: lotMap.get("LOT-SEAL-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyOnHand: "6500.0000",
            },
            {
                itemId: itemMap.get("LBL-GARLIC-A-100G")!.itemId,
                lotId: lotMap.get("LOT-LBLA100-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyOnHand: "2500.0000",
            },
            {
                itemId: itemMap.get("LBL-GARLIC-B-100G")!.itemId,
                lotId: lotMap.get("LOT-LBLB100-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyOnHand: "2000.0000",
            },
            {
                itemId: itemMap.get("LBL-GARLIC-A-250G")!.itemId,
                lotId: lotMap.get("LOT-LBLA250-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyOnHand: "1500.0000",
            },
            {
                itemId: itemMap.get("LBL-CHILI-A-100G")!.itemId,
                lotId: lotMap.get("LOT-LBLCHIA100-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyOnHand: "2000.0000",
            },
            {
                itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                lotId: lotMap.get("FG-GAR-A100-20261005-01")!.lotId,
                locationId: locationMap.get("WH-FG")!.locationId,
                qtyOnHand: "300.0000",
            },
            {
                itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                lotId: lotMap.get("FG-GAR-A100-20261005-01")!.lotId,
                locationId: locationMap.get("BR-MNL")!.locationId,
                qtyOnHand: "200.0000",
            },
        ]);

        // ---------------------------------------------------------------------
        // 12. ACTIVE RESERVATIONS FOR PK-2026-0002
        // ---------------------------------------------------------------------
        await tx.insert(inventoryReservations).values([
            {
                packingOrderMaterialId:
                    materialFor("PK-2026-0002", "RM-GARLIC-PWD")
                        .packingOrderMaterialId,
                itemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                lotId: lotMap.get("LOT-GAR-20260929-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyReserved: "30.0000",
                qtyConsumed: "0.0000",
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                packingOrderMaterialId:
                    materialFor("PK-2026-0002", "PKG-POUCH-100G")
                        .packingOrderMaterialId,
                itemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                lotId: lotMap.get("LOT-PCH100-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyReserved: "300.0000",
                qtyConsumed: "0.0000",
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                packingOrderMaterialId:
                    materialFor("PK-2026-0002", "LBL-GARLIC-B-100G")
                        .packingOrderMaterialId,
                itemId: itemMap.get("LBL-GARLIC-B-100G")!.itemId,
                lotId: lotMap.get("LOT-LBLB100-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyReserved: "300.0000",
                qtyConsumed: "0.0000",
                createdBy: adminId,
                updatedBy: adminId,
            },
            {
                packingOrderMaterialId:
                    materialFor("PK-2026-0002", "PKG-SEAL")
                        .packingOrderMaterialId,
                itemId: itemMap.get("PKG-SEAL")!.itemId,
                lotId: lotMap.get("LOT-SEAL-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyReserved: "300.0000",
                qtyConsumed: "0.0000",
                createdBy: adminId,
                updatedBy: adminId,
            },
        ]);

        // ---------------------------------------------------------------------
        // 13. COMPLETED STOCK TRANSFER TO MANILA BRANCH
        // ---------------------------------------------------------------------
        const [transfer] = await tx
            .insert(stockTransfers)
            .values({
                transferNumber: "TR-2026-0001",
                sourceLocationId: locationMap.get("WH-FG")!.locationId,
                destinationLocationId: locationMap.get("BR-MNL")!.locationId,
                status: "Completed",
                requestedAt: new Date("2026-10-07T08:00:00+08:00"),
                dispatchedAt: new Date("2026-10-07T09:00:00+08:00"),
                receivedAt: new Date("2026-10-07T15:00:00+08:00"),
                notes: "Sample finished-goods delivery to Manila branch",
                createdBy: adminId,
                updatedBy: adminId,
            })
            .returning();

        const [transferLine] = await tx
            .insert(stockTransferLines)
            .values({
                transferId: transfer.transferId,
                itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                lotId: lotMap.get("FG-GAR-A100-20261005-01")!.lotId,
                qtyRequested: "200.0000",
                qtyShipped: "200.0000",
                qtyReceived: "200.0000",
                createdBy: adminId,
                updatedBy: adminId,
            })
            .returning();

        // ---------------------------------------------------------------------
        // 14. APPEND-ONLY INVENTORY LEDGER
        // ---------------------------------------------------------------------
        const receiveTx = [
            ["PO-2026-0001", "RM-GARLIC-PWD", "LOT-GAR-20260929-01", "200.0000"],
            ["PO-2026-0001", "RM-CHILI-PWD", "LOT-CHI-20260929-01", "100.0000"],
            ["PO-2026-0002", "PKG-POUCH-100G", "LOT-PCH100-20260930-01", "5000.0000"],
            ["PO-2026-0002", "PKG-POUCH-250G", "LOT-PCH250-20260930-01", "2000.0000"],
            ["PO-2026-0002", "PKG-SEAL", "LOT-SEAL-20260930-01", "7000.0000"],
            ["PO-2026-0003", "LBL-GARLIC-A-100G", "LOT-LBLA100-20260930-01", "3000.0000"],
            ["PO-2026-0003", "LBL-GARLIC-B-100G", "LOT-LBLB100-20260930-01", "2000.0000"],
            ["PO-2026-0003", "LBL-GARLIC-A-250G", "LOT-LBLA250-20260930-01", "1500.0000"],
            ["PO-2026-0003", "LBL-CHILI-A-100G", "LOT-LBLCHIA100-20260930-01", "2000.0000"],
        ].map(([poNumber, sku, lotNumber, qtyChange]) => ({
            itemId: itemMap.get(sku)!.itemId,
            lotId: lotMap.get(lotNumber)!.lotId,
            locationId: locationMap.get("WH-RM")!.locationId,
            qtyChange,
            transactionType: "Receive" as const,
            poLineId: poLineKey(poNumber, sku).poLineId,
            referenceId: poNumber,
            authorizedByUserId: adminId,
            createdAt: new Date("2026-09-30T10:00:00+08:00"),
        }));

        await tx.insert(inventoryTransactions).values(receiveTx);

        // Materials consumed by PK-2026-0001
        await tx.insert(inventoryTransactions).values([
            {
                itemId: itemMap.get("RM-GARLIC-PWD")!.itemId,
                lotId: lotMap.get("LOT-GAR-20260929-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyChange: "-50.0000",
                transactionType: "Consume",
                packingOrderId:
                    packingMap.get("PK-2026-0001")!.packingOrderId,
                referenceId: "PK-2026-0001",
                authorizedByUserId: adminId,
                createdAt: new Date("2026-10-05T09:00:00+08:00"),
            },
            {
                itemId: itemMap.get("PKG-POUCH-100G")!.itemId,
                lotId: lotMap.get("LOT-PCH100-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyChange: "-500.0000",
                transactionType: "Consume",
                packingOrderId:
                    packingMap.get("PK-2026-0001")!.packingOrderId,
                referenceId: "PK-2026-0001",
                authorizedByUserId: adminId,
                createdAt: new Date("2026-10-05T09:00:00+08:00"),
            },
            {
                itemId: itemMap.get("LBL-GARLIC-A-100G")!.itemId,
                lotId: lotMap.get("LOT-LBLA100-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyChange: "-500.0000",
                transactionType: "Consume",
                packingOrderId:
                    packingMap.get("PK-2026-0001")!.packingOrderId,
                referenceId: "PK-2026-0001",
                authorizedByUserId: adminId,
                createdAt: new Date("2026-10-05T09:00:00+08:00"),
            },
            {
                itemId: itemMap.get("PKG-SEAL")!.itemId,
                lotId: lotMap.get("LOT-SEAL-20260930-01")!.lotId,
                locationId: locationMap.get("WH-RM")!.locationId,
                qtyChange: "-500.0000",
                transactionType: "Consume",
                packingOrderId:
                    packingMap.get("PK-2026-0001")!.packingOrderId,
                referenceId: "PK-2026-0001",
                authorizedByUserId: adminId,
                createdAt: new Date("2026-10-05T09:00:00+08:00"),
            },

            // Finished output
            {
                itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                lotId: lotMap.get("FG-GAR-A100-20261005-01")!.lotId,
                locationId: locationMap.get("WH-FG")!.locationId,
                qtyChange: "500.0000",
                transactionType: "Produce",
                packingOrderId:
                    packingMap.get("PK-2026-0001")!.packingOrderId,
                referenceId: "PK-2026-0001",
                authorizedByUserId: adminId,
                createdAt: new Date("2026-10-05T11:30:00+08:00"),
            },
        ]);

        // Transfer: WH-FG -> In Transit -> Manila Branch
        await tx.insert(inventoryTransactions).values([
            {
                itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                lotId: lotMap.get("FG-GAR-A100-20261005-01")!.lotId,
                locationId: locationMap.get("WH-FG")!.locationId,
                qtyChange: "-200.0000",
                transactionType: "Transfer",
                transferLineId: transferLine.transferLineId,
                referenceId: "TR-2026-0001",
                authorizedByUserId: adminId,
                createdAt: new Date("2026-10-07T09:00:00+08:00"),
            },
            {
                itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                lotId: lotMap.get("FG-GAR-A100-20261005-01")!.lotId,
                locationId: locationMap.get("TRANSIT")!.locationId,
                qtyChange: "200.0000",
                transactionType: "Transfer",
                transferLineId: transferLine.transferLineId,
                referenceId: "TR-2026-0001",
                authorizedByUserId: adminId,
                createdAt: new Date("2026-10-07T09:00:00+08:00"),
            },
            {
                itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                lotId: lotMap.get("FG-GAR-A100-20261005-01")!.lotId,
                locationId: locationMap.get("TRANSIT")!.locationId,
                qtyChange: "-200.0000",
                transactionType: "Transfer",
                transferLineId: transferLine.transferLineId,
                referenceId: "TR-2026-0001",
                authorizedByUserId: adminId,
                createdAt: new Date("2026-10-07T15:00:00+08:00"),
            },
            {
                itemId: itemMap.get("FG-GARLIC-100-A")!.itemId,
                lotId: lotMap.get("FG-GAR-A100-20261005-01")!.lotId,
                locationId: locationMap.get("BR-MNL")!.locationId,
                qtyChange: "200.0000",
                transactionType: "Transfer",
                transferLineId: transferLine.transferLineId,
                referenceId: "TR-2026-0001",
                authorizedByUserId: adminId,
                createdAt: new Date("2026-10-07T15:00:00+08:00"),
            },
        ]);
    });

    console.log("✅ Spice Trading & Packing sample data seeded successfully.");
    console.log("");
    console.log("Demo accounts:");
    console.log("  admin@spice.local       / Admin123!");
    console.log("  warehouse@spice.local   / Admin123!");
    console.log("  purchasing@spice.local  / Admin123!");
    console.log("");
    console.log("Key scenarios:");
    console.log("  ✓ Multiple suppliers for Garlic Powder and 100g Pouch");
    console.log("  ✓ Completed packing order PK-2026-0001");
    console.log("  ✓ Planned packing order PK-2026-0002 with active reservations");
    console.log("  ✓ Completed transfer TR-2026-0001 to Manila Branch");
}

seed()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Seed failed");
        console.error(error);
        process.exit(1);
    });
