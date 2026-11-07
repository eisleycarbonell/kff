# Spice Trading & Packing System Flow

Repository documentation reviewed on 2026-11-07. This document retains the
original 26 sections and defines the shared business flow, including the
implemented customer sales and delivery extension in section 17. Section 2
distinguishes implemented workflows from planned modules; a documented route
alone does not establish that its page and API are implemented.

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
- Customer sales orders
- Lot-based customer deliveries and fulfillment
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

Finished goods at a warehouse, branch or store can also fulfill customer sales
orders through Delivery Orders -> In Transit -> Customer Receipt. Sections 17
and 22 describe that customer path and its stock/ledger effects.

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

## Current Implementation Coverage

The following status reflects the repository source on 2026-11-07.
Implemented means that the page and operational API are present; database
deployment and live verification are separate. The business examples below
remain illustrative rather than fixed master data or promised feature coverage.

| Module | Current implementation | Implementation contract |
| --- | --- | --- |
| Dashboard | Operational inventory, purchasing, packing and transfer summaries | Dashboard page and API |
| Items / Products | Catalog management and reference protection | [Items](items-module.md) |
| Suppliers | Supplier and item-offer management | [Suppliers](suppliers-module.md) |
| Customers | Contact master data linked to sales orders | [Customers](customers-module.md) |
| Units and Locations | Master-data management and usage protection | [UOM and Locations](uom-locations-modules.md) |
| Purchase Orders | Draft, send, partial receipt, completion and cancellation | [Purchase Orders](purchase-orders-module.md) |
| Receiving and Lots | Purchase receiving, lot provenance and QC metadata | [Receiving and Lots](receiving-lots-modules.md) |
| Inventory, Movements, Adjustments and Counts | Balances and ledger views; individual lot/location counted corrections | [Inventory Stocks](inventory-stocks-module.md) |
| Packing Orders and Material Reservations | BOM snapshots, planning, reservations, start and completion | [Packing Orders](packing-orders-module.md) |
| Stock Transfers and Branch/Store Stock | Dispatch through In Transit, partial receiving and shared location inventory | [Stock Transfers](stock-transfers-module.md) |
| Sales Orders and Delivery Orders | Customer demand allocation, lot dispatch and completed delivery fulfillment | [Sales and Delivery](sales-delivery-modules.md) |
| Users, Roles and Authentication | Accounts, sessions and the five supported permission settings | [Users and Roles](roles-users-module.md) |
| Packing Formula / BOM maintenance | Current formula editor/API with compatible units and protected historical order snapshots | [Brands and Packing Formulas](brands-packing-formulas-modules.md) |
| Brands | Brand management, active status and optional item assignments | [Brands and Packing Formulas](brands-packing-formulas-modules.md) |
| Reports | Placeholder report tabs; dedicated reporting APIs are planned | Section 18 |
| Company Settings | Placeholder page; company settings storage and API are planned | Section 21 navigation |

Item-specific packaging/UOM conversions and scrap reason codes have schema and
sample records but no maintenance API. A dedicated scrap/disposal operation is
not yet exposed; sample Scrap entries do not establish a live scrap workflow.
Stock Counts currently records changed counts through adjustments, without
count-session documents or saved unchanged observations.

[Sample-data setup](test-data.md) describes the implemented examples, six sample
role/account assignments, and empty-database import behavior. Sample records
do not implement the planned modules above.

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

## Brands

Brands identify commercial product families. Inventory managers maintain a
unique code, name, optional description and active status at `/brands`, then
optionally assign a brand in Items / Products. Only active brands may be newly
assigned; deactivation preserves existing item links and operational history.
Brands are not hard deleted. See
[Brands and Packing Formulas](brands-packing-formulas-modules.md).

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

## Customers

Customers are contact master data used by sales orders. They contain a name,
optional contact name, email, phone, address and notes, plus active status.
Customers are separate from company inventory locations; completing a customer
delivery removes goods from company inventory.

Route:

```text
/customers
```

New and confirmed sales orders require an active customer. Customer records
remain available historically, and deactivation is blocked while a Draft,
Confirmed or Partially Delivered sales order remains open.

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

The current `/bom` editor creates one formula per active Finished Good. Packing
managers add 1-100 distinct active raw materials, packaging or labels, with
positive exact per-unit quantities and compatible UOMs. They can edit or remove
the current formula. Changes are atomic and apply to new orders; existing orders
retain their own material snapshot and reservations. Formula revision numbers,
effective dates and approval workflows remain planned. See
[Brands and Packing Formulas](brands-packing-formulas-modules.md).

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
Packing Completion
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

