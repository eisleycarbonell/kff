# Spice Trading & Packing System Flow

Repository documentation reviewed on 2026-11-14. This document retains the
original 26 sections and defines the shared business flow, including the
implemented customer sales and delivery extension in section 17. Section 2
distinguishes implemented workflows from planned modules; a documented route
alone does not establish that its page and API are implemented.

Read section 2 for each module's purpose and connections, sections 7 and 13
for the stock columns, and section 22 for the successful operator flow. The
[UI setup and happy-path guide](ui-setup-and-happy-path.md) expands that flow
into field-by-field instructions and numerical checkpoints. This document
remains the single source of business rules.

The [14 November module audit](module-audit-2026-11-14.md) records executable
coverage, corrected defects and the remaining browser-verification limits.

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

Customer demand can start the business flow: record the customer purchase order
as a Sales Order, select the finished products, inspect Material plan, then buy
any missing materials before continuing with the standard flow below. A customer
PO is a customer reference; a supplier Purchase Order is our purchasing document.

The primary inventory replenishment flow is:

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

The following status reflects the repository source on 2026-11-14.
Implemented means that the page and operational API are present; database
deployment and live verification are separate. The business examples below
remain illustrative rather than fixed master data or promised feature coverage.

| Module | Current implementation | Implementation contract |
| --- | --- | --- |
| Dashboard | Operational inventory, purchasing, packing and transfer summaries | Dashboard page and API |
| Items / Products | Catalog, finished-product label-material assignments and reference protection | [Items](items-module.md) |
| Suppliers | Supplier contacts and shared item links | [Suppliers](suppliers-module.md) |
| Customers | Contact master data linked to sales orders | [Customers](customers-module.md) |
| Units and Locations | Master-data management and usage protection | [UOM and Locations](uom-locations-modules.md) |
| Purchase Orders | Draft, send, partial receipt, completion and cancellation | [Purchase Orders](purchase-orders-module.md) |
| Receiving and Lots | Purchase receiving, lot provenance and QC metadata | [Receiving and Lots](receiving-lots-modules.md) |
| Inventory, Movements and Adjustments | Balances, append-only ledger and direct physical-count corrections | [Inventory Stocks](inventory-stocks-module.md) |
| Packing Orders and Material Reservations | BOM snapshots, planning, reservations, start and completion | [Packing Orders](packing-orders-module.md) |
| Stock Transfers and Branch/Store Stock | Dispatch through In Transit, partial receiving and shared location inventory | [Stock Transfers](stock-transfers-module.md) |
| Sales Orders and Delivery Orders | Customer PO references, BOM material shortage planning, demand allocation, lot dispatch and completed fulfillment | [Sales and Delivery](sales-delivery-modules.md) |
| Users, Roles and Authentication | Accounts, sessions and the five supported permission settings | [Users and Roles](roles-users-module.md) |
| Packing Formula / BOM maintenance | Published BOM inspection; numbered, dated revision releases with independent review | [Labels and Packing Formulas](brands-packing-formulas-modules.md) |
| Inventory Reports | Stock by Location, Stock by Lot, Low Stock, Near Expiry and Inventory Movement with filters, exact unit totals and CSV export | [Inventory Reports](inventory-reports-module.md) |
| Company Settings | Company/contact details, fixed currency after pricing history, alert defaults and optimistic version checks | [Controls and Reports](inventory-controls-and-reports.md) |
| Packaging, Reorder Levels and Reason Codes | Item-specific conversions/barcodes, saved thresholds and active reasons | [Controls and Reports](inventory-controls-and-reports.md) |
| Scrap & Disposal | Independently reviewed permanent stock removal | [Controls and Reports](inventory-controls-and-reports.md) |
| Former Count Sessions, QC Decisions and Stock Dispositions | Removed from the active workflow; retained records remain historical and cannot be advanced | [Controls and Reports](inventory-controls-and-reports.md) |
| Formula Revisions | Numbered replacement/retirement and effective-date release approval | [Controls and Reports](inventory-controls-and-reports.md) |
| Operational Reports | Packing variance/consumption, purchasing exposure, transfer transit and lot genealogy | [Controls and Reports](inventory-controls-and-reports.md) |

