# Spice Trading & Packing System Flow

## 1. System Purpose

This system manages the complete operational flow for a spice trading and packing business.

The business does not manufacture raw spices from scratch. Spices such as garlic powder, chili powder, and black pepper powder are already processed when purchased from suppliers.

The system mainly handles:

- Supplier purchasing
- Receiving raw spices
- Receiving packaging materials
- Receiving labels
- Lot and batch tracking
- Raw material storage
- Packing finished products
- Material reservations
- Finished goods storage
- Warehouse transfers
- Branch and store distribution
- Inventory tracking
- User and role management
- Reporting

The primary business flow is:

```text
Supplier
   ↓
Purchase Order
   ↓
Receiving
   ↓
Warehouse 1
Raw Materials + Packaging + Labels
   ↓
Packing Order
   ↓
Material Reservation
   ↓
Packing
   ↓
Finished Goods
   ↓
Warehouse 2
   ↓
Stock Transfer
   ↓
Branch / Store
```

---

# 2. Main Modules

## Dashboard

The Dashboard provides a high-level overview of the system.

Typical information:

- Total inventory value
- Raw material stock
- Finished goods stock
- Active packing orders
- Pending purchase orders
- Low-stock materials
- Items nearing expiration
- Active transfers
- Stock by location

Routes:

```text
/dashboard
```

---

# 3. Master Data

Master Data contains reusable reference information used throughout the system.

## Items

All inventory-managed products are stored as items.

Item types:

```text
Raw Material - Bulk
Packaging - Hardware
Packaging - Label
Finished Good
```

Examples:

```text
RM-GARLIC-PWD
Garlic Powder Bulk

PKG-POUCH-100G
100g Stand-up Pouch

PKG-SEAL
Tamper Seal

LBL-GARLIC-A-100G
Garlic Powder Label A 100g

FG-GARLIC-100-A
Garlic Powder 100g - Label A
```

Route:

```text
/items
```

---

## Suppliers

Suppliers provide raw spices, packaging materials, labels, and other materials.

A supplier can provide multiple items.

The same item can also come from multiple suppliers.

Example:

```text
Garlic Powder

Supplier A
Price: 110 / kg
Preferred: Yes

Supplier B
Price: 108.50 / kg
Preferred: No
```

Routes:

```text
/suppliers
```

Supplier-item relationships may contain:

```text
supplierItemCode
defaultUom
defaultPrice
leadTimeDays
isPreferred
isActive
```

---

## Locations

Locations represent places where inventory can physically exist.

Location types:

```text
Warehouse
Packing
Branch
Store
Quarantine
Scrap
In Transit
```

Example locations:

```text
WH-RM
Warehouse 1 - Raw & Packaging Materials

PACK-01
Main Packing Area

WH-FG
Warehouse 2 - Finished Goods

BR-MNL
Manila Branch

TRANSIT
Goods In Transit
```

Route:

```text
/locations
```

---

## Units of Measure

UOMs are grouped into compatible classes.

Example:

```text
Mass
├── g
└── kg

Count
├── pc
├── box
└── case
```

Each item has a primary UOM.

Inventory quantities are stored using the item's primary UOM.

Route:

```text
/uom
```

---

# 4. Packing Formula / BOM

A BOM defines the materials required to produce one finished product.

Example:

```text
FG-GARLIC-100-A
Garlic Powder 100g - Label A

Requires per 1 finished unit:

0.100 kg  Garlic Powder
1 pc      100g Pouch
1 pc      Garlic Label A
1 pc      Tamper Seal
```

Route:

```text
/bom
```

The BOM is used to calculate:

```text
Required materials
Maximum producible quantity
Packing order material requirements
Material reservations
```

Maximum producible quantity is calculated from the limiting material.

Example:

```text
Garlic Powder available:
50 kg

Requirement:
0.100 kg / unit

Possible:
500 units

Pouch available:
800 pcs

Possible:
800 units

Label available:
600 pcs

Possible:
600 units

Maximum producible:
500 units
```

Formula:

```text
maxProducible =
MIN(
    availableComponent / componentRequirement
)
```

---

# 5. Purchasing

## Purchase Order

A Purchase Order belongs to one supplier.

The PO header contains:

```text
PO Number
Supplier
Status
Order Date
Expected Delivery Date
Notes
```

Example:

