import {
    pgTable,
    integer,
    varchar,
    numeric,
    boolean,
    timestamp,
    date,
    text,
    jsonb,
    pgEnum,
    check,
    index,
    unique,
    uniqueIndex,
    foreignKey,
} from "drizzle-orm/pg-core";
import { defineRelations, sql } from "drizzle-orm";
import { auditFields } from "./column.helpers.ts";

// auditFields = { createdBy, createdAt, updatedBy, updatedAt }
// createdBy/updatedBy are nullable user IDs.
// createdAt/updatedAt are timezone-aware timestamps.

// =========================================================================
// HELPERS
// =========================================================================

const tz = (name: string) =>
    timestamp(name, { withTimezone: true, mode: "date" });

/** General inventory quantity. */
const qty = (name: string) =>
    numeric(name, { precision: 14, scale: 4 });

/** Money/cost kept separate from quantity for clarity. */
const money = (name: string) =>
    numeric(name, { precision: 14, scale: 4 });

// =========================================================================
// TYPES
// =========================================================================

export type RoleSettings = {
    canManageInventory?: boolean;
    canManagePurchasing?: boolean;
    canManagePacking?: boolean;
    canManageTransfers?: boolean;
    canManageUsers?: boolean;
};

// =========================================================================
// ENUMS
// =========================================================================

export const itemTypeEnum = pgEnum("item_type_enum", [
    "Raw Material - Bulk",
    "Packaging - Hardware",
    "Packaging - Label",
    "Finished Good",
]);

export const locationTypeEnum = pgEnum("location_type_enum", [
    "Warehouse",
    "Packing",
    "Branch",
    "Store",
    "Quarantine",
    "Scrap",
    "In Transit",
]);

export const scrapCategoryEnum = pgEnum("scrap_category_enum", [
    "Material Defect",
    "Packing Damage",
    "Spoilage",
    "Expired",
    "Inventory Adjustment",
    "Other",
]);

export const poStatusEnum = pgEnum("po_status_enum", [
    "Draft",
    "Sent",
    "Partially Received",
    "Completed",
    "Cancelled",
]);

export const packingOrderStatusEnum = pgEnum("packing_order_status_enum", [
    "Draft",
    "Planned",
    "In Progress",
    "Completed",
    "Cancelled",
]);

export const qcStatusEnum = pgEnum("qc_status_enum", [
    "Quarantine",
    "Approved",
    "Rejected",
    "Expired",
]);

export const transferStatusEnum = pgEnum("transfer_status_enum", [
    "Draft",
    "In Transit",
    "Completed",
    "Cancelled",
]);

export const transactionTypeEnum = pgEnum("transaction_type_enum", [
    "Receive",
    "Consume",
    "Produce",
    "Transfer",
    "Scrap",
    "Adjustment",
]);

// =========================================================================
// 1. AUTH & USER MANAGEMENT
// =========================================================================

export const roles = pgTable("roles", {
    roleId: integer("role_id").primaryKey().generatedByDefaultAsIdentity(),
    name: text("name").notNull().unique(),
    description: text("description"),
    settings: jsonb("settings").$type<RoleSettings>().default({}).notNull(),
    ...auditFields,
});

export const users = pgTable(
    "users",
    {
        userId: integer("user_id").primaryKey().generatedByDefaultAsIdentity(),
        firstName: text("first_name").notNull(),
        middleName: text("middle_name"),
        lastName: text("last_name").notNull(),
        dateOfBirth: date("date_of_birth"),
        avatarUrl: text("avatar_url"),
        mobileNumber: text("mobile_number"),
        address: text("address"),
        email: text("email").notNull(),
        passwordHash: text("password_hash").notNull(),
        isEmailVerified: boolean("is_email_verified").default(false).notNull(),
        roleId: integer("role_id")
            .notNull()
            .references(() => roles.roleId, { onDelete: "restrict" }),
        lastLoginAt: tz("last_login_at"),
        deletedAt: tz("deleted_at"),
        ...auditFields,
    },
    (t) => [
        uniqueIndex("users_email_active_uq")
            .on(sql`lower(${t.email})`)
            .where(sql`${t.deletedAt} is null`),
        index("users_role_idx").on(t.roleId),
    ],
);

// =========================================================================
// 2. UNITS & CONVERSIONS
// =========================================================================

export const uomClasses = pgTable("uom_classes", {
    uomClassId: integer("uom_class_id")
        .primaryKey()
        .generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 30 }).notNull().unique(), // Mass | Volume | Count
    ...auditFields,
});

export const uoms = pgTable(
    "uoms",
    {
        uomId: integer("uom_id").primaryKey().generatedByDefaultAsIdentity(),
        uomClassId: integer("uom_class_id")
            .notNull()
            .references(() => uomClasses.uomClassId, { onDelete: "restrict" }),
        name: varchar("name", { length: 20 }).notNull().unique(), // kg, g, pc, box...
        factorToBase: numeric("factor_to_base", {
            precision: 18,
            scale: 8,
        }).notNull(),
        isBase: boolean("is_base").default(false).notNull(),
        ...auditFields,
    },
    (t) => [
        check("uoms_factor_positive", sql`${t.factorToBase} > 0`),
        check(
            "uoms_base_factor_is_one",
            sql`not ${t.isBase} or ${t.factorToBase} = 1`,
        ),
        uniqueIndex("uoms_one_base_per_class_uq")
            .on(t.uomClassId)
            .where(sql`${t.isBase}`),
        index("uoms_class_idx").on(t.uomClassId),
    ],
);