[Inventory Controls and Reports](inventory-controls-and-reports.md) defines the
modules, APIs, access and review lifecycle. Stock Adjustments remains the direct
physical-count correction workflow. Historical BOMs remain a legacy published
baseline; migration does not fabricate prior approvals. [Sample-data setup](test-data.md)
describes six role/account assignments and empty-database import behavior.

## Module purposes and connections

Use master data to define the business records first. Use operational modules
to buy, receive, pack and move goods. Use Inventory to inspect the resulting
stock, and Reports to compare and export the recorded activity.

Every active module page displays its purpose under the title and a **How to
use this module** panel with operational steps, connected-module links and
relevant notes. This in-app help follows the same rules and
[module demo guide](module-demo-guide.md), including reports and administration.

| Module / menu | Purpose and when to use it | Connected records and next step |
| --- | --- | --- |
| Dashboard | Review current stock, shortages and open work before operating | Reads purchasing, inventory, packing and transfers; open the relevant operational module to act |
| Items / Products | Define each material or finished product, its type and primary stock UOM; inspect supplier tags | Used by supplier links, PO lines, BOMs, lots and every stock operation; creating an item creates no stock |
| Suppliers | Maintain supplier contacts and the materials linked to each supplier | Shares supplier-item links with Items; these links determine the PO material dropdown |
| Units of Measure | Define compatible units and conversions | Items select a primary UOM; purchasing and BOM inputs convert into that unit |
| Item Packaging | Define an item's units per box/case and optional barcode/weight | Overrides generic compatible UOM conversion for that item in receiving and packing requirements |
| Locations | Define warehouses, packing areas, branches, stores and In Transit | Receiving, packing, transfers and deliveries write stock against these locations |
| Customers | Maintain customer contact and delivery-address details | Sales Orders select a customer; customers are not company inventory locations |
| Packing Formulas | Inspect the published materials required per finished unit | Formula Revisions publishes the BOM; a new Packing Order copies it |
| Formula Revisions | Prepare and independently release a replacement or retirement of a formula | Changes future packing requirements; historical orders keep their saved snapshot |
| Reorder Levels | Set item-specific low-stock thresholds | Used by Dashboard and Low Stock reports; does not automatically purchase anything |
| Reason Codes | Maintain active explanations for adjustments and disposal | Required by Stock Adjustments or Scrap & Disposal, as appropriate |
| Purchase Orders | Record the selected supplier, material quantities, purchase units and agreed prices | Uses active supplier-item links; a Sent PO becomes available in Receiving |
| Receiving | Record goods that physically arrived against an outstanding PO line | Creates a purchased lot, Receive movement and location balance; updates PO receipt progress |
| Inventory Stock | Answer how much of each item/lot is at each location and how much is available | Reads receipts, packing, transfers, deliveries, adjustments and scrap; open Lots or Movements for explanation |
| Lots / Batches | Trace a batch's origin, dates, status and stock across locations | Purchased lots link to PO lines; finished lots link to Packing Orders and consumed material lots |
| Stock Movements | Explain every increase, decrease and relocation of stock | Read-only ledger linked to the receipt, packing order, transfer, delivery, adjustment or scrap request |
| Stock Adjustments | Correct a verified physical-count difference for one item/lot/location | Uses the expected balance, counted quantity and reason; posts an Adjustment movement |
| Scrap & Disposal | Permanently remove confirmed damaged, expired or unusable goods | Independent review posts a negative Scrap movement; use outside the normal happy path |
| Packing Orders | Plan and execute conversion of materials into finished products | Copies a BOM, reserves material lots, then consumes inputs and produces a traceable finished lot |
| Material Reservations | Inspect which packing order has committed which material lots | Created by packing planning; consumed/released on completion or released on cancellation |
| Stock Transfers | Move company-owned finished goods between a warehouse and another warehouse, branch or store | Dispatch moves source stock into In Transit; receipt moves it into the destination |
| Sales Orders | Record the customer PO, select products, inspect finished supply and material shortages, then confirm demand | Material plan reads BOMs, eligible inventory and supplier links; Purchase Orders replenishes shortages; Delivery Orders fulfills demand |
| Delivery Orders | Ship selected finished-product lots and confirm customer receipt | Source stock moves to protected In Transit; completion posts Sale movements and updates the Sales Order |
| Inventory Reports | Inspect/export stock by location/lot, low stock, near expiry and movements | Reads current stock, active reservations, master-data thresholds and ledger records |
| Packing Report | Compare target/output and requirements/consumption | Reads packing snapshots and Consume/Produce movements |
| Purchasing Report | Review ordered, received and outstanding quantities and value | Reads PO headers/lines; receipt progress comes from Receiving |
| Transfer Report | Review dispatched, received and outstanding transit quantities | Reads Stock Transfers and their receipt progress |
| Lot Genealogy | Follow purchased materials into packed lots and later movements | Joins PO/supplier origins, packing consumption/output and transfer/delivery references |
| Users / Roles & Permissions | Give operators access to their responsibilities | Backend permissions govern every protected write; roles also determine visible actions |
| Company Settings | Maintain company details, currency and default alert thresholds | Used by app labels, monetary displays, low-stock and expiry warnings |

