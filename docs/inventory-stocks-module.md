# Inventory Stocks module

Inventory -> Inventory Stock lives at `/inventory`. Master Data ->
Items at `/items` defines catalog records and does not expose stock quantities.
This module follows [the complete system flow](system-flow.md), especially
inventory, reservations, adjustments, and In Transit movements.

## Stock balances and access

A stock balance is identified by item, lot, and location. The backend reads
`inventory_stock` joined to item, primary UOM, lot, and location metadata.
All authenticated users can view and export balances. Adjustment options and
writes require `canManageInventory === true`, enforced on the backend.
Each balance includes the location's active status so row actions can omit
inactive locations. Managers load adjustment options when they first open the
form; ordinary stock browsing does not fetch every lot option.

- On hand includes reserved goods and stock at every location, including
  In Transit. It is not a writable item catalog property.
- Reserved is the sum of `qtyReserved - qtyConsumed` for matching item/lot/location
  reservations where `releasedAt` is null. Released and consumed quantities do
  not reduce availability twice. Include both packing-material reservations and
  delivery-line reservations protecting dispatched goods at In Transit locations.
- Available equals on hand minus reserved. QC approval and expiry still govern
  operational use; availability alone does not authorize packing or dispatch.
- SQL computes authoritative per-balance quantities as exact decimal strings.
  The UI formats and sorts without floating-point conversions. Summary cards
  aggregate separately by primary UOM; kg and pieces are never added together.
- Keep zero balances and all QC/location types visible. Negative availability
  from inconsistent existing reservations is shown rather than clamped to zero.
- Search, item/location/QC/availability filters, CSV export, row selection,
  column visibility, sorting, and pagination share the users-module pattern.
  Cards summarize all loaded balances; the table and CSV reflect filters.

## Adjustment behavior

Use Record adjustment beside the page title or Adjust stock in a row menu.
Choose an existing lot, a location, an Inventory Adjustment reason, and the
final physical count. A reference is optional. Counted stock includes reserved
stock; it must not be lower than active reservations.

The form preserves the observed on-hand quantity. The backend compares that
expected value under a lock, and returns 409 if it changed. Reopen the form after
refreshing stock to submit a fresh count. Numerically equivalent strings such as
`10` and `10.0000` represent the same count. Unchanged counts return 400 and do
not create empty ledger entries.

A count can establish a balance for an existing lot/location pair that has no
balance yet. It starts from zero inside the transaction. This does not create
lots, change provenance, replace purchase receiving, or produce finished goods.
New lots still come from their documented source workflows.

Within one PostgreSQL transaction, the service locks the lot, obtains/locks the
balance, locks matching reservation rows, checks the count and reservations,
updates the balance, and appends an `Adjustment` ledger entry with reason,
quantity difference, optional reference, and authenticated actor. Any failure
rolls back the entire operation, including a newly established balance.
There is no direct balance PATCH/DELETE or ledger editing endpoint.

## Stock movements, adjustments, and counts

- Stock Movements at `/inventory/transactions` reads the append-only ledger. It
  shows signed quantities in each item's primary UOM, lot, location, source
  document, reason, timestamp, and authenticated actor. The list can be filtered
  by transaction type, item, lot, and location; the page offers search, sorting,
  location/type filters, pagination, and CSV export.
- Stock Adjustments at `/inventory/adjustments` shows only `Adjustment` ledger
  entries and opens the existing counted correction form. A successful correction
  refreshes both stock balances and ledger history.
- The legacy `/inventory/counts` route redirects to Stock Adjustments.
  Count Sessions, QC Decisions and Stock Dispositions are removed from active
  navigation and writes. Saved requests and observations remain read-only through
  the authenticated controls API; see
  [retired controls](inventory-controls-and-reports.md).

Movement history is read-only for authenticated users. Recording a correction
still requires `canManageInventory`; the backend enforces that permission.

Other inventory writers must coordinate locks in this order: lots by ascending
ID, active locations by ascending ID, stock balances, then reservation rows by
ascending ID. The parent lot lock
also serializes new FK references; existing reservation rows are locked even
when released. Reuse this protocol for receiving, reservations, packing, and
transfers rather than updating balances outside a transaction.

Customer deliveries follow the same stock and reservation rules. Dispatch pairs
negative source and positive In Transit `Transfer` entries; delivery completion
appends a negative `Sale` entry, consumes/releases its own transit reservation,
and updates sales fulfillment atomically. See the
[Sales and Delivery contract](sales-delivery-modules.md). Internal transfers
retain company inventory; completed customer deliveries reduce it.

## API contract

| Method | Endpoint | Access / result |
| --- | --- | --- |
| GET | `/api/inventory/stocks` | Authenticated; complete list of balances |
| GET | `/api/inventory/stocks/:id` | Authenticated; one balance or 404 |
| GET | `/api/inventory/stocks/options` | Inventory manager; existing lots, locations, adjustment reasons |
| POST | `/api/inventory/stocks/adjustments` | Inventory manager; creates count correction, returns 201 |
| GET | `/api/inventory/movements` | Authenticated; ledger history, optionally filtered by `transactionType`, `itemId`, `lotId`, or `locationId` |

Optional list filters are `itemId`, `lotId`, `locationId`, `qcStatus`, and
`availability` (`available` or `unavailable`). IDs are positive PostgreSQL
integers. The frontend loads the complete collection and filters locally.

Adjustment body:

```json
{
  "lotId": 2,
  "locationId": 3,
  "reasonId": 4,
  "expectedQtyOnHand": "10.0000",
  "qtyOnHand": "12.0001",
  "referenceId": "COUNT-2026-001"
}
```

Counts are non-negative decimal strings, with up to 10 whole digits and 4
fractional digits, matching `numeric(14,4)`. The reference can be omitted or null
and is limited to 60 characters. Unknown fields and client-supplied actors,
ledger IDs, reserved quantities, and quantity deltas are rejected.

Successful adjustment data is `{ stock, transactionId, qtyChange }` inside the
shared success envelope. Validation returns 400; missing balances 404;
unauthorized access 401/403; stale counts/reservation conflicts 409. Database
failures reuse shared safe error middleware.

Existing lots, locations, and reason codes in the Inventory Adjustment category
must be configured before adjustments can be recorded. The UI explains missing
setup and never creates demo master data. The original counted-adjustment
workflow uses the existing inventory tables. The current shared schema also
includes the delivery references and `Sale` type added by the
[Sales and Delivery migration](../backend/supabase/migrations/20261105000000_sales_delivery_orders/migration.sql).
Apply the current schema before using the updated application.

## Inventory reporting

The read-only [Inventory Reports module](inventory-reports-module.md) provides
stock by location, stock by lot, low stock, near expiry and ledger movement
reports. It uses current balances and every outstanding unreleased reservation,
including customer deliveries in transit. Report totals remain separated by
primary UOM. Reporting never edits inventory or reservation records.

## Verification

Run backend `npm test` and `npm run typecheck`; frontend `npm run test:api`,
affected-file lint, and `npm run build`. Tests cover HTTP contracts, authorization,
input validation, decimal accuracy, partial/released reservations, reserved-stock
protection, stale counts, and totals grouped by unit. HTTP tests use fake services.
Verify transaction rollback, real FK/locking concurrency, and ledger/balance
consistency separately against an isolated PostgreSQL test database, and check
interactive table/form behavior in a browser when available.