// =========================================================================
// 3. MASTER DATA
// =========================================================================

export const items = pgTable(
    "items",
    {
        itemId: integer("item_id").primaryKey().generatedByDefaultAsIdentity(),
        sku: varchar("sku", { length: 50 }).notNull().unique(),
        name: varchar("name", { length: 120 }).notNull(),
        itemType: itemTypeEnum("item_type").notNull(),
        primaryUomId: integer("primary_uom_id")
            .notNull()
            .references(() => uoms.uomId, { onDelete: "restrict" }),

        // Useful for a sellable packed SKU such as Garlic Powder 100g.
        netWeightG: numeric("net_weight_g", { precision: 12, scale: 4 }),
        shelfLifeDays: integer("shelf_life_days"),

        // If true, receiving should create the lot in Quarantine until approved.
        requiresQc: boolean("requires_qc").default(false).notNull(),

        // Current/reference cost. Historical actual cost is stored on the lot.
        unitCost: money("unit_cost").default("0").notNull(),
        isActive: boolean("is_active").default(true).notNull(),
        ...auditFields,
    },
    (t) => [
        check(
            "items_net_weight_nonneg",
            sql`${t.netWeightG} is null or ${t.netWeightG} >= 0`,
        ),
        check(
            "items_shelf_life_pos",
            sql`${t.shelfLifeDays} is null or ${t.shelfLifeDays} > 0`,
        ),
        check("items_unit_cost_nonneg", sql`${t.unitCost} >= 0`),
        index("items_type_idx").on(t.itemType),
        index("items_primary_uom_idx").on(t.primaryUomId),
    ],
);

export const locations = pgTable(
    "locations",
    {
        locationId: integer("location_id")
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        code: varchar("code", { length: 30 }).notNull().unique(),
        name: varchar("name", { length: 100 }).notNull(),
        locationType: locationTypeEnum("location_type").notNull(),
        isActive: boolean("is_active").default(true).notNull(),
        ...auditFields,
    },
    (t) => [
        index("locations_type_idx").on(t.locationType),
    ],
);

export const scrapReasonCodes = pgTable("scrap_reason_codes", {
    reasonId: integer("reason_id").primaryKey().generatedByDefaultAsIdentity(),
    codeName: varchar("code_name", { length: 50 }).notNull().unique(),
    category: scrapCategoryEnum("category").notNull(),
    description: text("description"),
    ...auditFields,
});

// =========================================================================
// 4. SUPPLIERS & MULTI-SUPPLIER ITEM CATALOG
// =========================================================================

export const suppliers = pgTable("suppliers", {
    supplierId: integer("supplier_id")
        .primaryKey()
        .generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    email: varchar("email", { length: 100 }),
    isActive: boolean("is_active").default(true).notNull(),
    ...auditFields,
});

// Same item can come from many suppliers.
// Price is interpreted per defaultUomId.
export const supplierItems = pgTable(
    "supplier_items",
    {
        supplierItemId: integer("supplier_item_id")
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        supplierId: integer("supplier_id")
            .notNull()
            .references(() => suppliers.supplierId, { onDelete: "cascade" }),
        itemId: integer("item_id")
            .notNull()
            .references(() => items.itemId, { onDelete: "cascade" }),
        supplierItemCode: varchar("supplier_item_code", { length: 100 }),
        defaultUomId: integer("default_uom_id").references(() => uoms.uomId, {
            onDelete: "restrict",
        }),
        defaultPrice: money("default_price"),
        leadTimeDays: integer("lead_time_days"),
        isPreferred: boolean("is_preferred").default(false).notNull(),
        isActive: boolean("is_active").default(true).notNull(),
        ...auditFields,
    },
    (t) => [
        unique("supplier_items_supplier_item_uq").on(t.supplierId, t.itemId),
        check(
            "supplier_items_price_nonneg",
            sql`${t.defaultPrice} is null or ${t.defaultPrice} >= 0`,
        ),
        check(
            "supplier_items_lead_time_nonneg",
            sql`${t.leadTimeDays} is null or ${t.leadTimeDays} >= 0`,
        ),
        uniqueIndex("supplier_items_one_preferred_per_item_uq")
            .on(t.itemId)
            .where(sql`${t.isPreferred} and ${t.isActive}`),
        index("supplier_items_item_idx").on(t.itemId),
        index("supplier_items_uom_idx").on(t.defaultUomId),
    ],
);

// =========================================================================
// 5. PACKING FORMULA / SELLING PACK CONFIGURATION
// =========================================================================

