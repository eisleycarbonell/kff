import { pgEnum, pgTable, integer, serial, varchar, text, numeric, boolean, jsonb, timestamp, date, foreignKey, primaryKey, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const itemTypeEnum = pgEnum("item_type_enum", ["Raw Material - Bulk", "Packaging - Hardware", "Packaging - Label", "WIP", "Finished Good"])
export const locationTypeEnum = pgEnum("location_type_enum", ["Receiving", "Storage", "Production", "Quarantine", "Scrap"])
export const scrapCategoryEnum = pgEnum("scrap_category_enum", ["Material Defect", "Process Failure", "Spoilage", "Moisture Loss"])
export const poStatusEnum = pgEnum("po_status_enum", ["Draft", "Sent", "Partially Received", "Completed", "Cancelled"])
export const workOrderStatusEnum = pgEnum("work_order_status_enum", ["Planned", "In Progress", "Completed", "Cancelled"])
export const qcStatusEnum = pgEnum("qc_status_enum", ["Quarantine", "Approved", "Rejected", "Expired"])
export const transactionTypeEnum = pgEnum("transaction_type_enum", ["Receive", "Fulfill", "Consume", "Produce", "Scrap", "Transfer"])


export const billOfMaterials = pgTable("bill_of_materials", {
	bomId: integer("bom_id").primaryKey().generatedByDefaultAsIdentity(),
	parentItemId: integer("parent_item_id").notNull().references(() => items.itemId),
	componentItemId: integer("component_item_id").notNull().references(() => items.itemId),
	quantity: numeric({ precision: 10, scale: 6 }).notNull(),
	uomId: integer("uom_id").notNull().references(() => uomClasses.uomId),
});

export const inventoryStock = pgTable("inventory_stock", {
	stockId: integer("stock_id").primaryKey().generatedByDefaultAsIdentity(),
	itemId: integer("item_id").notNull().references(() => items.itemId),
	lotId: integer("lot_id").notNull().references(() => lots.lotId),
	locationId: integer("location_id").notNull().references(() => locations.locationId),
	qtyOnHand: numeric("qty_on_hand", { mode: 'number', precision: 10, scale: 4 }).default(0.0000),
	qtyAllocated: numeric("qty_allocated", { mode: 'number', precision: 10, scale: 4 }).default(0.0000),
	lastUpdated: timestamp("last_updated").default(sql`now()`),
});

export const inventoryTransactions = pgTable("inventory_transactions", {
	transactionId: integer("transaction_id").primaryKey().generatedByDefaultAsIdentity(),
	itemId: integer("item_id").notNull().references(() => items.itemId),
	lotId: integer("lot_id").notNull().references(() => lots.lotId),
	locationId: integer("location_id").notNull().references(() => locations.locationId),
	qtyChange: numeric("qty_change", { precision: 10, scale: 4 }).notNull(),
	transactionType: transactionTypeEnum("transaction_type").notNull(),
	workOrderId: integer("work_order_id").references(() => workOrders.workOrderId),
	reasonId: integer("reason_id").references(() => scrapReasonCodes.reasonId),
	poLineId: integer("po_line_id").references(() => purchaseOrderLines.poLineId),
	referenceId: varchar("reference_id", { length: 50 }),
	createdAt: timestamp("created_at").default(sql`now()`),
	authorizedByUserId: integer("authorized_by_user_id").notNull().references(() => users.id),
});

export const itemPackaging = pgTable("item_packaging", {
	packagingId: integer("packaging_id").primaryKey().generatedByDefaultAsIdentity(),
	itemId: integer("item_id").notNull().references(() => items.itemId),
	uomId: integer("uom_id").notNull().references(() => uomClasses.uomId),
	baseQty: numeric("base_qty", { precision: 10, scale: 4 }).notNull(),
	barcode: varchar({ length: 50 }),
	grossWeightG: numeric("gross_weight_g", { precision: 10, scale: 4 }),
}, (table) => [
	unique("item_packaging_barcode_key").on(table.barcode),]);

export const items = pgTable("items", {
	itemId: integer("item_id").primaryKey().generatedByDefaultAsIdentity(),
	sku: varchar({ length: 50 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	itemType: itemTypeEnum("item_type").notNull(),
	primaryUomId: integer("primary_uom_id").notNull().references(() => uomClasses.uomId),
	netWeightG: numeric("net_weight_g", { precision: 10, scale: 4 }),
	shelfLifeDays: integer("shelf_life_days"),
	unitCost: numeric("unit_cost", { mode: 'number', precision: 10, scale: 2 }).default(0.00),
}, (table) => [
	unique("items_sku_key").on(table.sku),]);

export const locations = pgTable("locations", {
	locationId: integer("location_id").primaryKey().generatedByDefaultAsIdentity(),
	name: varchar({ length: 100 }).notNull(),
	locationType: locationTypeEnum("location_type").notNull(),
});

export const lots = pgTable("lots", {
	lotId: integer("lot_id").primaryKey().generatedByDefaultAsIdentity(),
	lotNumber: varchar("lot_number", { length: 100 }).notNull(),
	itemId: integer("item_id").notNull().references(() => items.itemId),
	poLineId: integer("po_line_id").references(() => purchaseOrderLines.poLineId),
	workOrderId: integer("work_order_id").references(() => workOrders.workOrderId),
	manufactureDate: date("manufacture_date").notNull(),
	expirationDate: date("expiration_date").notNull(),
	qcStatus: qcStatusEnum("qc_status").default("Quarantine"),
}, (table) => [
	unique("lots_lot_number_key").on(table.lotNumber),]);

export const purchaseOrderLines = pgTable("purchase_order_lines", {
	poLineId: integer("po_line_id").primaryKey().generatedByDefaultAsIdentity(),
	poId: integer("po_id").notNull().references(() => purchaseOrders.poId),
	itemId: integer("item_id").notNull().references(() => items.itemId),
	packagingId: integer("packaging_id").references(() => itemPackaging.packagingId),
	qtyOrdered: numeric("qty_ordered", { precision: 10, scale: 4 }).notNull(),
	qtyReceived: numeric("qty_received", { mode: 'number', precision: 10, scale: 4 }).default(0.0000),
	unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
});

export const purchaseOrders = pgTable("purchase_orders", {
	poId: integer("po_id").primaryKey().generatedByDefaultAsIdentity(),
	supplierId: integer("supplier_id").notNull().references(() => suppliers.supplierId),
	status: poStatusEnum().default("Draft"),
	orderDate: timestamp("order_date").default(sql`now()`),
	expectedDeliveryDate: date("expected_delivery_date"),
});

export const roles = pgTable("roles", {
	id: serial().primaryKey(),
	name: text().notNull(),
	description: text(),
	settings: jsonb().default({}).notNull(),
	createdBy: integer("created_by"),
	createdDate: timestamp("created_date").default(sql`now()`).notNull(),
	updatedBy: integer("updated_by"),
	updatedDate: timestamp("updated_date").notNull(),
}, (table) => [
	unique("roles_name_key").on(table.name),]);

export const scrapReasonCodes = pgTable("scrap_reason_codes", {
	reasonId: integer("reason_id").primaryKey().generatedByDefaultAsIdentity(),
	codeName: varchar("code_name", { length: 50 }).notNull(),
	category: scrapCategoryEnum().notNull(),
});

export const suppliers = pgTable("suppliers", {
	supplierId: integer("supplier_id").primaryKey().generatedByDefaultAsIdentity(),
	name: varchar({ length: 100 }).notNull(),
	contactEmail: varchar("contact_email", { length: 100 }),
	certifiedFoodSafe: boolean("certified_food_safe").default(true),
});

export const uomClasses = pgTable("uom_classes", {
	uomId: integer("uom_id").primaryKey().generatedByDefaultAsIdentity(),
	uomName: varchar("uom_name", { length: 20 }).notNull(),
	baseUom: varchar("base_uom", { length: 20 }).notNull(),
	conversionFactor: numeric("conversion_factor", { precision: 10, scale: 6 }).notNull(),
}, (table) => [
	unique("uom_classes_uom_name_key").on(table.uomName),]);

export const users = pgTable("users", {
	id: serial().primaryKey(),
	firstName: text("first_name").notNull(),
	middleName: text("middle_name"),
	lastName: text("last_name").notNull(),
	dateOfBirth: date("date_of_birth"),
	avatarUrl: text("avatar_url"),
	mobileNumber: text("mobile_number"),
	address: text(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	isEmailVerified: boolean("is_email_verified").default(false).notNull(),
	roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "restrict" } ),
	lastLoginAt: timestamp("last_login_at"),
	deletedAt: timestamp("deleted_at"),
	createdBy: integer("created_by"),
	createdDate: timestamp("created_date").default(sql`now()`).notNull(),
	updatedBy: integer("updated_by"),
	updatedDate: timestamp("updated_date").notNull(),
}, (table) => [
	unique("users_email_key").on(table.email),]);

export const workOrders = pgTable("work_orders", {
	workOrderId: integer("work_order_id").primaryKey().generatedByDefaultAsIdentity(),
	itemId: integer("item_id").notNull().references(() => items.itemId),
	targetQty: numeric("target_qty", { precision: 10, scale: 4 }).notNull(),
	status: workOrderStatusEnum().default("Planned"),
	locationId: integer("location_id").notNull().references(() => locations.locationId),
	createdAt: timestamp("created_at").default(sql`now()`),
});
