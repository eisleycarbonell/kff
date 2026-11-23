# Step-by-step system flow guide

This document is an entry point to the [canonical 26-section system flow](system-flow.md),
which remains the single business specification. Use [module descriptions and
demo walkthroughs](module-demo-guide.md) for every active module and the
[UI happy path](ui-setup-and-happy-path.md) for detailed field/checkpoint steps.
The former duplicated guide contained obsolete table names, statuses, Brands
and QC/count/disposition steps; the sequence below reflects the current app.

1. Configure Company Settings, Users and Roles, compatible UOMs and company
   Locations. Retain administrator access and a separate scrap reviewer.
2. Create bulk ingredients, hardware, printed-label items and finished goods.
   Select a Packaging - Label item in each finished product's Labels field.
   Link purchased materials to active suppliers. Define each product's
   per-unit ingredients, packaging, and label directly in Packing Formulas (`/bom`).
3. Record the customer's PO in a Draft Sales Order with selected products,
   quantities and prices. Open Material plan, select the raw source and inspect
   eligible finished stock, packing gap, aggregate BOM requirements and shortages.
4. Create supplier Purchase Orders for missing materials. Keep the generated
   number or choose a unique custom reference before saving. Review and mark
   Sent; this records purchasing intent without changing stock.
5. Receive actual arrivals against outstanding PO lines into raw/packaging
   storage. Each receipt creates a purchased lot linked to its PO line, Receive
   ledger entry and stock balance atomically. New lots start Approved. Partial
   receipt leaves the remaining quantity outstanding.
6. Refresh the advisory plan, then create Packing Orders with source and
   finished destination. Draft snapshots the BOM; Plan and reserve creates
   material allocations; Start changes status; Complete consumes inputs,
   releases unused reservations, creates a finished lot linked to the order
   and posts Produce into finished storage atomically.
7. When branch distribution is needed, create a Stock Transfer with distinct
   source/destination. Dispatch moves company stock into In Transit; confirmed
   incremental receipt moves it into the branch/store. Partial receipts leave
   the balance in transit. Stock remains company-owned.
8. Confirm customer demand and create Delivery Orders against unallocated
   sales quantities. Draft allocates demand. Dispatch rechecks finished-lot
   stock and moves/protects it in In Transit. Whole-shipment customer receipt
   posts negative Sale, closes shipment reservations and updates fulfillment.
9. Inspect Inventory Stock, Lots, Movements, Dashboard and reports. Use direct
   Stock Adjustments only for verified physical-count differences; independently
   reviewed Scrap & Disposal records permanent removal. Retired Count Sessions,
   QC Decisions and Stock Dispositions remain historical only.

Current database stock tables are `inventory_stock`, `inventory_transactions`
and shared `inventory_reservations`; there are no separate branch balances or
packing/delivery reservation tables. Inventory keys are item, lot and location.
Available stock is on hand less active outstanding reservations. Compatible
inputs convert into the item's primary UOM; item pack ratios take precedence.
Every stock mutation updates balance and append-only ledger in one transaction.

| Workflow | Current statuses |
| --- | --- |
| Supplier PO | Draft, Sent, Partially Received, Completed, Cancelled |
| Packing | Draft, Planned, In Progress, Completed, Cancelled |
| Stock Transfer | Draft, In Transit, Completed, Cancelled |
| Sales Order | Draft, Confirmed, Partially Delivered, Completed, Cancelled |
| Delivery Order | Draft, In Transit, Completed, Cancelled |

| Ledger type | Meaning |
| --- | --- |
| Receive | Purchased quantity added to receiving storage |
| Consume | Packing materials removed |
| Produce | Finished packing output added |
| Transfer | Paired negative/positive movement between company locations |
| Sale | Completed customer shipment removed from company inventory |
| Adjustment | Signed verified count difference |
| Scrap | Permanent stock removal |

Sales writes use `canManageInventory`; Delivery writes use
`canManageTransfers`; Receiving requires Inventory. Supplier/PO writes need
Purchasing, Packing writes need Packing, and account/role/settings writes need
Users & roles. Formula/Scrap review also requires a different authorized user
with Users & roles. See [system-flow section 19](system-flow.md#19-users-and-roles).

Material planning creates no reservation, PO, packing order or ledger entry.
It reads current supply for one sales order; other orders can compete for that
unreserved stock. Future PO receipts and unfinished packing are not available
supply. Committed planning/dispatch validate concurrency under database locks.

Use [realistic demo setup](test-data.md) for fictional normal-name records and
safe upgrades. Saved references and ledger history are preserved during updates;
only fresh imports use the new ordinary order references.