// BOM means: to make one parent finished-good unit, consume these components.
// Example: Garlic 100g Label A -> 0.100kg garlic + 1 pouch + 1 label + 1 seal.
export const billOfMaterials = pgTable(
    "bill_of_materials",
    {
        bomId: integer("bom_id").primaryKey().generatedByDefaultAsIdentity(),
        parentItemId: integer("parent_item_id")
            .notNull()
            .references(() => items.itemId, { onDelete: "cascade" }),
        componentItemId: integer("component_item_id")
            .notNull()
            .references(() => items.itemId, { onDelete: "restrict" }),
        quantity: numeric("quantity", { precision: 14, scale: 6 }).notNull(),
        uomId: integer("uom_id")
            .notNull()
            .references(() => uoms.uomId, { onDelete: "restrict" }),
        ...auditFields,
    },
    (t) => [
        unique("bom_parent_component_uq").on(t.parentItemId, t.componentItemId),
        check("bom_qty_positive", sql`${t.quantity} > 0`),
        check(
            "bom_no_self_reference",
            sql`${t.parentItemId} <> ${t.componentItemId}`,
        ),
        index("bom_uom_idx").on(t.uomId),
        index("bom_component_idx").on(t.componentItemId),
    ],
);

// This table is for handling/selling packs (box/case/barcode), not BOM materials.
export const itemPackaging = pgTable(
    "item_packaging",
    {
        packagingId: integer("packaging_id")
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        itemId: integer("item_id")
            .notNull()
            .references(() => items.itemId, { onDelete: "cascade" }),
        uomId: integer("uom_id")
            .notNull()
            .references(() => uoms.uomId, { onDelete: "restrict" }),
        baseQty: qty("base_qty").notNull(),
        barcode: varchar("barcode", { length: 50 }).unique(),
        grossWeightG: numeric("gross_weight_g", { precision: 12, scale: 4 }),
        ...auditFields,
    },
    (t) => [
        unique("item_packaging_item_uom_uq").on(t.itemId, t.uomId),
        check("item_packaging_base_qty_pos", sql`${t.baseQty} > 0`),
        check(
            "item_packaging_gross_weight_nonneg",
            sql`${t.grossWeightG} is null or ${t.grossWeightG} >= 0`,
        ),
        index("item_packaging_uom_idx").on(t.uomId),
    ],
);

// =========================================================================
// 6. PURCHASING
// =========================================================================

export const purchaseOrders = pgTable(
    "purchase_orders",
    {
        poId: integer("po_id").primaryKey().generatedByDefaultAsIdentity(),
        poNumber: varchar("po_number", { length: 30 }).notNull().unique(),
        supplierId: integer("supplier_id")
            .notNull()
            .references(() => suppliers.supplierId, { onDelete: "restrict" }),
        status: poStatusEnum("status").default("Draft").notNull(),
        orderDate: tz("order_date").defaultNow().notNull(),
        expectedDeliveryDate: date("expected_delivery_date"),
        notes: text("notes"),
        ...auditFields,
    },
    (t) => [
        index("po_supplier_idx").on(t.supplierId),
        index("po_status_idx").on(t.status),
        index("po_order_date_idx").on(t.orderDate),
    ],
);

export const purchaseOrderLines = pgTable(
    "purchase_order_lines",
    {
        poLineId: integer("po_line_id")
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        poId: integer("po_id")
            .notNull()
            .references(() => purchaseOrders.poId, { onDelete: "cascade" }),
        itemId: integer("item_id")
            .notNull()
            .references(() => items.itemId, { onDelete: "restrict" }),
        // UOM as purchased from this supplier (kg, pc, box, sack, etc.).
        uomId: integer("uom_id")
            .notNull()
            .references(() => uoms.uomId, { onDelete: "restrict" }),
        qtyOrdered: qty("qty_ordered").notNull(),
        qtyReceived: qty("qty_received").default("0").notNull(),
        unitPrice: money("unit_price").notNull(),
        ...auditFields,
    },
    (t) => [
        unique("pol_po_item_uom_uq").on(t.poId, t.itemId, t.uomId),
        check("pol_qty_ordered_pos", sql`${t.qtyOrdered} > 0`),
        check("pol_qty_received_nonneg", sql`${t.qtyReceived} >= 0`),
        check(
            "pol_qty_received_lte_ordered",
            sql`${t.qtyReceived} <= ${t.qtyOrdered}`,
        ),
        check("pol_unit_price_nonneg", sql`${t.unitPrice} >= 0`),
        index("pol_item_idx").on(t.itemId),
        index("pol_uom_idx").on(t.uomId),
    ],
);

// =========================================================================
// 7. PACKING ORDERS
// =========================================================================

export const packingOrders = pgTable(
    "packing_orders",
    {
        packingOrderId: integer("packing_order_id")
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        packingOrderNumber: varchar("packing_order_number", { length: 30 })
            .notNull()
            .unique(),
        // Finished-good SKU to produce.
        itemId: integer("item_id")
            .notNull()
            .references(() => items.itemId, { onDelete: "restrict" }),
        targetQty: qty("target_qty").notNull(),
        actualQty: qty("actual_qty").default("0").notNull(),
        status: packingOrderStatusEnum("status").default("Draft").notNull(),

        // Materials are reserved/consumed from this location.
        sourceLocationId: integer("source_location_id")
            .notNull()
            .references(() => locations.locationId, { onDelete: "restrict" }),

        // Finished goods are produced into this location.
        destinationLocationId: integer("destination_location_id")
            .notNull()
            .references(() => locations.locationId, { onDelete: "restrict" }),

        scheduledDate: date("scheduled_date"),
        startedAt: tz("started_at"),
        completedAt: tz("completed_at"),
        notes: text("notes"),
        ...auditFields,
    },
    (t) => [
        check("packing_target_qty_pos", sql`${t.targetQty} > 0`),
        check("packing_actual_qty_nonneg", sql`${t.actualQty} >= 0`),
        check(
            "packing_dates_valid",
            sql`${t.completedAt} is null or ${t.startedAt} is null or ${t.completedAt} >= ${t.startedAt}`,
        ),
        index("packing_item_idx").on(t.itemId),
        index("packing_source_location_idx").on(t.sourceLocationId),
        index("packing_destination_location_idx").on(t.destinationLocationId),
        index("packing_status_idx").on(t.status),
        index("packing_scheduled_idx").on(t.scheduledDate),
    ],
);

