# Inventory Reports

The [Inventory Reports page](<../frontend/src/app/(protected)/reports/inventory/page.tsx>)
at `/reports/inventory` implements the five inventory reports in section 18 of
the [system flow](system-flow.md). All authenticated users, including Viewer,
can read reports and filter options. Reports are read-only; no additional
permission flag, reporting table or schema migration is introduced.

## Reports and calculation rules

| Tab | One row represents | Rules |
| --- | --- | --- |
| Stock by Location | Item and location, across its lots | Current on-hand, reserved and available quantities; distinct lot count. |
| Stock by Lot | Item, lot and location | Includes QC, optional expiration, primary unit and purchase/packing source document. A lot in two locations has two rows. |
| Low Stock | Active item, across selected locations | Available quantity at or below the entered threshold, including active items without lots or balances. Saved reorder levels apply, falling back to the company default (initially 10). An explicit report threshold overrides policies. |
| Near Expiry | Positive balance by lot and location | Expiration on or before today plus the entered window, company default initially 30 days. Includes already expired stock by default; the checkbox can exclude it. Undated and zero-balance lots are excluded. |
| Inventory Movement | One append-only ledger entry | Signed quantity, UTC time, lot, location, actor, reason and linked source document/reference. Transfer pairs remain separate; completed deliveries appear as negative Sale entries. |

Availability is **on hand minus the outstanding quantity of every unreleased
reservation**, including packing materials and customer deliveries in transit.
Consumed quantities are deducted from their reservation; released rows contribute
zero. Reports include company stock in In Transit, Quarantine, Scrap and inactive
locations unless filtered. Stock reports include inactive items except Low Stock.
Availability does not establish QC approval, valid expiry or shipment eligibility.
Selecting QC in Low Stock aggregates only matching lots, with no matching stock
treated as zero. Location filtering includes unstocked active items at that
location; nonexistent filter IDs are rejected rather than producing false zeros.

Saved per-item reorder levels take precedence over company defaults. An explicit
threshold overrides them for this report. Low-stock availability counts Approved,
unexpired supply at active usable locations, excluding In Transit/Quarantine/Scrap.
Physical on-hand/reserved totals remain separate. Checks and summary quantities
use exact arithmetic and stay grouped by primary UOM ID; different units are never
added together. Each low-stock row includes its effective reorder level.

Current stock comes from `inventory_stock`; movement comes from
`inventory_transactions`. Each report reads its catalog and operational records
in one PostgreSQL **read-only, repeatable-read transaction**. Reports do not alter
balances, reservations, lots, orders or ledger entries. Stock reports describe
current balances, not reconstructed historical stock. Only movement accepts a
date range. All date boundaries and expiry calculations use UTC: an expiration
equal to today is "Expires today"; yesterday is expired. Both movement dates
include the entire UTC day, with the upper SQL boundary at next-day midnight.

## API

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/reports/inventory` | Selected report, normalized filters, UTC generation time/date, complete matching rows, counts and primary-UOM totals |
| GET | `/api/reports/inventory/options` | Real items, locations and labels, including inactive records for historical filtering; labels are Packaging - Label items |

Query parameters:

| Parameter | Values / meaning |
| --- | --- |
| `report` | `stock-by-location` (default), `stock-by-lot`, `low-stock`, `near-expiry`, `movement` |
| `itemId`, `locationId`, `labelItemId` | Optional positive PostgreSQL integer IDs; must identify existing records |
| `itemType` | One of the four documented inventory item types |
| `qcStatus` | Quarantine, Approved, Rejected or Expired; current stock reports only |
| `q` | Trimmed text up to 200 characters; case-insensitive search of the fields present in each resulting row |
| `threshold` | Nonnegative exact string, up to 10 whole and 4 fractional digits; company default / saved policies when omitted |
| `expiryDays` | Integer 0-3650; company default when omitted |
| `includeExpired` | `true` or `false`; default true |
| `fromDate`, `toDate` | Optional valid `YYYY-MM-DD` dates; movement only; end cannot precede start |
| `transactionType` | Receive, Consume, Produce, Transfer, Scrap, Adjustment or Sale; movement only |

Unknown parameters, repeated scalar parameters and malformed values return 400.
Threshold/expiry settings affect their corresponding report. Inputs use strict
Zod validation and shared error envelopes. Unauthenticated reads return 401;
database errors use the shared safe error boundary. No report mutation endpoints
are exposed. Item names and label-material names reflect current master data; quantities,
actors and source links come from operational records.

DTOs expose nullable `labelItemId` and `labelItemName`; filter options contain
`labels: [{labelItemId, name}]`. The label filter must identify a Packaging - Label
item. It replaces the retired brand filter and uses the additive
[labels/customer-planning migration](../backend/supabase/migrations/20261114000000_customer_planning_labels/migration.sql).

## UI workflow

1. Sign in and open **Reports > Inventory Reports**.
2. Select a report tab. Keyboard users can use Left/Right, Home and End.
3. Choose an item, location, label, type or QC filter as relevant, and optionally
   enter search text. Low Stock has a threshold; Near Expiry has a window and
   expired-stock checkbox; Movement has type and UTC date filters.
4. Click **Apply filters**. Counts, unit totals and rows describe the same
   filtered result. Stock and movement records are not edited from this screen.
5. Sort a column, change visible columns, select rows or use pagination.
   **Export selected** exports selected matching rows; otherwise **Export CSV**
   exports all matching rows across pages. CSV includes report name, generation
   time, applied filters, exact quantities and source information, with the
   shared CSV escaping protection.
6. Use **Refresh report** after external operations or **Reset filters** to clear
   filters for the current tab. Inventory and relevant master-data mutations
   invalidate report caches within the application. An external application's
   writes appear on the next refresh. Existing cached rows remain visible if a
   background refresh fails; errors, initial loading and empty results are
   distinct states.

## Realistic demo data

The [sample-data guide](test-data.md) describes operational examples used by all
five reports. `RM-ONION` is an active raw material in kg with no lot,
balance or ledger entry; it demonstrates a never-stocked item in Low Stock at
threshold zero. Existing samples supply warehouses/branches/stores/transit,
packing and delivery reservations, a laurel lot expiring ten days after import,
an expired chili lot with a positive remaining balance, undated packaging, and
all seven movement types with authenticated actors and document references.
No fabricated report rows or browser-storage fallbacks are used. A normal sample
import still skips populated databases and never overwrites existing operations.

## Verification and limits

Backend HTTP and calculation tests cover viewer access, strict filters, safe
errors, exact large totals, unit separation, grouping, zero-stock items, inclusive
UTC dates and expiry boundaries. The native PostgreSQL test uses only
`TEST_DATABASE_URL`, creates an isolated schema, imports real samples, reconciles
stock/reservations, verifies delivery references and checks that reporting leaves
stock and ledger totals unchanged. Frontend API tests validate URLs, credentials,
cancellation, response shapes, exact decimals and export context.

All matching rows are returned for client sorting, selection, pagination and
export. Large deployments may need coordinated server pagination/export later.
Saved report definitions, scheduled reports, PDF generation, historical stock
snapshots and historical valuation remain outside this module.

Dedicated operational and genealogy reports are implemented separately; see
[Controls and Reports](inventory-controls-and-reports.md).