Count Sessions, QC Decisions and Stock Dispositions are no longer operator
modules. Their removal does not remove Stock Adjustments, lot traceability,
reservations, Scrap & Disposal or historical ledger entries.

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

## Labels on finished products

Labels are inventory items with type `Packaging - Label`, maintained in
Items / Products. A Finished Good can optionally select one such item in its
**Labels** field. New assignments require an active label material. Clearing
the field removes the catalog association; it does not delete the label item.
An existing inactive assignment can remain during unrelated catalog edits.

The label association identifies the intended printed label; the released BOM
defines the label quantity actually required and consumed. Assigning a label
does not create stock or automatically edit a formula. Include that same label
in the product's formula when it must be consumed during packing.

The Brands module is removed from the active application. Its legacy database
records and old item references are retained for history. There is no new
Brands workflow or separate Labels master-data module. See
[Labels and Packing Formulas](brands-packing-formulas-modules.md).

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

### Supplier tags shared with Items and purchasing

A supplier tag is a shared item-to-supplier link. Suppliers and Items use the
same relationship. Open Link items on a supplier to see only its current links
and use Unlink as needed. Link another item opens eligible unlinked materials;
Back to linked items returns to the current links. The Items supplier dialog
changes the same record. There is no separate offer
form or offer activation step. Enter purchase units and agreed prices on the PO.

The supplier table, summary card and CSV show current linked items, using the
backend count of active supplier-item relationships for that supplier only.
A supplier with two current links shows 2 regardless of other suppliers' links.
Unlinking reduces the count;
relinking restores it without creating a duplicate record. The summary counts
supplier-item pairs: one item linked to two suppliers contributes two links.
Inactive catalog items can retain a link but remain unavailable on new POs.
Old unlinked records are retained for history and are excluded from this count.
Link changes refresh Suppliers, Items and PO options before the action completes.

The relationship fields and preferred-supplier example above remain historical
schema examples. Previously saved unit/price defaults remain compatible with
PO prefilling, but offer terms and preferred flags are no longer edited in the
supplier UI. New links require only the item; they do not set price defaults.

One material can have several suppliers, as in the Garlic Powder example above.
Do not create duplicate catalog items just because two suppliers sell the same
material. Each purchased lot still identifies the actual supplier through its
PO line. Finished goods made by packing do not need a supplier tag.

Before purchasing a raw material, packaging item or label, link it to the
intended active supplier. An unlinked material can exist
in the catalog while being set up, but cannot be selected on that supplier's
PO. Unlinking an item does not rewrite existing orders or lots.

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


### Operational master-data extension

`/item-packaging` maintains item-specific primary units per pack, barcode and
gross weight. Referenced conversions are immutable. `/reason-codes` maintains
active adjustment/disposal reasons; `/reorder-policies` saves item thresholds.
`/settings` maintains company details, currency and stock-alert defaults. See
[Controls and Reports](inventory-controls-and-reports.md).

---

# 4. Packing Formula / BOM

A BOM defines the materials required to produce one finished product.

The current `/bom` page inspects published requirements. Packing managers prepare
numbered Replace/Retire requests at `/formula-revisions`. A different reviewer
with packing and user-management permissions releases a revision on or after its
effective date. Releases atomically publish/remove the current BOM; new orders
copy it and record its revision ID. Existing orders retain their own material
snapshot and reservations. Item-specific pack ratios override global compatible
UOM factors. See [Controls and Reports](inventory-controls-and-reports.md) and
[Labels and Packing Formulas](brands-packing-formulas-modules.md).

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

