# Sales and delivery orders

These modules implement the customer fulfillment flow in section 17 of the
[system flow](system-flow.md). That document is the business specification;
this contract describes the implemented API, validation, persistence and scope.
The frontend routes are `/sales-orders` and `/delivery-orders`.

## Workflow

1. Create a draft sales order for an active customer, with active finished products,
   quantities in each product's primary UOM, unit prices, order date, optional
   requested delivery date, and notes. Edit drafts and confirm when ready.
2. Create draft delivery orders against a Confirmed or Partially Delivered sales
   order. Select a source warehouse, branch, or store, and the finished-product lots.
   A delivery can fulfill part of the order or split an order line across lots.
3. Dispatch the delivery to an active In Transit location. This deducts source
   stock, adds transit stock, records paired Transfer entries, and reserves the
   shipment in transit in one transaction. Dispatch rechecks current availability,
   lot approval/expiry, product activity, and packing-order provenance.
4. Complete the delivery after the customer receives the entire shipment. This
   deducts its original transit stock, appends negative Sale ledger entries,
   consumes/releases the shipment reservations, updates sales line fulfillment,
   and marks the delivery Completed atomically. The sales order becomes Partially
   Delivered or Completed based on all its lines.

Delivery line qtyDelivered is the planned shipment quantity on a draft and the
committed full shipment quantity after dispatch. Sales line qtyDelivered counts
only completed customer deliveries. Sales line qtyAllocated counts Draft and
In Transit deliveries. qtyRemaining = qtyOrdered - qtyDelivered; a new delivery
can allocate qtyRemaining - qtyAllocated. Sales confirmation does not reserve
physical inventory. Delivery drafts allocate order quantities, while dispatch
checks physical stock. Packing and other active inventory reservations reduce
available stock. Transit shipment reservations protect deliveries from unrelated
stock writers and physical counts below the reserved amount.

Sales states: Draft, Confirmed, Partially Delivered, Completed, Cancelled.
Delivery states: Draft, In Transit, Completed, Cancelled.
Only drafts can be edited. Only draft deliveries can be cancelled; this releases
the order allocation without stock movements. An unfulfilled Draft or Confirmed
sales order can be cancelled only after all its deliveries are cancelled.
Dispatched and completed records cannot be cancelled or deleted. Repeated or
invalid state transitions return 409 and leave inventory unchanged.

The module does not implement invoices, payments, receivables, returns, partial
receipt of an individual delivery, or reversal of a dispatched delivery. Use
separate delivery orders for partial fulfillment. Customer receipts remove goods
from company inventory; customers are contact records rather than company locations.

## API and permissions

All endpoints require authentication. Sales writes require canManageInventory;
delivery writes require canManageTransfers. These reuse existing role settings.
The backend enforces permissions independently of visible frontend actions.

| Method | Sales route | Delivery route | Behavior |
| --- | --- | --- | --- |
| GET | /api/sales-orders | /api/delivery-orders | Complete collection with detail lines |
| GET | /api/sales-orders/options | /api/delivery-orders/options | Configured form options and current availability |
| GET | /api/sales-orders/:id | /api/delivery-orders/:id | One complete order or 404 |
| POST | /api/sales-orders | /api/delivery-orders | Create draft, return 201 |
| PATCH | /api/sales-orders/:id | /api/delivery-orders/:id | Update supplied draft fields |
| POST | /api/sales-orders/:id/confirm | — | Confirm sales order, body {} |
| POST | /api/sales-orders/:id/cancel | /api/delivery-orders/:id/cancel | Cancel eligible order, body {} |
| POST | — | /api/delivery-orders/:id/dispatch | Dispatch, body {transitLocationId} |
| POST | — | /api/delivery-orders/:id/complete | Complete full shipment, body {} |

Sales inputs contain salesOrderNumber, customerId, orderDate,
requestedDeliveryDate (optional/nullable), notes (optional/nullable), and lines
[{itemId, uomId, qtyOrdered, unitPrice}]. Each product appears once.
Delivery inputs contain deliveryOrderNumber, salesOrderId, sourceLocationId,
deliveryDate, notes (optional/nullable), and lines
[{salesOrderLineId, lotId, qtyDelivered}]. Each lot appears once per delivery;
the backend derives itemId from the sales line and verifies the lot matches.
PATCH inputs are partial and cannot be empty. Server-generated primary IDs,
statuses, ledger fields, fulfillment counts, and audit identities cannot be
supplied by clients. Required customer, item, UOM, sales-line, lot and location
foreign-key IDs remain writable as specified above.

Order numbers normalize to uppercase, are unique per module, and allow up to
30 characters. Quantities and prices are decimal strings with up to 10 whole
and four fractional digits; quantities must be positive, prices may be zero.
Responses preserve exact decimal strings. Totals use integer decimal arithmetic
and round line amounts half up to four places. Dates use YYYY-MM-DD; requested
delivery dates cannot precede order dates, and delivery dates cannot precede
the associated sales order date. Empty notes normalize to null; omitted PATCH
fields remain unchanged. Audit IDs come from the authenticated user.

Responses use the shared {success:true,data} envelope. Missing records return
404, invalid input returns 400 with structured details, and availability or state
conflicts return 409. No hard-delete endpoint is exposed. List DTOs include all
lines, supporting complete client filtering, statistics, selection, and CSV export.

## Persistence and deployment

The authoritative [schema](../backend/src/db/schema.ts) adds sales_orders,
sales_order_lines, delivery_orders, and delivery_order_lines, with foreign keys,
unique order numbers, quantity constraints, and audit fields. Delivery lines link
to sales lines and the existing finished lots, preserving their packing origin.

Apply the additive [migration](../backend/supabase/migrations/20261105000000_sales_delivery_orders/migration.sql)
to the intended database before using these modules. It adds the Sale transaction
type, delivery ledger references, and delivery-linked inventory reservations.
Inventory reservation ownership is exactly one packing material or delivery line.
Existing packing reservations retain their original links. Stock Movements can
filter Sale transactions and displays their delivery order reference.

Sales headers serialize changes to fulfillment and delivery allocations. Inventory
writes lock items/lots and active locations before balances and reservations,
following the existing writers' ordering. Dispatch and completion hold those locks
through ledger, balance, reservation, and document commit. The migration snapshot
preserves prior unrelated entities and includes all new tables, enum values,
columns, keys, indexes, and constraints. No live database migration is applied
automatically by application startup.

## Sample data

The [sample loader](test-data.md) defines five sales orders and six delivery
orders covering every supported status, including partial fulfillment, shared
transit lots, completed Sale entries, and active/consumed delivery reservations.
Its six role/account assignments include Sales and Delivery accounts using the
existing inventory and transfer permissions. Loading is explicit and applies
only to an empty initialized test database; existing datasets are preserved.

## Verification

Backend request tests cover authentication, independent permissions, server audit
identity, normalization, strict inputs, decimal precision, missing records, and
safe database errors. Schema tests cover dates, duplicate products/lots, PATCH
omission/null handling, and exact totals. Frontend request tests verify paths,
payloads, DTO validation, cancellation, and failure handling.

The opt-in sales-delivery-integration.test.ts suite uses TEST_DATABASE_URL only,
creates a random isolated schema, and verifies partial/final fulfillment,
concurrent order allocation, concurrent stock dispatch, packing reservations,
shared transit protection, lot traceability, repeated transitions, cancellation,
and rollback after failed ledger writes. It checks ledger/balance equality.
It skips when a dedicated test database is not configured; it never falls back
to the application's DATABASE_URL.
