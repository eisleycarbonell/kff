# Module descriptions and demo walkthroughs

Reviewed 14 November 2026. This guide follows the [canonical system flow](system-flow.md)
and implementation contracts. It explains every active module, the actions to
demonstrate and the result to verify. Names/records are fictional demonstration
data; see [database setup and accounts](test-data.md). The backend enforces access.

Every active module also explains itself inside the application. Its header
shows **Purpose**, followed by **How to use this module**. Expand that panel for
the module's steps, links to its connected workflow and relevant operating notes.
The in-app text covers all 36 active sidebar modules, including reports, accounting, and
administration. The In Transit transfer view shares the Stock Transfers guide.

## Customer PO to purchasing, packing and delivery

A customer PO becomes our Sales Order. It is separate from a supplier Purchase
Order, which we issue to buy missing materials. Labels are printed inventory
materials selected on Finished Goods; Brands has been retired.

```text
Customer PO -> Sales Order with products and quantities
                   |
              Material plan
              /           \
     Finished stock     Packing gap -> Released BOM
           |                         |
           |                Raw + hardware + labels + seals
           |                         |
           |                Compare available source stock
           |                         |
           |                Supplier PO for shortages
           |                         |
           |                Receiving -> Raw storage
           |                         |
           |                Reserve -> Pack -> Finished storage
           \_________________________/
                        |
             Delivery -> In Transit -> Customer receipt
                        |
                  Sale and fulfillment
```

Optional internal branch distribution uses Stock Transfers before delivery.
All company locations share Inventory Stock and the append-only ledger.

The references below identify a fresh import. Upgraded existing demo databases
keep their saved document/lot references and quantities; locate the equivalent
Draft or create a new order with the requested exercise quantities.

### Prepared realistic-data exercise

1. Sign in as `demo@spice.local` (`KffDemo123!`) in the dedicated demo environment.
   Open Sales Orders, Draft `SO-2026-0001`, customer **Lutong Bahay Restaurant**,
   customer PO `LB-PO-2026-0001`. Fresh-import demand is 1500 Garlic Powder 100g
   and 1000 Black Pepper Ground 100g pieces.
2. Open the sales order's three-dot menu and choose **Check material plan**.
   Select **Raw Ingredients and Packaging Warehouse**
   (`WH-RM`). Review eligible finished supply and quantity to pack. Demand is
   ordered less completed delivered and Draft/In Transit delivery allocations.
   Same-order Draft delivery quantities are also excluded from usable finished
   coverage so they are not reused for the remaining unallocated demand.
3. Inspect the material rows. Garlic/pepper use different bulk ingredients
   and labels but share 100g pouches and seals. Shared requirements are added
   before available supply is subtracted once. Shortage is the amount to
   replenish in primary stock UOM. Held/expired/transit goods, outstanding
   reservations, future PO receipts and unfinished packing are not supply.
4. Record shortages and active supplier suggestions. In Purchase Orders keep
   the generated reference or supply a unique custom number, choose supplier,
   linked materials, quantities, compatible purchase units and agreed prices.
   Split POs by supplier. Material plan does not automatically save these orders.
5. Review and mark supplier POs **Sent**. After physical arrival, use Receiving:
   select outstanding PO line, `WH-RM`, actual arrival quantity and new lot
   reference. Verify Receive movement, lot provenance and PO receipt progress.
6. In Material plan, click **Refresh stock**. Resolve product/formula issues first. Confirm the
   accepted customer demand. Create Packing Orders for the required products
   and quantities using `WH-RM` and **Finished Goods Warehouse** (`WH-FG`).
   Each saved order copies its BOM and rechecks source requirements.
7. **Plan and reserve**, **Start packing**, then **Complete packing** with actual
   output and a unique finished lot. Verify Consume/Produce movements and
   consumed/released reservations. Refresh/replenish if supply changed since
   the advisory plan; reading the plan does not commit stock.
8. Create a Delivery Order for the Confirmed sale, select source and finished
   lots, save Draft, and dispatch to Goods In Transit. Confirm customer receipt
   after the whole shipment arrives. Use several deliveries for partial sales
   fulfillment. Verify Sale movements and sales delivered/remaining quantities.
9. Review Inventory Stock, Lot Genealogy, Purchasing and Packing reports.
   Compare documents and balances, keeping kg and pc totals separate.

