# KFF UI setup and happy-path guide

Updated on 12 November 2026 for generated PO-number prefill with optional custom references.

This guide explains what to enter, where to click, and what to check when setting up master data and completing one successful purchase-to-customer cycle. It follows the [canonical system flow](system-flow.md). All quantities, prices, names and codes below are training examples.

## 1. Before you start

Ask your system administrator to provide the application address, a working database and an initial administrator account. Creating the database and the first account is outside the UI. In local development, the usual application address is `http://localhost:3000/`; use your organization's supplied address otherwise.

**Brands and packing formulas can now be set up through the UI.** The database
and first administrator account must already be prepared. Brand creation needs
Inventory permission; formula preparation needs Packing permission. Formula
release requires a different reviewer with Packing and User Management
permissions. Count Sessions, QC Decisions and Stock Dispositions are removed
from the active workflow. Stock Adjustments and Scrap & Disposal remain.

For each module's purpose and its connections, see the
[module reference](system-flow.md#module-purposes-and-connections). Follow the
numbered steps below in order; each checkpoint states what must be true before
continuing. Master data is normally set up once, while purchasing, receiving,
packing and delivery repeat for each operation.

For a repeatable training exercise:

- Use a training environment. Start the example items and locations with zero stock and no open orders or reservations.
- Use the `HP-` codes below for one run. If they already exist, choose a new prefix consistently for items, locations, lots and document numbers.
- Reuse existing valid units instead of creating duplicates. The example uses `kg` and `pc` as the primary stock units.
- Use the actual operation date in date fields. Any expiration date entered must be in the future for planning/dispatch and later than manufacture when both dates are supplied. Optional dates can remain empty for this exercise; real operations use the actual available lot information.
- Enter quantities without thousands separators: type `1000`, not `1,000`. Quantities/prices allow up to four decimal places.
- Wait for each successful save and check the resulting record before taking the next action.

If the sample dataset has already been installed, its test administrator is `demo@spice.local` with password `KffDemo123!`. These credentials apply only to the documented sample setup. Sample installation is an administrator task described in [test data](test-data.md); no reset or sample import is needed to follow this UI guide with a prepared environment.

### Which account to use

Use an account with all five permissions for the operational training steps.
A second authorized person must independently review the initial formula
release (or use an already released formula). For a team run, hand each step to
the appropriate operator.

| UI permission label | Actions used in this guide |
| --- | --- |
| Inventory | Units, locations, items, customers, receiving, lot metadata/status and stock adjustments; also sales orders |
| Purchasing | Suppliers, item links and purchase orders |
| Packing | Packing orders, material reservations and completion |
| Transfers | Internal transfers and customer delivery orders |
| Users & roles | Creating roles and assigning user accounts; together with Packing, independently reviewing formula releases |

Sales and delivery reuse Inventory and Transfers permissions. There are no separate Sales or Delivery permission switches. A missing create/action button usually means your account lacks the required permission.

### The result you will produce

| Stage | Expected result |
| --- | --- |
| Buy and receive | 100 kg garlic and 1000 each of pouches, labels and seals at the raw-material warehouse |
| Pack | Consume 50 kg garlic and 500 each of the packaging components; produce 500 finished pieces |
| Transfer | Move 200 finished pieces from the finished warehouse through In Transit to a branch |
| Sell and deliver | Deliver 150 pieces from the branch to a customer |
| Final finished stock | 300 pieces in the finished warehouse, 50 at the branch, 0 in transit; company total 350 pieces |

## 2. Sign in and optionally create operator accounts

1. Open the application, enter **Email** and **Password**, and click **Login**.
2. Confirm the sidebar and Dashboard load.
3. If operator roles are needed, open **Users & Access > Roles & Permissions** (`/roles`) and click **Add role**.
4. Enter a **Role name**, an optional description, and the required permission checkboxes. Click **Create role**. Repeat for the operator groups you need.
5. Open **Users & Access > Users** (`/users`) and click **Add user**.
6. Enter first name, last name, email and a password meeting the form's requirements; select the intended **Role**. Enter optional details as appropriate and click **Create user**.
7. Have the operator sign in and confirm the expected pages/actions are available.

**Checkpoint:** at least one active account retains **Users & roles**. You can skip creating roles/users when the supplied training administrator will perform every step.

## 3. Set up units of measure

**Menu:** Master Data > Units of Measure (`/uom`). **Permission:** Inventory.

1. Search for `kg` and `pc`. If both already exist in appropriate classes, reuse them.
2. When a required class is missing, click **Manage classes**, enter **New class name**, and click **Add class**. Create `Mass` and `Count` as needed, then click **Done**.
3. For a new, empty class, click **Add UOM** and create its base unit first using the table below.
4. Select **Unit class**, set **Base unit for this class**, enter **Factor to base unit**, and click **Create unit**.
5. Optionally add grams after the Mass base unit exists.

| Unit name | Class | Base unit? | Factor if creating these classes from empty |
| --- | --- | --- | --- |
| `kg` | Mass | Yes | `1` |
| `g` (optional) | Mass | No | `0.001` |
| `pc` | Count | Yes | `1` |

**Checkpoint:** the required units are selectable. If Mass already uses `g` as its base, `kg` should have factor `1000` instead. Preserve the existing valid base/conversions; do not rebase used units. Boxes/cases with product-specific contents are not needed for this walkthrough.

## 4. Create the inventory locations

**Menu:** Master Data > Locations (`/locations`). **Permission:** Inventory.

1. Click **Add location**.
2. Enter the code and name, choose **Location type**, and keep **Active location** checked.
3. Click **Create location** and repeat for all four rows.

| Code | Name | Location type |
| --- | --- | --- |
| `HP-WH-RM` | HP Raw and Packaging Warehouse | Warehouse |
| `HP-WH-FG` | HP Finished Goods Warehouse | Warehouse |
| `HP-BR-MNL` | HP Manila Branch | Branch |
| `HP-TRANSIT` | HP Goods In Transit | In Transit |

**Checkpoint:** all four locations are active and have the correct types. The two warehouses are separate records. A Packing location is optional and is not used in this example; the packing order consumes directly from the raw warehouse and produces into the finished warehouse. Customers will be entered as contacts, not as locations.

## 5. Create the five items

**Menu:** Master Data > Items / Products (`/items`). **Permission:** Inventory.

First open **Master Data > Brands** (`/brands`) and click **Add brand**. Enter
**Brand code** `HP-KFF`, **Brand name** `HP KFF Spices`, keep **Active brand**
checked and click **Create brand**. Return to Items / Products.

1. Click **Add item**.
2. Enter **SKU**, **Item / product name**, **Item type**, **Primary unit of measure** and **Reference cost** using the table.
3. Keep **Active item** checked. New received and packed lots start Approved in
   the simplified workflow; no separate QC request is required.
4. For the finished good, select **Brand** `HP-KFF` and enter **Net weight (g)** as `100`. Leave Brand as **No brand** for component items. Other optional fields can remain empty for the exercise.
5. Click **Create item**. Repeat until all five items exist.

| SKU | Item / product name | Item type | Primary UOM | Reference cost |
| --- | --- | --- | --- | --- |
| `HP-RM-GARLIC` | HP Garlic Powder Bulk | Raw Material - Bulk | kg | `110` |
| `HP-PCH-100G` | HP 100g Pouch | Packaging - Hardware | pc | `2` |
| `HP-LBL-GARLIC` | HP Garlic 100g Label | Packaging - Label | pc | `0.5` |
| `HP-SEAL` | HP Tamper Seal | Packaging - Hardware | pc | `0.25` |
| `HP-FG-GARLIC-100G` | HP Garlic Powder 100g | Finished Good | pc | `13.75` |

**Checkpoint:** the item types and primary units are correct. Creating items does not create stock. Reference cost is a catalog value; the receiving and packing workflows derive their own historical lot costs. Used item types/primary units become protected, so review them before continuing.

## 6. Create suppliers and link their items

**Menu:** Master Data > Suppliers (`/suppliers`). **Permission:** Purchasing.

1. Click **Add supplier**, enter `HP Spices Supplier`, keep **Active supplier** checked, and click **Create supplier**.
2. Repeat for `HP Packaging Supplier`. Supplier email is optional.
3. On each supplier row, open the three-dot action menu and choose **Link items**.
4. The dialog lists only currently linked items. Click **Link another item**, search by material name or SKU and click **Link item** for the matching materials below. Click **Back to linked items** to review the supplier's links and **Unlink** actions. No offer form is required.
5. Close the dialog. The supplier's **Linked items** count and the summary refresh from saved links. Click **Unlink** to remove a current link; clicking **Link item** again restores the same relationship.
6. Enter the purchase units and prices below when creating the PO in step 9.

| Supplier | Material item SKU | Purchase unit on PO | Unit price on PO |
| --- | --- | --- | --- |
| HP Spices Supplier | `HP-RM-GARLIC` | kg | `110` |
| HP Packaging Supplier | `HP-PCH-100G` | pc | `2` |
| HP Packaging Supplier | `HP-LBL-GARLIC` | pc | `0.5` |
| HP Packaging Supplier | `HP-SEAL` | pc | `0.25` |

**Checkpoint:** the spice supplier shows one linked item and the packaging
supplier shows three. Items shows the same supplier tags. A material can have
several suppliers without duplicating the catalog item. The summary counts
links across suppliers, so one item linked to two suppliers counts twice.
Only active materials linked to the selected active supplier appear on a PO.
These actions create no orders or stock and do not alter saved PO history.

You can also use the **Suppliers** column in Items / Products to link or unlink
a material. Both screens update the same relationship and refresh PO choices.
New links use the item's primary UOM and have no price default; enter the agreed
price on the PO. Previously saved defaults can still prefill a PO, so review
the unit and price before saving. Inactive items may retain a link but cannot
be selected on new POs. Deactivating a supplier unlinks its items; after
reactivating it, link the relevant items again.

## 7. Create the customer

**Menu:** Master Data > Customers (`/customers`). **Permission:** Inventory.

1. Click **Add customer**.
2. Enter **Customer name** as `HP Sample Grocery`.
3. Add contact person, phone, email and delivery address when available. In a training environment, optional fields can remain empty.
4. Keep **Active customer** checked and click **Create customer**.

**Checkpoint:** the customer is active and available for sales orders. Do not create a customer inventory location.

## 8. Create the packing formula through the UI

**Menu:** Master Data > Formula Revisions (`/formula-revisions`). **Permission:** Packing; review also requires User Management and a different user.

1. Click **Prepare request**, enter a unique request number and notes, select
   **Finished product** `HP-FG-GARLIC-100G`, choose **Replace** and an effective date.
2. In the first component select `HP-RM-GARLIC`, enter quantity `0.100` and UOM `kg`.
3. Use **Add component** to add the pouch, label and seal below. Each material
   appears once and each quantity is for **one finished pc**.
4. Review all four rows and **Create draft**. Add an action note and **Submit for review**.
5. Sign in as a different reviewer with Packing and User Management permissions.
   Open the request, inspect its requirements and effective date, enter a review
   note, then **Approve and apply** on or after that date.
6. Sign back in as the operational training account with all five permissions,
   or hand subsequent steps to the appropriate operators. The formula reviewer
   may not have Purchasing, Inventory or Transfers permission.
7. Open **Packing Formulas** (`/bom`) to inspect/export the published definition.
   Future changes or retirement use another reviewed revision. Existing packing
   orders retain their saved requirements after later releases.

| Component SKU | Quantity per finished piece | Component UOM |
| --- | --- | --- |
| `HP-RM-GARLIC` | `0.100` | kg |
| `HP-PCH-100G` | `1` | pc |
| `HP-LBL-GARLIC` | `1` | pc |
| `HP-SEAL` | `1` | pc |

**Checkpoint:** the formula is listed and the product is selectable in Create
packing order without **(no formula)** after approval. Step 12 checks the saved
formula against available material stock.

If using existing sample products, inspect their exact formula, units,
stock and active reservations. Numeric checkpoints below assume the isolated
items and locations created in this guide.

## 9. Create and send the purchase orders

**Menu:** Purchasing > Purchase Orders (`/purchase-orders`). **Permission:** Purchasing.

### Purchase the garlic

1. Click **Create purchase order** and wait for the form to open with an actual
   generated value in **PO number**. Keep it for this walkthrough, or replace
   it with a unique reference before saving.
2. Choose **HP Spices Supplier**, and enter the operation date as **Order date**.
   Optional expected delivery
   must be on or after the order date. Only this supplier's linked active
   materials are selectable; the garlic should be the only material in this
   isolated example.
3. In the first line, select `HP-RM-GARLIC`, **Purchase unit** `kg`, **Ordered quantity** `100`, and **Unit price** `110`.
4. Review the order value `11000` and click **Create draft**. Record the generated
   PO number as your **spice PO** reference for the remaining steps.
5. Open the order's action menu and choose **Mark as sent**. Confirm the action in the dialog.

### Purchase the packaging

1. Click **Create purchase order**, keep the new prefilled **PO number**, and
   choose **HP Packaging Supplier**. Its
   dropdown should show the three linked packaging materials, not the garlic.
2. Enter the operation date. Add the following lines using **Add line** as needed.
3. Review the order value `2750`, click **Create draft**, and record its generated
   number as your **packaging PO** reference. Then **Mark as sent** and confirm.

| Material | Purchase unit | Ordered quantity | Unit price | Line value |
| --- | --- | --- | --- | --- |
| `HP-PCH-100G` | pc | `1000` | `2` | `2000` |
| `HP-LBL-GARLIC` | pc | `1000` | `0.5` | `500` |
| `HP-SEAL` | pc | `1000` | `0.25` | `250` |

**Checkpoint:** both POs show **Sent** and received quantities remain zero. Inventory has not increased. Mark as sent records the business state; it does not email the supplier. Use your normal supplier communication process.

Generated numbers follow a format such as `PO-2026-0001`, using the UTC generation
year and a shared database identity. The counter does not reset yearly and
gaps are possible, including when a form is opened and then abandoned. Getting
the displayed number does not save an order or create stock. This walkthrough
keeps that prefilled value. To use your own reference, replace **PO number**
before clicking **Create draft**. Custom numbers
are trimmed, converted to uppercase and limited to 30 characters. They must be
unique across all orders, including cancelled and older orders, regardless of
case. The displayed number is checked again when saving; it is not reserved
against another user's custom choice. If a prefilled or custom reference has
already been used, enter a different unique number and retry. A failed
duplicate submission saves no PO.

Saved generated and custom numbers cannot be edited. If the supplier changes on
a draft, reselect the materials from the new supplier's options. If an expected
material is absent, fix its supplier link rather than choosing another item.

## 10. Receive the purchased materials

**Menu:** Purchasing > Receiving (`/receiving`). **Permission:** Inventory.

Post receipts only after the goods physically arrive. Each receipt entry represents one lot.

### Receive the garlic

1. Click **Receive stock** and select the generated **spice PO** number recorded
   in step 9.
2. Select **Material** `HP-RM-GARLIC`. Confirm Ordered `100`, Already received `0`, Remaining `100` kg.
3. Enter **Receive quantity** `100`, **Receiving destination** `HP-WH-RM`, and **Internal lot number** `HP-LOT-GAR-001`.
4. Enter the actual supplier lot reference/dates if available. Check the
   inventory preview: `100 kg`, with lot status **Approved**.
5. Click **Receive stock** and verify the successful receipt and PO status **Completed**.

### Receive the packaging

1. Open **Receive stock** again and select the generated **packaging PO** number
   recorded in step 9.
2. Complete one entry per material, using **Add lot** for the additional entries. Choose the correct **Material** in every entry; adding an entry does not guarantee it selects a different PO line.
3. Use destination `HP-WH-RM` for each entry and the following quantities/lots.
4. Review all three entries and click **Receive stock**.

| Material | Receive quantity | Internal lot number | Expected QC |
| --- | --- | --- | --- |
| `HP-PCH-100G` | `1000` pc | `HP-LOT-PCH-001` | Approved |
| `HP-LBL-GARLIC` | `1000` pc | `HP-LOT-LBL-001` | Approved |
| `HP-SEAL` | `1000` pc | `HP-LOT-SEAL-001` | Approved |

**Checkpoint:** both POs are **Completed**. Inventory > Inventory Stock (`/inventory`), filtered to `HP-WH-RM`, shows 100 kg garlic and 1000 pc of each packaging item. Stock Movements (`/inventory/transactions`) shows four positive **Receive** entries linked to the POs, and Lots / Batches shows four purchased lots.

## 11. Inspect the material lots and understand availability

**Menu:** Inventory > Lots / Batches (`/inventory/lots`). **Permission:** Inventory.

1. Search for `HP-LOT-GAR-001` and inspect it using **View lot**.
2. Verify its purchased origin points to the correct PO line and supplier.
3. Inspect its location balance: 100 kg on hand, 0 kg reserved and 100 kg
   available at `HP-WH-RM`. Inspect the three packaging lots in the same way.
4. Expand **Why does a lot have reserved stock?** when you need an explanation. Reserved
   stock is already committed to an order but still included in physical on hand.

**Checkpoint:** all four newly received lots are Approved and unexpired, or
undated where allowed. No QC Decision or disposition step is needed. Existing
held/rejected lots retain their status. Inventory managers may correct lot
status through **Edit metadata**, subject to reservation and date validation;
setting Approved does not override operational expiry restrictions, create stock
or move it between locations. The Lots list totals
a lot across locations, while detail and Inventory Stock separate locations.

## 12. Preview and create the packing order

**Menu:** Packing > Packing Orders (`/packing-orders`). **Permission:** Packing.

1. Click **Create packing order**.
2. Enter **Order number** `HP-PK-001`, select **Finished product** `HP-FG-GARLIC-100G`, and enter **Target quantity** `500` pc.
3. Select **Material source** `HP-WH-RM` and **Finished goods destination** `HP-WH-FG`. Optionally enter the scheduled date and notes.
4. Wait for the automatic **Material availability** preview. There is no separate Preview button to press.
5. Check the requirements below. With the isolated starting stock and no reservations, **Maximum producible** should be `1000 pc`, every shortage zero, and the message **Materials available for target**.
6. Click **Create draft**, then use **View details** to review the saved material requirements.

| Material | On hand before planning | Required for 500 pc | Available before planning |
| --- | --- | --- | --- |
| Garlic | 100 kg | 50 kg | 100 kg |
| Pouch | 1000 pc | 500 pc | 1000 pc |
| Label | 1000 pc | 500 pc | 1000 pc |
| Seal | 1000 pc | 500 pc | 1000 pc |

**Checkpoint:** `HP-PK-001` is **Draft**. Requirements have been saved as the order's historical snapshot. No materials have been reserved or consumed. Product, source and target are fixed after creation; review them before saving.

## 13. Plan and reserve, then start packing

1. On `HP-PK-001`, open the row action menu and choose **Plan and reserve**. Confirm **Plan and reserve** in the dialog.
2. Verify status **Planned**.
3. Open **Packing > Material Reservations** (`/packing-orders/reservations`) and find the reservations for `HP-PK-001`.
4. Confirm 50 kg garlic and 500 pc each of pouch, label and seal are reserved against their lots at `HP-WH-RM`.
5. Return to Packing Orders, choose **Start packing**, and confirm **Start packing**.

**Checkpoint:** status is **In Progress**. On hand remains 100 kg garlic and 1000 pc of each packaging item. Reserved is 50 kg and 500 pc respectively; available is 50 kg and 500 pc. Starting packing does not deduct stock. The system chooses eligible material lots by earliest expiration, with undated lots last.

## 14. Complete packing and create finished stock

1. After physical packing is complete, choose **Complete packing** on `HP-PK-001`.
2. Enter **Actual output** `500` pc and **Finished lot number** `HP-LOT-FG-001`.
3. Enter actual manufacture/expiration dates where applicable. For this exercise optional dates can remain empty.
4. Click **Complete packing** and wait for success.
5. Verify status **Completed**, actual output `500`, the finished lot, and the Consume/Produce movements.

| Item | Location | On hand after completion | Active outstanding reservation |
| --- | --- | --- | --- |
| Garlic | `HP-WH-RM` | 50 kg | 0 |
| Pouch | `HP-WH-RM` | 500 pc | 0 |
| Label | `HP-WH-RM` | 500 pc | 0 |
| Seal | `HP-WH-RM` | 500 pc | 0 |
| Finished garlic 100g | `HP-WH-FG` | 500 pc | 0 |

**Checkpoint:** four **Consume** entries deduct 50 kg garlic and 500 pc of each
packaging component; one **Produce** entry adds 500 pc of `HP-LOT-FG-001`. The
finished lot traces to `HP-PK-001` and starts Approved, ready for distribution
when stock, location and expiry checks pass.

## 15. Transfer 200 finished pieces to the branch

**Menu:** Transfers > Stock Transfers (`/transfers`). **Permission:** Transfers.

### Create the transfer

1. Click **Create transfer** and enter **Transfer number** `HP-TR-001`.
2. Select **Source warehouse** `HP-WH-FG` and **Destination** `HP-BR-MNL`.
3. Use **Add a finished-product lot** to select `HP-LOT-FG-001` and enter **Requested quantity** `200` pc.
4. Click **Create draft**. Confirm status **Draft**; stock remains unchanged.

### Dispatch

1. Choose **Dispatch** on the transfer.
2. Select **In Transit location** `HP-TRANSIT` and enter **Ship** `200` pc.
3. Click **Confirm dispatch**.
4. Check status **In Transit**, warehouse stock `300 pc`, transit stock `200 pc`, and branch stock `0 pc`.

### Receive at the branch

1. After the branch physically receives all 200 pieces, locate `HP-TR-001` in Stock Transfers or its **In Transit** tab.
2. Choose **Confirm receipt** and enter **Receive now** `200` pc.
3. Click **Confirm receipt** and verify status **Completed**.

**Checkpoint:** `HP-WH-FG` holds 300 pc, `HP-BR-MNL` holds 200 pc, and transit holds 0 pc of the same finished lot. Company finished stock remains 500 pc. Stock Movements contains paired Transfer entries for dispatch and receipt.

## 16. Create and confirm the sales order

**Menu:** Sales & Delivery > Sales Orders (`/sales-orders`). **Permission:** Inventory.

1. Click **Create sales order**.
2. Enter **Sales order number** `HP-SO-001`, choose **Customer** `HP Sample Grocery`, and enter the operation date as **Order date**.
3. Select product `HP-FG-GARLIC-100G`, enter **Quantity** `150` pc and **Unit price** `25`. The example order value is `3750`.
4. Optional requested delivery date must be on or after the order date. Click **Create sales order**.
5. Verify **Draft**, then choose **Confirm order** and confirm **Confirm order** in the dialog.

**Checkpoint:** the order is **Confirmed**, with ordered `150`, delivered `0` and remaining `150` pc. Source stock has not changed and confirmation has not reserved warehouse/branch stock.

## 17. Allocate and dispatch the customer delivery

**Menu:** Sales & Delivery > Delivery Orders (`/delivery-orders`). **Permission:** Transfers.

### Create the draft delivery

1. Click **Create delivery order**.
2. Enter **Delivery number** `HP-DO-001` and a **Delivery date** on or after the sales order date.
3. Select **Sales order** `HP-SO-001` and **Source location** `HP-BR-MNL`.
4. Select the sales **Product**, **Finished-product lot** `HP-LOT-FG-001`, and **Quantity** `150` pc.
5. Click **Create delivery order** and verify **Draft**.

**Checkpoint:** the sales line has `150 pc` allocated to an active delivery, but completed delivered quantity remains `0`. The branch still has 200 pc; a delivery draft allocates customer demand without reserving or moving source stock.

### Dispatch after shipment leaves the branch

1. Choose **Dispatch** on `HP-DO-001`.
2. Select **In Transit location** `HP-TRANSIT` and click **Dispatch delivery**.
3. Verify delivery status **In Transit**.

**Checkpoint:** branch stock is 50 pc. Transit stock is 150 pc, reserved for this delivery, so its available quantity is 0. Finished warehouse stock remains 300 pc. Company finished stock is still 500 pc; the sales line still has completed delivered quantity 0. This dispatch creates paired **Transfer** movements, not a Sale yet.

## 18. Confirm customer receipt and verify completion

1. After the customer receives the entire 150-piece shipment, choose **Confirm customer receipt** on `HP-DO-001`.
2. Review the customer and delivery reference, then click **Confirm customer receipt** in the dialog.
3. Verify the delivery is **Completed**.
4. Open Sales Orders and inspect `HP-SO-001`: it should be **Completed**, with ordered `150`, delivered `150`, remaining `0`, and active allocated `0` pc.
5. In Inventory Stock, filter to `HP-LOT-FG-001` and check the final balances below.

| Location | Finished on hand | Active outstanding reservation | Available |
| --- | --- | --- | --- |
| `HP-WH-FG` | 300 pc | 0 pc | 300 pc |
| `HP-BR-MNL` | 50 pc | 0 pc | 50 pc |
| `HP-TRANSIT` | 0 pc | 0 pc | 0 pc |
| **Company total for this finished item/lot** | **350 pc** | **0 pc** | **350 pc** |

**Checkpoint:** Stock Movements shows one **Sale** of `-150 pc` at `HP-TRANSIT`, linked by the delivery reference `HP-DO-001`. The shipment reservation is consumed/released. Reconciliation: **500 produced - 150 sold = 350 company-owned pieces**. The internal transfer did not reduce company inventory.

## 19. End-of-run review

Use the operational screens to verify the completed exercise:

- **Purchase Orders:** the generated spice and packaging PO references are
  Completed with no remaining receipt quantities.
- **Lots / Batches:** the four material lots link to purchase lines; `HP-LOT-FG-001` links to the completed packing order. Use **View lot** to inspect its locations and movements.
- **Packing Orders:** `HP-PK-001` is Completed with 500 pc output and the original four-component snapshot.
- **Material Reservations:** this packing order has no active outstanding allocations. Consumed reservation history remains visible.
- **Stock Transfers:** `HP-TR-001` is Completed, with shipped 200 and received 200 pc.
- **Sales Orders / Delivery Orders:** `HP-SO-001` and `HP-DO-001` are Completed.
- **Inventory Stock:** raw materials remain at 50 kg garlic and 500 pc each of packaging; finished stock totals 350 pc in the locations above.
- **Stock Movements:** four Receive entries, four Consume entries, one Produce entry, four internal-transfer entries, two customer-dispatch Transfer entries and one Sale entry: **16 ledger entries** for this isolated exercise.

Use filters for the `HP-` references, items, lots and locations. Export operational
table rows where needed. Do not add kilograms and pieces together. The
historical [audit](documentation-compliance-audit.md) records earlier findings
and follow-ups. Current Dashboard totals are grouped by primary UOM, open lists
filter by status, and low-stock alerts include unstocked items. Use operational
screens and reports to check the exact documents in this exercise.

### Review and export inventory reports

**Menu:** Reports > Inventory Reports (`/reports/inventory`). **Access:** any
authenticated account, including Viewer. The reports are read-only.

1. Open **Stock by Location**, select the finished product `HP-FG-GARLIC-100G`,
   and click **Apply filters**. The company total is 350 pc after customer
   delivery; warehouse and branch quantities remain separate rows. Inspect the
   primary-unit total, with no addition of kg and pc.
2. Open **Stock by Lot** with the same item filter. Inspect `HP-LOT-FG-001`, its
   QC, expiry, location balances and packing source. Stock is current, not a
   historical balance reconstructed from a date range.
3. Open **Low Stock**, set the threshold to `10`, and apply. The selected product
   is absent when its available company stock exceeds 10 pc. Choose a location
   where it has no stock, or create an active unstocked item, to see a zero row.
   An explicit threshold overrides saved reorder levels for this report. Leave it
   blank to use item/company defaults. Reset filters before reviewing other items.
4. Open **Near Expiry**, reset filters, enter a window and choose whether to
   include already expired stock. Only positive stock with an expiration date
   appears. A date equal to today is "Expires today"; dates use UTC.
5. Open **Inventory Movement**, reset filters, search `HP-`, optionally choose
   the exercise's UTC date range, and apply. With no movement-type filter the
   isolated exercise has 16 ledger entries. Selecting **Sale** shows the
   `-150 pc` customer-delivery entry with its delivery/sales source reference.
6. Sort columns, use **Columns** or select rows, then choose **Export CSV** for
   all matching rows across pages or **Export selected** for the selection.
   Click **Refresh report** after later operations. Errors retain cached rows
   during a failed background refresh; retry before treating them as current.

See [Inventory Reports](inventory-reports-module.md) for all filters and
[the sample-data guide](test-data.md) for prepared expiry, reservation, transit
and unstocked-item records and their test-account setup.

## 20. Optional practice after the main happy path

These are separate exercises. They change the main example's quantities or statuses, so record their results separately.

| Exercise | UI procedure | Expected behavior |
| --- | --- | --- |
| Partial PO receipt | On a new Sent PO for 100 kg, receive 60 kg under one new lot; later receive 40 kg under another new lot. | PO moves Partially Received, then Completed; each receipt creates its own lot and Receive entry. |
| Packing below target | On a new 500-piece order with the same formula, plan/start and complete with actual output 400. | Consume 40 kg garlic and 400 pc of each component; produce 400 pc and release unused allocations. |
| Partial internal receipt | On a new transfer shipping 200 pc, confirm **Receive now** 120, then later 80. | First receipt leaves 80 In Transit; second completes. Enter increments, not cumulative quantities. |
| Partial sales fulfillment | On a new confirmed order for 150 pc, complete one delivery for 100 and another for 50. | Sales becomes Partially Delivered, then Completed. Each delivery confirms receipt of its whole shipment. |

### Record a genuine stock-count difference

**Menu:** Inventory > Stock Adjustments (`/inventory/adjustments`).
**Permission:** Inventory. Configure an active Inventory Adjustment reason in
**Master Data > Reason Codes** first. This is a direct correction, not a Count
Session or a separate review request. The old `/inventory/counts` address
redirects here.

1. Physically count one specific item/lot/location, including its reserved stock.
2. Click **Record adjustment**, choose **Item and lot**, **Location**, and **Adjustment reason**.
3. Review the displayed on-hand and reserved quantities. Enter the final physical **Counted quantity**, not the difference, and add a **Count reference** if available.
4. Click **Record adjustment**, then verify the balance and signed **Adjustment** movement.

For example, if the branch's physical finished stock is actually 48 rather than
the recorded 50, entering `48` posts `-2 pc`. This changes the exercise's company
total to 348 pc. Apply a correction only for a verified difference or the agreed
training scenario. An unchanged count is rejected without saving a count-session
observation. The backend also rejects a stale expected balance or a count below
outstanding reservations. Permanent disposal uses Scrap & Disposal instead.

## 21. If a step cannot continue

| What you see | What to check or do |
| --- | --- |
| Missing action or view-only message | Ask the administrator to review the account's permission from section 1, then refresh the session. |
| Unit or location cannot be changed | A used unit's conversion or location type is protected. Select/create the correct master record; do not repurpose a referenced record. |
| Product says **(no formula)** | Prepare and independently release its formula through Formula Revisions as described in step 8. |
| PO missing from Receiving | It must be Sent or Partially Received with an outstanding quantity. A Draft cannot be received. |
| Material missing from a PO dropdown | Select its supplier first. Add or activate that supplier's material link in Suppliers or Items, check material activity, then refresh options. |
| Receiving reports changed balances | Click **Review latest balances**, inspect remaining quantities, and correct the entered lot quantities before resubmitting. |
| Duplicate lot or document number | Find the existing record to determine whether the save succeeded; use a new unique reference only for genuinely new work. |
| PO number already used | Enter a different unique reference and retry. Prefilled numbers are checked again on save; letter case cannot distinguish two numbers. |
| Create form cannot get a PO number | Review the displayed error, check Purchasing permission and retry Create purchase order. Getting a number alone does not save an order. |
| Packing preview has a shortage | Check the source location, saved formula, QC approval, expiry and other active reservations. Replenish or revise the plan. |
| Finished lot unavailable for transfer/delivery | Check positive available stock at the selected source, active product/location, Approved and unexpired lot, and packing-order provenance. |
| Customer or sales order missing | Customer must be active for new sales; deliveries require a Confirmed or Partially Delivered order with unallocated demand. |
| Count below reservations | Recheck the count and resolve the protected commitments through their owning workflow before applying a correction. |
| Save/receipt response is uncertain | Reopen the document and review its saved state, movements and outstanding quantities before submitting again, especially for incremental transfer receipts. |

Company configuration and formula release are supported setup steps above.
Scrap & Disposal remains available for exceptions with independent review.
Count Sessions, QC Decisions and Stock Dispositions are retired, not missing
steps in the happy path. Their old records are retained through authenticated
history APIs; old pages redirect to Inventory Stock. Previously held-location
balances remain visible, but this simplified flow adds no replacement operation
to release goods from those locations. The customer path has no invoice,
payment, return or dispatched-delivery reversal workflow in the current scope.

## Reference documents

- [Complete system flow](system-flow.md)
- [Documentation compliance audit](documentation-compliance-audit.md)
- [Users and roles](roles-users-module.md)
- [Units and locations](uom-locations-modules.md)
- [Items](items-module.md), [suppliers](suppliers-module.md) and [customers](customers-module.md)
- [Purchase orders](purchase-orders-module.md) and [receiving/lots](receiving-lots-modules.md)
- [Brands and Packing Formulas](brands-packing-formulas-modules.md)
- [Packing orders and reservations](packing-orders-module.md)
- [Internal transfers](stock-transfers-module.md)
- [Sales and delivery orders](sales-delivery-modules.md)
- [Inventory stocks and count corrections](inventory-stocks-module.md)
- [Inventory Reports](inventory-reports-module.md)
- [Prepared sample data and test accounts](test-data.md)

This is an operator guide checked against repository source, not a record of a live browser acceptance test. Follow the checkpoints in your configured environment.


## Reviewed controls and operational reports

Use the [complete controls happy paths](inventory-controls-and-reports.md) for
Company Settings, pack ratios/barcodes, reorder levels, reason codes, scrap approval and formula
release/retirement. Set master data before creating operational records.

Use Formula Revisions to prepare and independently release a formula, then
create a future packing order using that published definition. Use Stock
Adjustments for verified count differences. Historical Count/QC/Disposition
samples are retained for history and cannot be resumed; they are not steps to
perform in a new operator run.

Use Reports → Packing/Purchasing/Transfers to inspect variance, exposure and
outstanding transit. Use Lot Genealogy to trace the purchased garlic lot into
finished lots and their movements. Apply filters, select records and export CSV.
Inventory Low Stock uses saved reorder levels unless a threshold override is
entered. Dashboard quantities remain separate by primary UOM.