// Snapshot of the BOM requirements when the packing order is created.
// Historical packing orders therefore do not change when the BOM changes later.
export const packingOrderMaterials = pgTable(
    "packing_order_materials",
    {
        packingOrderMaterialId: integer("packing_order_material_id")
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        packingOrderId: integer("packing_order_id")
            .notNull()
            .references(() => packingOrders.packingOrderId, {
                onDelete: "cascade",
            }),
        itemId: integer("item_id")
            .notNull()
            .references(() => items.itemId, { onDelete: "restrict" }),
        uomId: integer("uom_id")
            .notNull()
            .references(() => uoms.uomId, { onDelete: "restrict" }),
        requiredQty: qty("required_qty").notNull(),
        consumedQty: qty("consumed_qty").default("0").notNull(),
        ...auditFields,
    },
    (t) => [
        unique("packing_material_order_item_uq").on(t.packingOrderId, t.itemId),
        check("packing_material_required_pos", sql`${t.requiredQty} > 0`),
        check("packing_material_consumed_nonneg", sql`${t.consumedQty} >= 0`),
        index("packing_material_uom_idx").on(t.uomId),
        index("packing_material_item_idx").on(t.itemId),
    ],
);

// =========================================================================
// 8. LOTS / BATCH TRACEABILITY
// =========================================================================

export const lots = pgTable(
    "lots",
    {
        lotId: integer("lot_id").primaryKey().generatedByDefaultAsIdentity(),
        // Internal lot number. Create one even if the supplier has no lot number.
        lotNumber: varchar("lot_number", { length: 100 }).notNull().unique(),
        supplierLotNumber: varchar("supplier_lot_number", { length: 100 }),
        itemId: integer("item_id")
            .notNull()
            .references(() => items.itemId, { onDelete: "restrict" }),

        // Purchased lot OR packed-output lot. Opening balance may have neither.
        poLineId: integer("po_line_id").references(
            () => purchaseOrderLines.poLineId,
            { onDelete: "restrict" },
        ),
        packingOrderId: integer("packing_order_id").references(
            () => packingOrders.packingOrderId,
            { onDelete: "restrict" },
        ),

        // Optional because labels/pouches may not have meaningful dates.
        manufactureDate: date("manufacture_date"),
        expirationDate: date("expiration_date"),

        // Fail-safe default. Receiving service may immediately set Approved
        // for items where requiresQc = false.
        qcStatus: qcStatusEnum("qc_status").default("Quarantine").notNull(),

        // Actual cost per item's primary UOM at receipt/packing time.
        unitCost: money("unit_cost"),
        ...auditFields,
    },
    (t) => [
        unique("lots_lot_item_uq").on(t.lotId, t.itemId),
        check(
            "lots_dates_valid",
            sql`${t.expirationDate} is null or ${t.manufactureDate} is null or ${t.expirationDate} > ${t.manufactureDate}`,
        ),
        check(
            "lots_single_source",
            sql`num_nonnulls(${t.poLineId}, ${t.packingOrderId}) <= 1`,
        ),
        check(
            "lots_unit_cost_nonneg",
            sql`${t.unitCost} is null or ${t.unitCost} >= 0`,
        ),
        index("lots_item_idx").on(t.itemId),
        index("lots_supplier_lot_idx").on(t.supplierLotNumber),
        index("lots_po_line_idx").on(t.poLineId),
        index("lots_packing_order_idx").on(t.packingOrderId),
        index("lots_expiry_idx").on(t.expirationDate),
        index("lots_qc_idx").on(t.qcStatus),
    ],
);

// =========================================================================
// 9. INVENTORY BALANCE & PACKING RESERVATIONS
// =========================================================================