Planning is advisory for one order. It does not coordinate multiple customer
orders, reserve finished supply or automatically execute replenishment.
Packing reservations and delivery dispatch recheck availability under locks.
The app has no invoices, payments, customer returns or dispatched-delivery
reversal. For independent exact figures use the additional
[500-pack shortage example](system-flow.md#customer-purchase-orders-and-material-planning)
or the original [500-piece UI exercise](ui-setup-and-happy-path.md).

## Master data: define records before operations

Setup does not create stock. Referenced item types, UOMs and conversion factors
are protected to preserve history. Use deactivation when supported.

| Module / route | Purpose / access | Demo actions and verification |
| --- | --- | --- |
| Items / Products `/items` | Bulk, hardware, labels and finished-product catalog; Inventory writes | Inspect RM-GARLIC, LBL-GARLIC, PKG-POUCH-100 and FG-GARLIC-100. Edit the finished good and select LBL-GARLIC in Labels. Verify primary UOM, active status and supplier tags. Creation does not add stock. |
| Suppliers `/suppliers` | Contacts and shared supplier-material links; Purchasing writes | Open Davao Harvest Spice Trading, choose Link items and inspect garlic/pepper. Link/unlink a material and check count plus supplier-specific PO choices. Units/prices are agreed on the PO. |
| Customers `/customers` | Contact/delivery-address master; Inventory writes | Inspect Lutong Bahay Restaurant and select it on a new sales draft. A customer is not an inventory location. Open sales work blocks deactivation. |
| Units of Measure `/uom` | Compatible classes/conversions; Inventory writes | Inspect kg/g and pc/box. With kg as Mass base, g factor is 0.001. Reuse valid units; product-specific contents belong in Item Packaging. |
| Locations `/locations` | Company warehouses, Packing, branches, stores and In Transit; Inventory writes | Inspect WH-RM, WH-FG, BR-MNL and TRANSIT. Check distinct source/destination types. Deactivation cannot strand stock or open work. |
| Packing Formulas `/bom` | Create, edit, copy, calculate batch ratios, and remove per-finished-unit formulas; Packing writes | Open garlic: 0.100000 kg garlic plus one pouch, matching label and seal. Show Copy from existing product, automatic label inclusion, and From batch calculation. Formula Revisions is retired (`/formula-revisions` redirects to `/bom`). |
| Item Packaging `/item-packaging` | Item-specific box/case ratio, barcode and gross weight; Inventory writes | Inspect a finished box with base quantity 12. The ratio overrides the compatible generic UOM factor for that item. Referenced ratios are protected. |
| Reorder Levels `/reorder-policies` | Saved stock-warning thresholds; Inventory writes | Inspect garlic raw 25 kg and finished 100 pc. Compare Low Stock using saved defaults and an explicit threshold override. Alerts do not save POs. |
| Reason Codes `/reason-codes` | Active explanations for corrections/disposal; Inventory writes | Inspect Physical Count Correction and Expired Stock Disposal. Select the matching category in the appropriate stock action. |

Labels have suppliers, lots and inventory like other packing materials. There
is no separate Brands or Labels management page. Assigning a label is descriptive;
the published BOM controls quantities and actual label consumption.

## Purchasing, receiving and packing

| Module / route | Purpose / prerequisite | Demo actions and verification |
| --- | --- | --- |
| Purchase Orders `/purchase-orders` | Our order to one supplier; Purchasing permission and active material links | Create Draft, inspect generated number, choose supplier/materials, units, quantities and prices. Save and mark Sent. Inspect PO-2026-1005 and partial PO-2026-1006. Saved references are immutable; no stock changes until receipt. |
| Receiving `/receiving` | Record arrived goods on outstanding Sent/Partially Received PO lines; Inventory | Select PO/line and active warehouse; enter incremental quantity, unique lot and optional supplier lot/dates. Save and verify lot origin, Receive and primary-UOM increase. Partial arrivals leave remaining demand. |
| Packing Orders `/packing-orders` | Snapshot BOM, reserve and execute finished output; Packing | Create Draft for product, target, source and finished destination. Review shortages/limiting component. Plan/reserve, start, complete with output/new lot. Planning reserves, starting changes status, completion atomically consumes inputs and produces output. |
| Material Reservations `/packing-orders/reservations` | Inspect material lots committed to packing | Find PK-GARLIC-OPEN, compare reserved/consumed/outstanding quantities with Inventory Stock. Cancellation releases allocations; completion consumes and releases unused portions. Delivery transit reservations are managed in Delivery Orders. |

Replenish shortages through purchase/receipt or revise the plan. Stock Adjustments
are for verified physical count differences, not a substitute for receiving.

## Inventory and stock exceptions

| Module / route | Purpose / access | Demo actions and verification |
| --- | --- | --- |
| Inventory Stock `/inventory` | Item/lot/location on hand, reserved and available; authenticated read | Filter RM-GARLIC at WH-RM and compare reservations. Inspect a delivery lot in TRANSIT: its reservation protects the shipment. No direct balance editing/deleting. |
| Lots / Batches `/inventory/lots` | Provenance, dates, status and locations; Inventory metadata writes | View LOT-GARLIC and FG-GARLIC; follow PO line and Packing Order origins. Inspect balances/movements. Optional dates remain allowed. Status changes do not move stock or bypass expiry. |
| Stock Movements `/inventory/transactions` | Read-only append-only stock explanation | Filter PO/packing/transfer/delivery reference. Show Receive, Consume, Produce, paired Transfer and completed Sale. Correct through new operations; never rewrite entries. |
| Stock Adjustments `/inventory/adjustments` | Verified physical count correction; Inventory | Choose existing item/lot/location and active reason, preserve expected balance, enter final actual counted quantity and save. Verify signed difference. Stale values and counts below reservations fail. |
| Scrap & Disposal `/inventory/scrap` | Permanent removal with independent review; Inventory plus separate reviewer | As Warehouse inspect/prepare SCRAP-REVIEW, verify lot/source/quantity/reason/evidence and submit. As Administrator approve; verify negative Scrap and balance. The creator cannot approve their own request. |

Count Sessions, QC Decisions and Stock Dispositions are retired and read history
only. Do not include them as new workflow steps. Historical held-location stock
remains visible; the simplified app adds no held-location release operation.
Use newly received Approved supply for the normal demo path.

## Distribution and customer fulfillment

| Module / route | Purpose / access | Demo actions and verification |
| --- | --- | --- |
| Stock Transfers `/transfers` | Internal movement to another company location; Transfers | Select finished lot and distinct source/destination, save Draft, dispatch through In Transit, confirm incremental receipt. Inspect partial TR-CAYENNE: only outstanding quantity remains in transit. Company ownership does not change. |
| Sales Orders `/sales-orders` | Customer PO, selected products, material planning and fulfillment; Inventory writes | Create Draft, enter Customer PO number/products/quantities/prices. Open Material plan, choose source, review finished coverage, packing gap and shared-material shortages. Confirm demand; inspect fulfillment after customer receipts. Confirmation reserves no stock. |
| Delivery Orders `/delivery-orders` | Allocate demand, dispatch lots and confirm whole-shipment receipt; Transfers | Select eligible sale/source/line/lots. Draft allocates demand. Dispatch checks stock and protects transit. Customer receipt posts Sale, closes reservations and updates fulfillment atomically. |

Draft deliveries can be cancelled to release demand allocations. In Transit
and Completed deliveries cannot be cancelled. Each shipment completes in full;
use separate delivery documents for partial sales fulfillment.

## Dashboard, reports and administration

| Module / route | Purpose / access | Demo actions and verification |
| --- | --- | --- |
| Dashboard `/dashboard` | Operational overview; authenticated | Inspect stock grouped by primary UOM, open purchasing, packing/transfers and low-stock/expiry alerts. Follow the operational module to act; alerts create no transactions. |
| Inventory Reports `/reports/inventory` | Five read-only inventory views | Choose Stock by Location/Lot, Low Stock, Near Expiry or Movement; set/apply filters. Find unstocked RM-ONION and near-expiry laurel. Stock is current; movement dates filter ledger rows. Sort/select/export CSV with separate UOM totals. |
| Packing Report `/reports/packing` | Target/output, consumption and variance | Filter completed run, compare snapshot requirements, Consume/Produce movements and actual output. |
| Purchasing Report `/reports/purchasing` | Ordered/received/outstanding exposure | Compare Completed, Sent and Partially Received POs. Future receipts do not count as stock. |
| Transfer Report `/reports/transfers` | Dispatched/received/outstanding internal transit | Verify TR-CAYENNE shipped minus received equals outstanding. Customer fulfillment is managed in Sales/Delivery. |
| Lot Genealogy `/reports/genealogy` | Ingredient to finished lot and onward movements | Trace purchased garlic through packing consumption/output to transfer/delivery references, retaining supplier and PO origin. |
| Users `/users` | Accounts and persisted role assignments; Users & roles | Inspect six demo operators, create an operator if needed and sign in to verify access. Backend identity supplies audit fields. |
| Roles & Permissions `/roles` | Five supported permission flags; Users & roles | Compare Purchasing, Sales, Delivery and Viewer. Sales reuses Inventory; Delivery reuses Transfers. Verify unauthorized writes are denied and retain administrator access. |
| Company Settings `/settings` | Identity/currency/default alerts; Users & roles writes | Inspect company, PHP, reorder 10 and expiry 30. Save appropriate details using current version. Currency is protected after pricing history. Low Stock uses defaults when no override exists. |

Use the implementation-contract links in [system-flow section 2](system-flow.md#current-implementation-coverage)
for complete validation/permissions. This guide documents repository behavior;
it does not assert a completed live browser acceptance run or verified external
business records.