### PO numbering and supplier-first entry

1. Click Create purchase order. The system gets the next generated number
   before opening the form and fills PO number with that actual value. Keep it
   or replace it with your own unique reference before saving. A saved PO
   number cannot be changed.
2. Select an active supplier before adding material lines. The material dropdown
   shows only active raw materials, packaging and labels with an active
   supplied-item link to that supplier.
3. Select a material, enter its purchase unit and agreed price, and
   enter the ordered quantity. The agreed PO unit and price are saved on the
   line; later changes to a supplier link do not change that historical agreement.
4. If a material is missing, maintain its supplier link in Suppliers or Items,
   then refresh the PO options. Do not select a different supplier's material
   just to continue.
5. Changing the supplier requires reselecting its materials; incompatible old
   lines cannot be carried into the new supplier's PO. The backend validates
   supplier links when creating, editing and sending a draft.
6. Save and record the assigned number, review the draft, then mark it Sent.
   This makes its outstanding lines eligible for Receiving. No stock changes
   until a receipt is posted.

Automatically generated numbers use `PO-YYYY-<padded identity>`; `PO-2026-0001` below is an illustrative
format, not a number the operator must enter. Allocating the displayed number
advances the shared database counter without creating an order or inventory.
The counter does not restart each year, and abandoned forms can leave gaps.
The year is the UTC generation year, independent of an entered order date.
Numbers remain fixed after saving. Existing historical
numbers remain unchanged. Marking Sent records the state; it does not send an
email to the supplier.

A custom number is optional only during creation. The system trims surrounding
spaces, converts it to uppercase and accepts at most 30 characters. The create
API retains automatic generation for a blank or omitted number. Every number must be unique across
all orders, including cancelled orders and legacy records, without regard to
letter case. For example, `sup-2026-042` is saved as `SUP-2026-042`; another
spelling that differs only by case cannot be reused. A duplicate custom number
returns a conflict without saving the order. The prefilled reference is not a
reservation: another user can manually save that same reference before this
order is submitted. Saving rechecks uniqueness for both prefilled and custom
values; if either is already used, choose a different reference and retry.
Both custom and generated numbers remain fixed after the first save.

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

## Why Lots has a Reserved column

A lot can physically exist while some of its quantity is already committed to
another order. **Reserved** makes that commitment visible and prevents the
same stock from being promised twice. It is a quantity within on-hand stock,
not extra stock and not stock that has already been consumed.

| Column | Meaning |
| --- | --- |
| On hand | Physical quantity currently recorded for that lot |
| Reserved | Outstanding quantity on active packing or dispatched-delivery reservations |
| Available | On hand minus active outstanding reservations |

For the section 11 example, a garlic lot/location with 150 kg on hand and 30 kg
reserved has 120 kg available. Planning another order must use the 120 kg,
even though all 150 kg is still physically present. Reserving alone posts no
stock movement. Starting packing also leaves those quantities unchanged.

When packing consumes all 30 kg, on hand becomes 120 kg and that reservation
has no outstanding balance. Available stays 120 kg: subtracting the consumed
quantity from both on hand and its reservation avoids deducting it twice.
Cancellation releases the reservation without consuming stock. A completion
below target consumes the required portion and releases the unused portion.

The Lots list aggregates the lot across locations. Its detail and Inventory
Stock separate each location, which is essential before choosing where to
pack or dispatch. A lot total does not mean all its quantity is at one source.
Use Material Reservations for packing commitments. A customer delivery's
reservation belongs to its shipment in In Transit and is managed in Delivery
Orders. A confirmed Sales Order or Draft Delivery does not reserve warehouse
stock.

Availability is a balance calculation. An Approved, unexpired lot at an active
eligible source is also required for packing/dispatch; a positive available
number alone does not make held, expired or In Transit goods usable supply.
Quantities always use the item's primary UOM.

## Lot status without a separate QC module

New receipts into active Warehouses and packing outputs enter as Approved so the normal flow does not
depend on a QC Decision request. This does not perform or certify a laboratory
test. An inventory manager can correct a lot's status in Lots when necessary;
reservation protections and date validation still apply. Setting Approved does
not override operational expiry restrictions. Existing Quarantine or
Rejected statuses are retained rather than automatically approving old stock.
Separate QC evidence/reviewer approvals are outside the simplified workflow.

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