The flow above describes packing-material reservations. Starting packing
validates allocations and changes the order status; it does not consume stock.
The materials remain reserved until completion, when actual consumption is
recorded and unused reservations are released, as described in section 12.

Customer deliveries use the same reservation table to protect dispatched stock
at its In Transit location. Each reservation belongs to exactly one packing
order material or delivery order line, and retains item, lot, location,
reserved quantity, consumed quantity and release time. All active outstanding
reservations reduce availability, regardless of their owning workflow.
The Material Reservations page lists packing reservations; delivery shipment
reservations are managed through the delivery workflow in section 17.

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
Sale
```

`Sale` records the negative quantity leaving company inventory when a customer
delivery is completed. Customer dispatch uses paired `Transfer` entries from
the source location to In Transit. Every such entry links to its delivery order
line and reference number; internal stock transfers retain their own transfer
line references. Quantities remain in the item's primary UOM.

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

## Sales Orders

Sales orders record customer demand for active Finished Goods in each item's
primary UOM. An order belongs to one active customer and contains an order
number, order date, optional requested delivery date, notes, and one line per
finished product. Each line records item, primary UOM, quantity ordered,
quantity delivered and unit price. Requested delivery cannot precede the order
date. Quantities and prices use exact decimal strings with up to four decimal
places; quantities are positive and prices may be zero. Line amounts round
half up to four decimal places, and the order total sums those line amounts.

Route:

```text
/sales-orders
```

Sales order statuses:

```text
Draft
Confirmed
Partially Delivered
Completed
Cancelled
```

Draft orders can be edited and confirmed. Confirmation revalidates the active
customer and products but does not reserve warehouse stock. Only Draft or
Confirmed orders with no un-cancelled delivery orders can be cancelled.
Partially Delivered and Completed orders preserve their fulfillment history.
The backend derives delivered quantities and fulfillment status from completed
deliveries; clients cannot write them directly.

Delivery drafts allocate outstanding sales quantities under a lock on the
sales order so simultaneous deliveries cannot over-allocate its demand:

```text
qtyRemaining = qtyOrdered - qtyDelivered

qtyAllocated = total quantity on Draft and In Transit delivery lines

quantity available to allocate = qtyRemaining - qtyAllocated
```

Completed deliveries contribute to `qtyDelivered`, and no longer contribute
to `qtyAllocated`. Cancelled deliveries contribute to neither. Demand
allocation is separate from physical stock reservation and availability.

## Delivery Orders

A delivery belongs to one Confirmed or Partially Delivered sales order. Its
header records a delivery number, source location, delivery date, notes, and
the original In Transit location once dispatched. The source is an active
Warehouse, Branch or Store, distinct from the active In Transit location.
The delivery date cannot precede the associated sales order date.

Each delivery line links a sales order line to a matching finished-product lot.
Each lot appears once per delivery; a sales order line can be split across
several lots or deliveries. The delivery line's `qtyDelivered` is its planned
full shipment quantity while Draft and its committed shipment after dispatch.
The sales line's `qtyDelivered` counts only completed customer deliveries.

Route:

```text
/delivery-orders
```

Delivery order statuses:

```text
Draft
In Transit
Completed
Cancelled
```

Drafts can be edited or cancelled. Draft creation and editing validate matching
lots with stock at the source and allocate the sales order's demand. Dispatch
rechecks physical availability after all active reservations, active finished
items, approved and unexpired lots, and provenance to a packing order.

Dispatch atomically:

- Deducts stock at the source and adds the same lot to In Transit.
- Appends paired Transfer ledger entries linked to the delivery line.
- Reserves that shipment at its In Transit location for the delivery line.
- Records the original transit location, dispatch time, actor and In Transit status.

Completion confirms receipt of the entire delivery by the customer and atomically:

- Validates the original transit stock and the delivery's protected allocation.
- Deducts the shipment from In Transit and appends negative Sale entries.
- Consumes and releases its transit reservations.
- Increments the sales lines' delivered quantities without exceeding quantities ordered.
- Marks the sales order Partially Delivered or Completed according to all its lines.
- Records completion time, actor and Completed delivery status.

Goods remain company inventory during transit and leave it only on completed
customer receipt. Customer contacts are not company destination locations.
Dispatch and completion hold document and inventory locks through commit;
failure rolls back every related stock, ledger, reservation and document write.
Repeated or invalid actions fail without duplicating inventory or fulfillment.

Dispatched deliveries cannot be edited or cancelled. Each delivery completes
as a whole shipment; use multiple delivery orders for partial sales fulfillment.
The current scope does not include invoices, payments, receivables, customer
returns, partial receipt within a delivery, or dispatched-delivery reversals.
See [Sales and Delivery](sales-delivery-modules.md) for request/response contracts
and [test data](test-data.md) for the five sample sales orders and six deliveries.

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

The routes and report types above describe intended reporting coverage. Current
`/reports/inventory` contains five planned tabs and no reporting API. Packing,
purchasing and transfer report workflows are also planned; dashboard metrics
and operational stock/movement screens provide data but do not implement these
reporting workflows. See the current implementation coverage in section 2.

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
Sales
Delivery
Viewer
```