```text
PO-2026-0001

Supplier:
Davao Spices Trading

Status:
Completed
```

Route:

```text
/purchase-orders
```

---

## Purchase Order Lines

A PO can contain multiple items.

Example:

```text
PO-2026-0002
Supplier: PackRight Packaging

Lines:

100g Pouch
Qty: 5,000 pcs

250g Pouch
Qty: 2,000 pcs

Tamper Seal
Qty: 7,000 pcs
```

Each line contains:

```text
item
uom
qtyOrdered
qtyReceived
unitPrice
```

Partial receiving is supported.

Example:

```text
Ordered:
100 kg

Received:
60 kg

Remaining:
40 kg
```

---

# 6. Receiving

Receiving converts purchased items into actual warehouse inventory.

Flow:

```text
Purchase Order
   ↓
PO Line
   ↓
Receive
   ↓
Create Lot
   ↓
Inventory Transaction: Receive
   ↓
Update Inventory Stock
```

Route:

```text
/receiving
```

Receiving should run inside one database transaction.

---

# 7. Lots / Batches

Every received or packed item can be tracked through a lot.

Examples:

```text
LOT-GAR-20261001-01
Garlic Powder

LOT-PCH100-20261001-01
100g Pouch

FG-GAR-A100-20261005-01
Finished Garlic Powder 100g
```

A lot may come from:

```text
Purchase Order Line
or
Packing Order
```

A purchased lot belongs to a PO line.

A finished product lot belongs to a packing order.

Lot information may contain:

```text
lotNumber
supplierLotNumber
manufactureDate
expirationDate
qcStatus
unitCost
```

Routes:

```text
/lots
/inventory/lots
```

Lot dates are optional because some materials such as labels and pouches may not have meaningful expiration dates.

---

# 8. Warehouse 1

Warehouse 1 stores:

```text
Raw spices
Pouches
Bottles
Seals
Labels
Other packing materials
```

Example:

```text
Warehouse 1

Garlic Powder        150 kg
100g Pouch          4500 pcs
Label A             2500 pcs
Label B             2000 pcs
Tamper Seal         6500 pcs
```

This inventory is used by packing orders.

---

# 9. Packing Orders

Packing Orders convert raw and packaging materials into finished goods.

Route:

```text
/packing-orders
```

Example:

```text
PK-2026-0001

Product:
Garlic Powder 100g - Label A

Target:
500 pcs

Source:
Warehouse 1

Destination:
Warehouse 2

Required:

Garlic Powder     50 kg
100g Pouch       500 pcs
Label A          500 pcs
Seal             500 pcs
```

Packing order statuses:

```text
Draft
Planned
In Progress
Completed
Cancelled
```

---

# 10. Packing Order Materials

When a packing order is created, its BOM is copied into packing order materials.

This creates a historical snapshot.

This is important because the master BOM may change later.

Example:

```text
Packing Order:
PK-2026-0001

Materials:

Garlic Powder
Required: 50 kg
Consumed: 50 kg

100g Pouch
Required: 500
Consumed: 500

Label A
Required: 500
Consumed: 500

Seal
Required: 500
Consumed: 500
```

The packing order must not depend on the live BOM after creation.

---

# 11. Inventory Reservations

Reservations prevent multiple packing orders from promising the same inventory.

Formula:

```text
Available =
On Hand
-
Active Reservations
```

Example:

```text
Garlic Powder

On Hand:
150 kg

Reserved for PK-2026-0002:
30 kg

Available:
120 kg
```

Route:

```text
/packing-orders/reservations
```

Reservation flow:

```text
Packing Order Planned
   ↓
Calculate Requirements
   ↓
Reserve Materials
   ↓
Packing Starts
   ↓
Reserved Qty becomes Consumed Qty
   ↓
Release unused reservation
```

Reservations are linked to:

```text
Packing Order Material
Item
Lot
Location
Reserved Quantity
Consumed Quantity
```

---

# 12. Packing Completion

When packing is completed:

```text
Warehouse 1
   ↓
Consume materials

Garlic Powder    -50 kg
Pouch           -500 pcs
Label           -500 pcs
Seal            -500 pcs

        ↓

Packing Order

        ↓

Warehouse 2

Finished Product
+500 pcs
```

Inventory transactions:

```text
Consume Garlic Powder
Consume Pouch
Consume Label
Consume Seal

Produce Finished Product
```