Inventory is the shared record of company-owned goods, from receipt to packing,
internal distribution and customer delivery. It is not another place to create
items or purchase quantities. Master Data defines the item and location;
operational actions create the balances and movements shown here.

## Which inventory screen to use

| Screen | Question it answers | Typical next action |
| --- | --- | --- |
| Inventory Stock (`/inventory`) | What is physically at this item/lot/location, what is committed, and what remains available? | Filter by source location before planning packing or dispatch; inspect the associated lot |
| Lots / Batches (`/inventory/lots`) | Which batch is this, where did it come from, and where is it now? | Inspect PO/packing origin, dates, status, location balances and movement history |
| Stock Movements (`/inventory/transactions`) | Why did the stock change? | Follow the source document; correct a mistake with a new authorized operation |
| Stock Adjustments (`/inventory/adjustments`) | How do I correct a verified physical-count difference? | Count a specific item/lot/location and submit the actual count with its reason |
| Scrap & Disposal (`/inventory/scrap`) | How do I record permanent disposal? | Prepare the disposal and have a different authorized reviewer approve it |

Inventory Stock and Lots show the same stock from different viewpoints. Stock
Movements explains how it got there. They are not three independent stocks.
The Material Reservations page explains packing commitments and Delivery
Orders explains protected customer shipments.

## How operational modules update Inventory

| Action | Effect on on-hand stock | Effect on reservations |
| --- | --- | --- |
| Create/send a PO | None | None |
| Receive a PO line | Increase the received lot at the selected storage location | None |
| Plan packing | None | Reserve eligible material lots at the source |
| Start packing | None | Keep material allocations active |
| Complete packing | Decrease material lots; increase the new finished lot | Record consumption and release unused allocations |
| Cancel an uncompleted packing order | None | Release its outstanding material reservations |
| Dispatch an internal transfer | Decrease source and increase In Transit for the same lot | Does not create a customer-shipment reservation |
| Receive an internal transfer | Decrease In Transit and increase destination for the same lot | No new packing reservation |
| Confirm sales / save a Draft Delivery | None | Allocate sales demand only; no physical stock reservation |
| Dispatch a customer delivery | Decrease source and increase In Transit | Protect the shipped lots in In Transit for that delivery |
| Complete customer receipt | Decrease In Transit with Sale entries | Consume/release the shipment's reservations |
| Apply a stock adjustment | Post the signed count difference at one item/lot/location | Reject a count below outstanding reservations |
| Approve scrap | Remove the approved quantity with Scrap entries | Cannot take quantity committed to another workflow |

Moving stock between company locations preserves total company ownership.
Receiving and production add stock; material consumption, completed customer
sales and scrap remove the corresponding stock. Keep kilogram and piece totals
separate. A paired transfer has a negative row at one location and a positive
row at the other; neither row should be deleted to "fix" a balance.

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


### Direct corrections and permanent disposal

Use Stock Adjustments for a physical-count correction, not a Count Session.
Select the existing item/lot/location and an active Inventory Adjustment reason,
review the expected on-hand and reserved balances, enter the actual physical
count, and save. The backend rejects stale balances and counts below active
reservations. A changed count posts only the difference as an Adjustment entry
and updates stock atomically. An unchanged count is not a saved count-session
observation. For actual permanent disposal use Scrap & Disposal so the ledger
records Scrap and the independent review remains visible.

Count Sessions, QC Decisions and Stock Dispositions have been removed from the
active menu and workflow. Existing request records/evidence remain historical;
new requests and transitions for these kinds are disabled. Old page addresses
redirect to Inventory. The former Stock Counts address redirects to Stock
Adjustments, which retains direct physical-count corrections.
Removing these modules does not delete any balances, reservations or ledger
history. Previously held location balances remain visible; the simplified flow
does not add a replacement held-location release operation. In Transit stock
continues through its owning transfer/delivery workflow.
See [Controls and Reports](inventory-controls-and-reports.md).

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
number, order date, optional customer PO number, optional requested delivery date, notes, and one line per
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

## Customer purchase orders and material planning

1. Create an active customer, then a Draft Sales Order. Enter the customer's
   own PO reference in **Customer PO number**, select each finished product and
   its requested quantity, and save. The internal sales number and customer PO
   are separate fields; the customer reference is optional and not globally unique.