The implemented Sales and Delivery modules reuse the existing permission flags:

| Protected operation | Permission |
| --- | --- |
| Items, customers, UOMs, locations, receiving and stock adjustments | canManageInventory |
| Sales order creation, editing, confirmation and cancellation | canManageInventory |
| Suppliers and purchase orders | canManagePurchasing |
| Packing order management | canManagePacking |
| Internal transfers and customer delivery management | canManageTransfers |
| User and role management, including their protected reads | canManageUsers |

There are no separate sales or delivery permission flags. A Sales role with
Inventory permission can also manage inventory; a Delivery role with Transfers
permission can also manage internal transfers. The sample Administrator and
Warehouse Manager have both permissions. Purchasing and Viewer can read sales
and delivery orders but cannot manage them. All six sample accounts and their
persisted role assignments are documented in [test data](test-data.md).

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

Inventory
├── Inventory Stock
├── Lots / Batches
├── Stock Movements
├── Stock Adjustments
└── Stock Counts

Purchasing
├── Purchase Orders
└── Receiving

Packing
├── Packing Orders
└── Material Reservations

Transfers
└── Stock Transfers

Sales & Delivery
├── Sales Orders
└── Delivery Orders

Master Data
├── Items / Products
├── Brands
├── Packing Formulas
├── Suppliers
├── Customers
├── Locations
└── Units of Measure

Reports
└── Inventory Reports

Users & Access
├── Users
└── Roles & Permissions

Settings
└── Company Settings
```

Dashboard is a direct link. Main groups use collapsible menus. In Transit is a
tab in Stock Transfers. Report types are tabs in Inventory Reports. Location
and lot filters belong in Inventory Stock. Sidebar and breadcrumb labels stay
consistent. Navigation destinations may be planned until their workflows and
backend contracts are implemented.

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

Customer fulfillment is an additional path from finished stock in a warehouse,
branch or store; it does not replace internal distribution:

```text
CUSTOMER DEMAND
Active Customer
    -> Draft Sales Order
    -> Confirm Sales Order
    -> Allocate outstanding demand to Draft Delivery Orders

CUSTOMER DISPATCH
Select traceable finished-product lots and source location
    -> Recheck available physical stock
    -> Dispatch source stock into In Transit
    -> Protect each shipment with a delivery reservation

CUSTOMER RECEIPT
Complete the full delivery
    -> Remove original In Transit stock with Sale ledger entries
    -> Consume and release the shipment reservations
    -> Update sales quantities delivered
    -> Partially Delivered or Completed Sales Order
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

Active outstanding reservations include both packing-material allocations and
delivery shipments protected in transit. A Draft delivery's sales-demand
allocation does not reserve warehouse stock. Physical availability is checked
under inventory locks when that delivery is dispatched.

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

In this repository the implementation path is Next.js page/components ->
feature hook with TanStack Query -> Express route with Zod validation ->
controller -> business service -> PostgreSQL transaction / Drizzle ORM.
The general diagram above describes responsibilities rather than requiring
Next.js Route Handlers or Server Actions instead of the existing Express API.

Avoid putting complex inventory business logic directly in React components.

Recommended services:

```text
PurchasingService
ReceivingService
PackingService
InventoryService
ReservationService
TransferService
SalesOrderService
DeliveryOrderService
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

Customer operations include:

```text
createSalesOrder()
confirmSalesOrder()
cancelSalesOrder()
createDeliveryOrder()
dispatchDeliveryOrder()
completeDeliveryOrder()
cancelDeliveryOrder()
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

Customer workflow transactions also include creating/editing orders and lines,
allocating delivery quantities, cancelling draft demand allocations, dispatching
customer deliveries, and completing customer deliveries. Stock/ledger changes,
reservation changes and sales fulfillment changes must commit or roll back
together where the operation affects them.

Never allow partial inventory operations.

Serialize sales allocations on the sales order, and hold stock and reservation
locks through the dispatch or completion ledger/balance commit. Neither
concurrent deliveries nor repeated actions may over-allocate demand, overspend
available stock, or duplicate sales fulfillment.

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
Sell
Deliver
Track
Report
```