A new finished-product lot is created.

Example:

```text
FG-GAR-A100-20261005-01
```

The entire completion process must run in one database transaction.

---

# 13. Inventory

## Inventory Stock

`inventory_stock` stores the current stock balance.

Inventory is tracked by:

```text
Item
Lot
Location
```

Example:

```text
Item:
FG-GARLIC-100-A

Lot:
FG-GAR-A100-20261005-01

Location:
Warehouse 2

Qty On Hand:
300 pcs
```

Routes:

```text
/inventory
/inventory/locations
/inventory/lots
```

---

## Inventory Transactions

`inventory_transactions` is the append-only inventory ledger.

Never update or delete inventory transactions.

Incorrect transactions must be corrected by creating another transaction.

Supported transaction types:

```text
Receive
Consume
Produce
Transfer
Scrap
Adjustment
```

Route:

```text
/inventory/transactions
```

Example:

```text
+200 kg  Receive Garlic
-50 kg   Consume Garlic
+500 pc  Produce Garlic 100g
-200 pc  Transfer from Warehouse 2
+200 pc  Transfer to Manila Branch
```

The ledger explains why the current stock exists.

---

# 14. Inventory Adjustments

Adjustments are used when physical stock does not match system stock.

Examples:

```text
Physical count correction
Damaged inventory
Missing inventory
Expired stock
```

Route:

```text
/inventory/adjustments
```

Adjustments must create inventory transactions.

Never directly modify historical ledger transactions.

---

# 15. Stock Transfers

Finished goods can be transferred from Warehouse 2 to branches or stores.

Route:

```text
/transfers
```

Example:

```text
TR-2026-0001

Source:
Warehouse 2

Destination:
Manila Branch

Product:
Garlic Powder 100g Label A

Requested:
200 pcs

Shipped:
200 pcs

Received:
200 pcs
```

Transfer statuses:

```text
Draft
In Transit
Completed
Cancelled
```

---

# 16. In Transit Inventory

When goods leave a warehouse but have not yet reached the branch, they should remain part of company inventory.

Recommended flow:

```text
Warehouse 2
    ↓
Dispatch
    ↓
In Transit
    ↓
Branch Receives
    ↓
Manila Branch
```

Inventory ledger example:

```text
Warehouse 2
-200 pcs

In Transit
+200 pcs
```

Then after receiving:

```text
In Transit
-200 pcs

Manila Branch
+200 pcs
```

Route:

```text
/transfers/in-transit
```

This prevents stock from disappearing while physically being transported.

---

# 17. Branch / Store Inventory

Branches and stores are normal inventory locations.

Example:

```text
Manila Branch

Garlic Powder 100g A
200 pcs
```

Branch stock uses the same inventory tables as warehouses.

Do not create separate inventory logic for branches.

Use:

```text
inventory_stock
inventory_transactions
locations
```

---

# 18. Reports

Reports should be derived from operational data.

Routes:

```text
/reports/inventory
/reports/packing
/reports/purchasing
/reports/transfers
```

Useful reports include:

```text
Stock by Location
Stock by Lot
Low Stock
Near Expiry
Inventory Movement
Material Consumption
Packing Output
Packing Variance
Supplier Purchases
Open Purchase Orders
Branch Transfers
In Transit Inventory
```

---

# 19. Users and Roles

Users belong to roles.

Routes:

```text
/users
/roles
```

Role settings currently support:

```text
canManageInventory
canManagePurchasing
canManagePacking
canManageTransfers
canManageUsers
```

Example roles:

```text
Administrator

Warehouse Manager

Purchasing
```

The frontend must hide or disable functionality based on permissions, but backend authorization must still enforce permissions.

Never rely only on frontend permission checks.

---

# 20. Audit Fields

Most business tables include:

```text
createdBy
createdAt
updatedBy
updatedAt
```

The authenticated user ID should populate:

```text
createdBy
updatedBy
```

These fields are for historical accountability.

---

# 21. Sidebar Navigation

Use this module structure:

```text
Dashboard

Master Data
├── Items
├── Suppliers
├── Locations
├── Units of Measure
└── Packing Formulas

Purchasing
├── Purchase Orders
├── Receiving
└── Lots / Batches

Packing
├── Packing Orders
└── Material Reservations

Inventory
├── Stock
├── Stock by Location
├── Stock by Lot
├── Transactions
└── Adjustments

Transfers
├── Stock Transfers
└── In Transit

Reports
├── Inventory Report
├── Packing Report
├── Purchasing Report
└── Transfer Report

Administration
├── Users
└── Roles & Permissions
```

---

# 22. Complete Operational Flow

The complete system flow is:

```text
MASTER DATA
Items
Suppliers
Locations
UOM
BOM
    ↓

PURCHASING
Create Purchase Order
    ↓
Add PO Lines
    ↓
Send to Supplier
    ↓

RECEIVING
Receive Material
    ↓
Create Lot
    ↓
Create Receive Transaction
    ↓
Increase Warehouse 1 Inventory
    ↓

PACKING PLANNING
Select Finished Product
    ↓
Read BOM
    ↓
Calculate Maximum Producible Qty
    ↓
Create Packing Order
    ↓
Snapshot BOM into Packing Order Materials
    ↓
Reserve Required Materials
    ↓

PACKING
Start Packing Order
    ↓
Consume Reserved Materials
    ↓
Create Finished Product Lot
    ↓
Produce Finished Inventory
    ↓
Store in Warehouse 2
    ↓
Complete Packing Order
    ↓

DISTRIBUTION
Create Stock Transfer
    ↓
Select Finished Product Lot
    ↓
Dispatch from Warehouse 2
    ↓
Move Stock to In Transit
    ↓
Branch Receives
    ↓
Move Stock from In Transit to Branch
    ↓

REPORTING
Inventory
Purchasing
Packing
Transfers
```

---

# 23. Important Business Rules

## Inventory

Never directly change inventory without creating the proper inventory transaction.

Inventory-changing operations must use a database transaction.

Examples:

```text
Receiving
Packing
Scrap
Adjustment
Transfer
```

---

## Packing

A finished product must have a valid BOM before a packing order can be planned.

A packing order must snapshot its material requirements.

Do not query the current BOM to reconstruct historical packing orders.

---

## Reservations

Do not reserve more than available stock.

Availability must account for other active reservations.

```text
available =
qtyOnHand
-
activeReservedQty
```

---

## Lots

Use lot-level inventory whenever receiving, packing, reserving, or transferring stock.

Finished products must be traceable to their packing order.

Purchased materials must be traceable to their purchase order line.

---

## Transfers

Source and destination must never be the same location.

Dispatched inventory must move through the In Transit location until receiving is confirmed.

---

## Foreign Keys

Keep foreign keys for core business relationships such as:

```text
Item
Supplier
Purchase Order
Lot
Location
Packing Order
Transfer
Inventory
```

Drizzle relations are for relational querying.

Database foreign keys are for data integrity.

Use both where appropriate.

---

# 24. Technical Architecture

Recommended application flow:

```text
UI
 ↓
Route Handler / Server Action
 ↓
Service Layer
 ↓
Database Transaction
 ↓
Drizzle ORM
 ↓
PostgreSQL / Supabase
```

Avoid putting complex inventory business logic directly in React components.

Recommended services:

```text
PurchasingService
ReceivingService
PackingService
InventoryService
ReservationService
TransferService
```

Examples:

```text
createPurchaseOrder()

receivePurchaseOrder()

calculateMaxProducible()

createPackingOrder()

reservePackingMaterials()

startPackingOrder()

completePackingOrder()

adjustInventory()

createStockTransfer()

dispatchTransfer()

receiveTransfer()
```

---

# 25. Transaction Safety

The following operations must run inside a PostgreSQL transaction:

```text
Receiving stock

Creating reservations

Starting packing

Completing packing

Inventory adjustment

Dispatching transfer

Receiving transfer
```

Never allow partial inventory operations.

Example of an invalid partial operation:

```text
Garlic deducted
Pouch deducted
Finished goods creation failed
```

The whole operation must succeed or the entire transaction must roll back.

---

# 26. System Design Principle

The system should prioritize:

```text
Simple workflows
Accurate inventory
Lot traceability
Safe concurrent operations
Clear audit trail
Reliable warehouse transfers
Minimal duplicated data
```

Do not add unnecessary ERP complexity unless required by an actual business process.

The core system should remain focused on:

```text
Buy
Receive
Store
Reserve
Pack
Transfer
Track
Report
```