2. Open **Material plan** on the saved sales order and select the active raw
   material Warehouse or Packing source. The backend first checks remaining
   unallocated demand and eligible finished goods across active warehouses,
   branches and stores. Existing finished stock can fulfill that portion.
3. For the uncovered portion, read the current released BOM and calculate raw
   ingredients, hardware, printed labels and seals in primary stock UOMs.
   Aggregate any shared material across all products before comparing it with
   supply at the selected material source.
4. Review each material's required, available and shortage quantities. Use its
   listed active linked suppliers to prepare supplier POs for shortages, grouped
   by supplier. Choose purchase units and prices explicitly on the PO. Existing
   supplier POs do not count as stock until goods are physically received.
5. Send each supplier PO, receive arrivals into the intended material source,
   and refresh the plan. Then create Packing Orders for the required output,
   reserve and start, complete into finished storage, and deliver or transfer
   using the normal workflows. Confirm customer demand before creating deliveries.

Calculations:

```text
unallocatedDemand = ordered - completedDelivered - Draft/InTransit delivery allocations
fromFinishedStock = MIN(unallocatedDemand, eligibleFinishedAvailable)
toPack = MAX(0, unallocatedDemand - fromFinishedStock)
materialRequired = SUM(toPackForProduct * BOMRequirementInPrimaryUOM)
materialShortage = MAX(0, materialRequired - eligibleMaterialAvailableAtSource)
```

The plan deducts this same order's Draft delivery quantities from eligible
finished coverage, preventing reuse for the remaining unallocated demand. This
deduction is planning only; Draft deliveries still do not reserve physical stock.

Eligible availability uses Approved, unexpired (or undated where allowed) lots,
active items/locations, and on hand less all active outstanding reservations.
Finished lots also require packing provenance. The plan subtracts this same order's Draft delivery quantities from eligible finished supply to avoid reusing that stock for its unallocated demand. Draft deliveries still do not reserve physical inventory. Held, rejected, expired, In
Transit and inactive-location stock do not supply this plan. Current BOM
conversions use item-specific pack ratios before generic compatible UOMs.
A missing/invalid formula blocks a product only when output still needs packing;
an inactive product with positive demand is also a blocking issue.

This is an advisory plan for one order at the time it is read. It does not
reserve stock, create POs or packing orders, alter the ledger, or promise future
supply from open packing orders or outstanding purchases. Separate customer
plans can compete for the same stock; packing planning and delivery dispatch
revalidate availability under database locks when committing work. No automatic
cross-order production allocation or replenishment execution is implemented.

For a separate isolated calculation example, a customer requests 500 garlic
100g packs; 100 eligible finished pieces are available. Packing the remaining
400 requires 40 kg garlic and 400 pc each of pouch, matching label and seal.
If the selected source has 25 kg garlic and 300 labels available, shortages are
15 kg garlic and 100 labels, provided pouch/seal availability covers 400 each.
The normal supplier PO and Receiving steps replenish those exact shortages.

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

The current `/reports/inventory` implements Stock by Location (item/location
totals), Stock by Lot (lot/location balances), Low Stock (active items at or
below a configurable availability threshold, including unstocked items), Near
Expiry (positive dated balances within a configurable UTC window, optionally
including expired lots), and Inventory Movement (append-only ledger records,
with inclusive UTC date filters and source references). Reports are read-only
for authenticated users, use a consistent database snapshot, include outstanding
packing and delivery reservations, and keep summary quantities separate by
primary UOM. Low Stock uses saved item reorder levels or the company default (initially 10),
unless an explicit report threshold is entered. Its availability excludes held,
In Transit, unapproved and expired supply. The company expiry horizon defaults
to 30 days. Stock is current;
movement date filters do not reconstruct historical balances. Search, operational
filters, row selection, sorting, pagination and CSV export are implemented.
See [Inventory Reports](inventory-reports-module.md) for complete calculations,
permissions, UI steps and examples.

Packing, purchasing, transfer and lot-genealogy reports are implemented at
`/reports/packing`, `/reports/purchasing`, `/reports/transfers` and
`/reports/genealogy`. Dashboard quantities are grouped by primary UOM; open lists
filter status before limits and shortage alerts include never-stocked items.
Historical stock reconstruction, scheduled reports, multicurrency conversion
and accounting remain outside this implementation. See
[Controls and Reports](inventory-controls-and-reports.md).

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