// Current balance projection. All quantities are stored in the item's primary UOM.
// The append-only inventory_transactions table remains the audit/source ledger.
export const inventoryStock = pgTable(
    "inventory_stock",
    {
        stockId: integer("stock_id").primaryKey().generatedByDefaultAsIdentity(),
        itemId: integer("item_id").notNull(),
        lotId: integer("lot_id").notNull(),
        locationId: integer("location_id")
            .notNull()
            .references(() => locations.locationId, { onDelete: "restrict" }),
        qtyOnHand: qty("qty_on_hand").default("0").notNull(),
        lastUpdated: tz("last_updated")
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [
        foreignKey({
            name: "stock_lot_item_fk",
            columns: [t.lotId, t.itemId],
            foreignColumns: [lots.lotId, lots.itemId],
        }),
        unique("stock_lot_location_uq").on(t.lotId, t.locationId),
        check("stock_on_hand_nonneg", sql`${t.qtyOnHand} >= 0`),
        index("stock_item_location_idx").on(t.itemId, t.locationId),
        index("stock_location_idx").on(t.locationId),
    ],
);

// Explicit reservations prevent two packing orders from promising the same stock.
// Available = qtyOnHand - SUM(qtyReserved - qtyConsumed for unreleased reservations).
export const inventoryReservations = pgTable(
    "inventory_reservations",
    {
        reservationId: integer("reservation_id")
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        packingOrderMaterialId: integer("packing_order_material_id")
            .notNull()
            .references(() => packingOrderMaterials.packingOrderMaterialId, {
                onDelete: "cascade",
            }),
        itemId: integer("item_id").notNull(),
        lotId: integer("lot_id").notNull(),
        locationId: integer("location_id")
            .notNull()
            .references(() => locations.locationId, { onDelete: "restrict" }),
        qtyReserved: qty("qty_reserved").notNull(),
        qtyConsumed: qty("qty_consumed").default("0").notNull(),
        releasedAt: tz("released_at"),
        ...auditFields,
    },
    (t) => [
        foreignKey({
            name: "reservation_lot_item_fk",
            columns: [t.lotId, t.itemId],
            foreignColumns: [lots.lotId, lots.itemId],
        }),
        unique("reservation_material_lot_location_uq").on(
            t.packingOrderMaterialId,
            t.lotId,
            t.locationId,
        ),
        check("reservation_qty_pos", sql`${t.qtyReserved} > 0`),
        check("reservation_consumed_nonneg", sql`${t.qtyConsumed} >= 0`),
        check(
            "reservation_consumed_lte_reserved",
            sql`${t.qtyConsumed} <= ${t.qtyReserved}`,
        ),
        index("reservation_item_location_idx").on(t.itemId, t.locationId),
        index("reservation_lot_idx").on(t.lotId),
        // Only active reservations count against availability.
        index("reservation_active_idx")
            .on(t.lotId, t.locationId)
            .where(sql`${t.releasedAt} is null`),
    ],
);

// =========================================================================
// 10. STOCK TRANSFERS (WAREHOUSE -> WAREHOUSE / BRANCH / STORE)
// =========================================================================

export const stockTransfers = pgTable(
    "stock_transfers",
    {
        transferId: integer("transfer_id")
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        transferNumber: varchar("transfer_number", { length: 30 })
            .notNull()
            .unique(),
        sourceLocationId: integer("source_location_id")
            .notNull()
            .references(() => locations.locationId, { onDelete: "restrict" }),
        destinationLocationId: integer("destination_location_id")
            .notNull()
            .references(() => locations.locationId, { onDelete: "restrict" }),
        status: transferStatusEnum("status").default("Draft").notNull(),
        requestedAt: tz("requested_at").defaultNow().notNull(),
        dispatchedAt: tz("dispatched_at"),
        receivedAt: tz("received_at"),
        notes: text("notes"),
        ...auditFields,
    },
    (t) => [
        check(
            "transfer_locations_different",
            sql`${t.sourceLocationId} <> ${t.destinationLocationId}`,
        ),
        check(
            "transfer_dates_valid",
            sql`(${t.dispatchedAt} is null or ${t.dispatchedAt} >= ${t.requestedAt})
                and (${t.receivedAt} is null or ${t.dispatchedAt} is null or ${t.receivedAt} >= ${t.dispatchedAt})`,
        ),
        index("transfer_source_idx").on(t.sourceLocationId),
        index("transfer_destination_idx").on(t.destinationLocationId),
        index("transfer_status_idx").on(t.status),
        index("transfer_requested_idx").on(t.requestedAt),
    ],
);

export const stockTransferLines = pgTable(
    "stock_transfer_lines",
    {
        transferLineId: integer("transfer_line_id")
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        transferId: integer("transfer_id")
            .notNull()
            .references(() => stockTransfers.transferId, { onDelete: "cascade" }),
        itemId: integer("item_id").notNull(),
        lotId: integer("lot_id").notNull(),
        qtyRequested: qty("qty_requested").notNull(),
        qtyShipped: qty("qty_shipped").default("0").notNull(),
        qtyReceived: qty("qty_received").default("0").notNull(),
        ...auditFields,
    },
    (t) => [
        foreignKey({
            name: "transfer_line_lot_item_fk",
            columns: [t.lotId, t.itemId],
            foreignColumns: [lots.lotId, lots.itemId],
        }),
        unique("transfer_line_transfer_lot_uq").on(t.transferId, t.lotId),
        check("transfer_line_requested_pos", sql`${t.qtyRequested} > 0`),
        check("transfer_line_shipped_nonneg", sql`${t.qtyShipped} >= 0`),
        check("transfer_line_received_nonneg", sql`${t.qtyReceived} >= 0`),
        check(
            "transfer_line_shipped_lte_requested",
            sql`${t.qtyShipped} <= ${t.qtyRequested}`,
        ),
        check(
            "transfer_line_received_lte_shipped",
            sql`${t.qtyReceived} <= ${t.qtyShipped}`,
        ),
        index("transfer_line_item_idx").on(t.itemId),
        index("transfer_line_lot_idx").on(t.lotId),
    ],
);

// =========================================================================
// 11. APPEND-ONLY INVENTORY LEDGER
// =========================================================================

// Never UPDATE/DELETE ledger rows. Reverse mistakes with a new correcting row.
// Inventory quantities are stored in the item's primary UOM.
//
// Transfer recommendation:
//   dispatch: source -> one system "In Transit" location
//   receipt:  "In Transit" -> destination
// This keeps company-wide stock correct while goods are physically moving.
export const inventoryTransactions = pgTable(
    "inventory_transactions",
    {
        transactionId: integer("transaction_id")
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        itemId: integer("item_id").notNull(),
        lotId: integer("lot_id").notNull(),
        locationId: integer("location_id")
            .notNull()
            .references(() => locations.locationId, { onDelete: "restrict" }),
        qtyChange: qty("qty_change").notNull(),
        transactionType: transactionTypeEnum("transaction_type").notNull(),

        // Traceability links
        packingOrderId: integer("packing_order_id").references(
            () => packingOrders.packingOrderId,
            { onDelete: "restrict" },
        ),
        reasonId: integer("reason_id").references(() => scrapReasonCodes.reasonId, {
            onDelete: "restrict",
        }),
        poLineId: integer("po_line_id").references(
            () => purchaseOrderLines.poLineId,
            { onDelete: "restrict" },
        ),
        transferLineId: integer("transfer_line_id").references(
            () => stockTransferLines.transferLineId,
            { onDelete: "restrict" },
        ),
        referenceId: varchar("reference_id", { length: 60 }),

        authorizedByUserId: integer("authorized_by_user_id")
            .notNull()
            .references(() => users.userId, { onDelete: "restrict" }),
        createdAt: tz("created_at").defaultNow().notNull(),
    },
    (t) => [
        foreignKey({
            name: "txn_lot_item_fk",
            columns: [t.lotId, t.itemId],
            foreignColumns: [lots.lotId, lots.itemId],
        }),
        check("txn_qty_nonzero", sql`${t.qtyChange} <> 0`),
        check(
            "txn_sign_matches_type",
            sql`(
                (${t.transactionType} in ('Receive', 'Produce') and ${t.qtyChange} > 0)
                or (${t.transactionType} in ('Consume', 'Scrap') and ${t.qtyChange} < 0)
                or (${t.transactionType} in ('Transfer', 'Adjustment'))
            )`,
        ),
        check(
            "txn_required_links",
            sql`(
                (${t.transactionType} <> 'Receive' or ${t.poLineId} is not null)
                and (${t.transactionType} not in ('Consume', 'Produce') or ${t.packingOrderId} is not null)
                and (${t.transactionType} not in ('Scrap', 'Adjustment') or ${t.reasonId} is not null)
                and (${t.transactionType} <> 'Transfer' or ${t.transferLineId} is not null)
            )`,
        ),
        index("txn_lot_created_idx").on(t.lotId, t.createdAt),
        index("txn_item_created_idx").on(t.itemId, t.createdAt),
        index("txn_location_created_idx").on(t.locationId, t.createdAt),
        index("txn_packing_order_idx").on(t.packingOrderId),
        index("txn_po_line_idx").on(t.poLineId),
        index("txn_transfer_line_idx").on(t.transferLineId),
        index("txn_reason_idx").on(t.reasonId),
        index("txn_user_idx").on(t.authorizedByUserId),
    ],
);

// =========================================================================
// 12. TYPESCRIPT INFERENCES
// =========================================================================

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type UOMClass = typeof uomClasses.$inferSelect;
export type NewUOMClass = typeof uomClasses.$inferInsert;
export type UOM = typeof uoms.$inferSelect;
export type NewUOM = typeof uoms.$inferInsert;

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type ScrapReason = typeof scrapReasonCodes.$inferSelect;
export type NewScrapReason = typeof scrapReasonCodes.$inferInsert;

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type SupplierItem = typeof supplierItems.$inferSelect;
export type NewSupplierItem = typeof supplierItems.$inferInsert;

export type BillOfMaterial = typeof billOfMaterials.$inferSelect;
export type NewBillOfMaterial = typeof billOfMaterials.$inferInsert;
export type ItemPackaging = typeof itemPackaging.$inferSelect;
export type NewItemPackaging = typeof itemPackaging.$inferInsert;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect;
export type NewPurchaseOrderLine = typeof purchaseOrderLines.$inferInsert;

export type PackingOrder = typeof packingOrders.$inferSelect;
export type NewPackingOrder = typeof packingOrders.$inferInsert;
export type PackingOrderMaterial = typeof packingOrderMaterials.$inferSelect;
export type NewPackingOrderMaterial = typeof packingOrderMaterials.$inferInsert;

export type Lot = typeof lots.$inferSelect;
export type NewLot = typeof lots.$inferInsert;
export type InventoryStock = typeof inventoryStock.$inferSelect;
export type NewInventoryStock = typeof inventoryStock.$inferInsert;
export type InventoryReservation = typeof inventoryReservations.$inferSelect;
export type NewInventoryReservation = typeof inventoryReservations.$inferInsert;

export type StockTransfer = typeof stockTransfers.$inferSelect;
export type NewStockTransfer = typeof stockTransfers.$inferInsert;
export type StockTransferLine = typeof stockTransferLines.$inferSelect;
export type NewStockTransferLine = typeof stockTransferLines.$inferInsert;

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type NewInventoryTransaction = typeof inventoryTransactions.$inferInsert;

// =========================================================================
// 13. RELATIONAL TYPES
// =========================================================================

export type TransactionWithRelations = InventoryTransaction & {
    authorizedBy: User;
    lot: Lot;
    item: Item;
};

export type LotWithRelations = Lot & {
    item: Item;
    poLine?: PurchaseOrderLine | null;
    packingOrder?: PackingOrder | null;
};

// =========================================================================
// 14. DRIZZLE RELATIONS (RELATIONAL QUERIES V2)
// =========================================================================

// Usage: drizzle(client, { relations: dbRelations })
export const dbRelations = defineRelations(
    {
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
    },
    (r) => ({
        // ----- Auth -----
        roles: {
            users: r.many.users(),
        },
        users: {
            role: r.one.roles({
                from: r.users.roleId,
                to: r.roles.roleId,
            }),
            transactions: r.many.inventoryTransactions(),
        },

        // ----- UOM -----
        uomClasses: {
            uoms: r.many.uoms(),
        },
        uoms: {
            uomClass: r.one.uomClasses({
                from: r.uoms.uomClassId,
                to: r.uomClasses.uomClassId,
            }),
            items: r.many.items(),
            supplierItems: r.many.supplierItems(),
            billOfMaterials: r.many.billOfMaterials(),
            itemPackaging: r.many.itemPackaging(),
            purchaseOrderLines: r.many.purchaseOrderLines(),
            packingOrderMaterials: r.many.packingOrderMaterials(),
        },

        // ----- Items -----
        items: {
            primaryUom: r.one.uoms({
                from: r.items.primaryUomId,
                to: r.uoms.uomId,
            }),
            suppliers: r.many.supplierItems(),
            parentBillOfMaterials: r.many.billOfMaterials({
                from: r.items.itemId,
                to: r.billOfMaterials.parentItemId,
                alias: "bom_parent",
            }),
            componentBillOfMaterials: r.many.billOfMaterials({
                from: r.items.itemId,
                to: r.billOfMaterials.componentItemId,
                alias: "bom_component",
            }),
            packaging: r.many.itemPackaging(),
            purchaseOrderLines: r.many.purchaseOrderLines(),
            packingOrders: r.many.packingOrders(),
            packingOrderMaterials: r.many.packingOrderMaterials(),
            lots: r.many.lots(),
            stock: r.many.inventoryStock(),
            reservations: r.many.inventoryReservations(),
            transferLines: r.many.stockTransferLines(),
            transactions: r.many.inventoryTransactions(),
        },

        // ----- Locations -----
        locations: {
            sourcePackingOrders: r.many.packingOrders({
                from: r.locations.locationId,
                to: r.packingOrders.sourceLocationId,
                alias: "packing_source",
            }),
            destinationPackingOrders: r.many.packingOrders({
                from: r.locations.locationId,
                to: r.packingOrders.destinationLocationId,
                alias: "packing_destination",
            }),
            sourceTransfers: r.many.stockTransfers({
                from: r.locations.locationId,
                to: r.stockTransfers.sourceLocationId,
                alias: "transfer_source",
            }),
            destinationTransfers: r.many.stockTransfers({
                from: r.locations.locationId,
                to: r.stockTransfers.destinationLocationId,
                alias: "transfer_destination",
            }),
            stock: r.many.inventoryStock(),
            reservations: r.many.inventoryReservations(),
            transactions: r.many.inventoryTransactions(),
        },

        scrapReasonCodes: {
            transactions: r.many.inventoryTransactions(),
        },

        // ----- Suppliers -----
        suppliers: {
            items: r.many.supplierItems(),
            purchaseOrders: r.many.purchaseOrders(),
        },
        supplierItems: {
            supplier: r.one.suppliers({
                from: r.supplierItems.supplierId,
                to: r.suppliers.supplierId,
            }),
            item: r.one.items({
                from: r.supplierItems.itemId,
                to: r.items.itemId,
            }),
            defaultUom: r.one.uoms({
                from: r.supplierItems.defaultUomId,
                to: r.uoms.uomId,
            }),
        },

        // ----- BOM & packaging -----
        billOfMaterials: {
            parentItem: r.one.items({
                from: r.billOfMaterials.parentItemId,
                to: r.items.itemId,
                alias: "bom_parent",
            }),
            componentItem: r.one.items({
                from: r.billOfMaterials.componentItemId,
                to: r.items.itemId,
                alias: "bom_component",
            }),
            uom: r.one.uoms({
                from: r.billOfMaterials.uomId,
                to: r.uoms.uomId,
            }),
        },
        itemPackaging: {
            item: r.one.items({
                from: r.itemPackaging.itemId,
                to: r.items.itemId,
            }),
            uom: r.one.uoms({
                from: r.itemPackaging.uomId,
                to: r.uoms.uomId,
            }),
        },

        // ----- Purchasing -----
        purchaseOrders: {
            supplier: r.one.suppliers({
                from: r.purchaseOrders.supplierId,
                to: r.suppliers.supplierId,
            }),
            lines: r.many.purchaseOrderLines(),
        },
        purchaseOrderLines: {
            purchaseOrder: r.one.purchaseOrders({
                from: r.purchaseOrderLines.poId,
                to: r.purchaseOrders.poId,
            }),
            item: r.one.items({
                from: r.purchaseOrderLines.itemId,
                to: r.items.itemId,
            }),
            uom: r.one.uoms({
                from: r.purchaseOrderLines.uomId,
                to: r.uoms.uomId,
            }),
            lots: r.many.lots(),
            transactions: r.many.inventoryTransactions(),
        },

        // ----- Packing -----
        packingOrders: {
            item: r.one.items({
                from: r.packingOrders.itemId,
                to: r.items.itemId,
            }),
            sourceLocation: r.one.locations({
                from: r.packingOrders.sourceLocationId,
                to: r.locations.locationId,
                alias: "packing_source",
            }),
            destinationLocation: r.one.locations({
                from: r.packingOrders.destinationLocationId,
                to: r.locations.locationId,
                alias: "packing_destination",
            }),
            materials: r.many.packingOrderMaterials(),
            lots: r.many.lots(),
            transactions: r.many.inventoryTransactions(),
        },
        packingOrderMaterials: {
            packingOrder: r.one.packingOrders({
                from: r.packingOrderMaterials.packingOrderId,
                to: r.packingOrders.packingOrderId,
            }),
            item: r.one.items({
                from: r.packingOrderMaterials.itemId,
                to: r.items.itemId,
            }),
            uom: r.one.uoms({
                from: r.packingOrderMaterials.uomId,
                to: r.uoms.uomId,
            }),
            reservations: r.many.inventoryReservations(),
        },

        // ----- Lots / stock / reservations -----
        lots: {
            item: r.one.items({
                from: r.lots.itemId,
                to: r.items.itemId,
            }),
            poLine: r.one.purchaseOrderLines({
                from: r.lots.poLineId,
                to: r.purchaseOrderLines.poLineId,
            }),
            packingOrder: r.one.packingOrders({
                from: r.lots.packingOrderId,
                to: r.packingOrders.packingOrderId,
            }),
            stock: r.many.inventoryStock(),
            reservations: r.many.inventoryReservations(),
            transferLines: r.many.stockTransferLines(),
            transactions: r.many.inventoryTransactions(),
        },
        inventoryStock: {
            item: r.one.items({
                from: r.inventoryStock.itemId,
                to: r.items.itemId,
            }),
            lot: r.one.lots({
                from: r.inventoryStock.lotId,
                to: r.lots.lotId,
            }),
            location: r.one.locations({
                from: r.inventoryStock.locationId,
                to: r.locations.locationId,
            }),
        },
        inventoryReservations: {
            packingOrderMaterial: r.one.packingOrderMaterials({
                from: r.inventoryReservations.packingOrderMaterialId,
                to: r.packingOrderMaterials.packingOrderMaterialId,
            }),
            item: r.one.items({
                from: r.inventoryReservations.itemId,
                to: r.items.itemId,
            }),
            lot: r.one.lots({
                from: r.inventoryReservations.lotId,
                to: r.lots.lotId,
            }),
            location: r.one.locations({
                from: r.inventoryReservations.locationId,
                to: r.locations.locationId,
            }),
        },

        // ----- Transfers -----
        stockTransfers: {
            sourceLocation: r.one.locations({
                from: r.stockTransfers.sourceLocationId,
                to: r.locations.locationId,
                alias: "transfer_source",
            }),
            destinationLocation: r.one.locations({
                from: r.stockTransfers.destinationLocationId,
                to: r.locations.locationId,
                alias: "transfer_destination",
            }),
            lines: r.many.stockTransferLines(),
        },
        stockTransferLines: {
            transfer: r.one.stockTransfers({
                from: r.stockTransferLines.transferId,
                to: r.stockTransfers.transferId,
            }),
            item: r.one.items({
                from: r.stockTransferLines.itemId,
                to: r.items.itemId,
            }),
            lot: r.one.lots({
                from: r.stockTransferLines.lotId,
                to: r.lots.lotId,
            }),
            transactions: r.many.inventoryTransactions(),
        },

        // ----- Ledger -----
        inventoryTransactions: {
            item: r.one.items({
                from: r.inventoryTransactions.itemId,
                to: r.items.itemId,
            }),
            lot: r.one.lots({
                from: r.inventoryTransactions.lotId,
                to: r.lots.lotId,
            }),
            location: r.one.locations({
                from: r.inventoryTransactions.locationId,
                to: r.locations.locationId,
            }),
            packingOrder: r.one.packingOrders({
                from: r.inventoryTransactions.packingOrderId,
                to: r.packingOrders.packingOrderId,
            }),
            reason: r.one.scrapReasonCodes({
                from: r.inventoryTransactions.reasonId,
                to: r.scrapReasonCodes.reasonId,
            }),
            poLine: r.one.purchaseOrderLines({
                from: r.inventoryTransactions.poLineId,
                to: r.purchaseOrderLines.poLineId,
            }),
            transferLine: r.one.stockTransferLines({
                from: r.inventoryTransactions.transferLineId,
                to: r.stockTransferLines.transferLineId,
            }),
            authorizedBy: r.one.users({
                from: r.inventoryTransactions.authorizedByUserId,
                to: r.users.userId,
            }),
        },
    }),
);