### Independent operational review

Preparing Scrap & Disposal requires `canManageInventory`; preparing
Formula Revisions requires `canManagePacking`. Approval/rejection additionally
requires `canManageUsers` and a different user from the creator/submitter.
Company settings writes require `canManageUsers`. Stock Adjustments and direct
lot-status corrections require Inventory permission without a separate review
request. Retired Count/QC/Disposition requests cannot advance through review.
The backend enforces these rules; UI visibility mirrors them.

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
└── Scrap & Disposal

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
├── Packing Formulas
├── Formula Revisions
├── Item Packaging
├── Reorder Levels
├── Reason Codes
├── Suppliers
├── Customers
├── Locations
└── Units of Measure

Reports
├── Inventory Reports
├── Packing Report
├── Purchasing Report
├── Transfer Report
└── Lot Genealogy

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


### Implemented navigation additions

The tree above reflects the active sidebar. Count Sessions, QC Decisions and
Stock Dispositions are removed. Their former page routes redirect to Inventory
Stock; `/inventory/counts` redirects to Stock Adjustments. Their stored history
remains readable through authenticated history APIs, without new or continuing
requests. Company Settings is an implemented settings page.

---

# 22. Complete Operational Flow

## Customer-first demo path

Start with the customer PO and Material plan described in section 17. Record
demand before purchasing; inspect finished stock, calculate the packing gap,
and purchase only material shortages. Follow the purchasing/receiving/packing
steps below for replenishment, then the normal delivery steps. The detailed
[module demo guide](module-demo-guide.md) covers every active module, with a
prepared realistic-data exercise and the role responsible for each action.

## Replenishment-first exercise: what the operator does

The happy path is one successful journey with valid master data, enough eligible
stock and no exceptions. It does not require an adjustment, count session, QC
decision, disposition or scrap request. Complete setup once, then repeat the
buy-to-deliver steps as real operations require. Section 19 defines which role
performs each action; preparing and releasing a formula uses different people.

| Step | Where and who | Operator action | Result / connection to the next step |
| --- | --- | --- | --- |
| 1 | Company Settings; administrator | Save company identity, currency and stock-alert defaults | Consistent company/currency labels and alert thresholds |
| 2 | Units of Measure and Locations; Inventory | Set compatible kg/pc units and separate raw warehouse, finished warehouse, branch and In Transit locations | Valid units and stock destinations exist; setup creates no stock |
| 3 | Items / Products; Inventory | Create raw spice, pouch, label, seal and finished-product records; set primary UOMs | One catalog record per material/product, ready for supplier links and formulas |
| 4 | Suppliers and Items supplier links; Purchasing | Create suppliers in Suppliers; use Link items in Suppliers or the supplier dialog in Items to link materials | Only the selected supplier's active linked materials appear on its PO; both screens manage the same links; units and prices are entered on the PO |
| 5 | Item Packaging / Reason Codes / Reorder Levels; Inventory | Set any needed item pack ratios, correction/disposal reasons and reorder overrides | Optional business configuration is ready before referenced operations |
| 6 | Formula Revisions; Packing then independent reviewer | Prepare the finished product's per-unit formula, submit and release it | Packing Formulas shows the published BOM; future orders can snapshot it |
| 7 | Purchase Orders; Purchasing | Keep the prefilled generated PO number or replace it with a unique reference; select supplier, choose its linked materials, enter quantities/units/prices and save | Draft has a unique PO number fixed after saving; allocating a number alone creates no order or stock |
| 8 | Purchase Orders; Purchasing | Review and mark the draft Sent | Outstanding PO lines become available in Receiving |
| 9 | Receiving; Inventory | After arrival select PO/line, destination, received quantity and unique lot reference; save | Purchased lot links to its PO line; Receive increases warehouse stock and PO received quantity |
| 10 | Inventory Stock and Lots; any authenticated operator | Check material item/lot/location, primary UOM, on hand, reserved and available | Confirm eligible source stock before planning; inspect Movements if a balance is unexpected |
| 11 | Packing Orders; Packing | Select finished product, target, source and destination; inspect availability and create Draft | Order saves its own material snapshot; preview shows the limiting component |
| 12 | Packing Orders; Packing | Plan and reserve the draft | Planned status; specific source lots become reserved, with no consumption yet |
| 13 | Packing Orders; Packing | Start the order when packing begins | In Progress; the same material reservations remain active |
| 14 | Packing Orders; Packing | Record actual output and finished lot, then complete | Consume material stock, release unused reservations, create finished lot and Produce into finished storage atomically |
| 15 | Stock Transfers; Transfers | When branch distribution is needed, create a transfer selecting finished lot and distinct source/destination, then dispatch | Source decreases; In Transit increases; total company stock is unchanged |
| 16 | Stock Transfers; Transfers | Confirm the branch's actual receipt | Transit decreases and branch increases; partial receiving leaves a transit balance until complete |
| 17 | Customers and Sales Orders; Inventory | Create an active customer, create a sales draft and confirm it | Customer demand is recorded; confirmation does not reserve stock |
| 18 | Delivery Orders; Transfers | Select the confirmed sale, source, finished lots and shipment quantity; save Draft | Sales demand is allocated; source stock is still on hand and not physically reserved |
| 19 | Delivery Orders; Transfers | Dispatch after the goods leave | Source decreases; original In Transit location increases and is reserved for this delivery |
| 20 | Delivery Orders; Transfers | Confirm customer receipt of the full shipment | Sale removes transit stock, shipment reservation closes and sales fulfillment updates atomically |
| 21 | Inventory, Dashboard and Reports; authenticated operators | Check final stock, movement references, packing results, purchases and transit; export as needed | An auditable completed purchase-to-customer journey |

Internal branch distribution is optional: a customer delivery can ship directly
from an eligible warehouse, branch or store. Internal transfers keep goods owned
by the company; completed customer delivery removes them. A Sales Order may be
partly fulfilled using several separate deliveries, each completed as a whole.

### Worked checkpoint for one complete run

Use the [UI guide](ui-setup-and-happy-path.md) for the exact example setup.
Receive 100 kg of garlic and 1,000 pc each of pouch, label and seal. The
published formula requires 0.100 kg garlic and one of each packaging component
per finished piece. Pack 500 pc, transfer 200 pc to a branch, then deliver
150 pc from that branch to a customer.

| Checkpoint | Raw warehouse | Finished warehouse | Branch | In Transit | Reservation / ownership check |
| --- | --- | --- | --- | --- | --- |
| After receiving | 100 kg garlic; 1,000 pc of each packaging item | 0 finished pc | 0 pc | 0 pc | No reservations |
| After planning 500 pc | Same physical balances | 0 pc | 0 pc | 0 pc | Reserve 50 kg garlic and 500 pc of each packaging item; remaining available is 50 kg and 500 pc each |
| After starting | Same physical balances | 0 pc | 0 pc | 0 pc | Planning reservations remain; no Consume entries yet |
| After completion | 50 kg garlic; 500 pc of each packaging item | 500 pc | 0 pc | 0 pc | Inputs consumed, reservations closed; new finished lot traces to this order |
| After dispatch to branch | Same remaining material balances | 300 pc | 0 pc | 200 pc | Company finished stock remains 500 pc |
| After branch receipt | Same | 300 pc | 200 pc | 0 pc | Company finished stock remains 500 pc |
| After sales confirmation / Draft Delivery | Same | 300 pc | 200 pc | 0 pc | Allocate 150 pc sales demand; no warehouse/branch reservation |
| After customer dispatch | Same | 300 pc | 50 pc | 150 pc | All 150 transit pc reserved for the delivery; company still owns 500 pc |
| After customer receipt | Same | 300 pc | 50 pc | 0 pc | Sale of 150 pc; company finished stock is 350 pc; shipment reservation closed |

For this isolated run, the ledger contains four Receive, four Consume, one
Produce, four internal-transfer, two customer-dispatch Transfer and one Sale
entries: 16 rows. There is no inventory ledger entry for PO creation, sales
confirmation, drafting a delivery, reserving materials or starting packing.

## Operational sequence and system actions

The stock-replenishment sequence is:

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
Active Customer + Customer PO
    -> Draft Sales Order with selected products
    -> Material plan: finished supply -> packing gap -> BOM material shortages
    -> Supplier PO -> Receiving -> Packing when replenishment is needed
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
