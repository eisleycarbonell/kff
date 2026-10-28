# UOM and Locations modules

These modules implement Master Data → Units of Measure (`/uom`) and
Master Data → Locations (`/locations`). Follow `docs/system-flow.md` for the
business flow and the application AGENTS files for implementation conventions.
Neither master-data screen stores or edits stock quantities; Inventory Stocks
(`/inventory`) owns balances and count adjustments.

## API and permissions

All endpoints require the shared authenticated session. Reads are available to
authenticated users. Every write requires `canManageInventory`; audit user IDs
come from the authenticated request, never client input. Responses use the
shared success/error envelopes, 201 for creation, 404 for missing resources,
and bodyless 204 for deletion.

| Resource | Endpoints |
| --- | --- |
| UOM | GET/POST `/api/uoms`; GET/PATCH/DELETE `/api/uoms/:id` |
| UOM classes | GET/POST `/api/uoms/classes`; PATCH/DELETE `/api/uoms/classes/:id` |
| Locations | GET/POST `/api/locations`; GET/PATCH `/api/locations/:id` |

Zod rejects unknown writable fields, invalid positive PostgreSQL integer IDs,
invalid enum values, and empty patches. Omitted PATCH fields remain unchanged.
Create defaults never overwrite omitted PATCH fields. Database constraint
failures pass through the shared safe database-error middleware.

## UOM contract

- Units have a unique, case-sensitive name (20 characters), an existing class,
  a positive exact `numeric(18,8)` factor string (10 whole digits, 8 fractional
  digits), and a boolean base flag. Preserve case for unit symbols.
- Classes have a unique name (30 characters). New classes may initially be empty.
  Create a base unit with factor 1 before adding conversion units. Each nonempty
  class has one base unit; do not automatically rebase stored conversions.
- One unit equals its factor multiplied by the class base unit. Conversion
  within a class is `quantity × sourceFactor ÷ targetFactor`; conversion between
  different classes is invalid. This module configures factors; operational
  services remain responsible for compatible conversions and quantity rounding.
- DTOs include class name, exact factor, `isInUse`, `isClassAnchor`, and audits.
  Class DTOs include `unitCount`, nullable `baseUomName`, and audits.
- References are checked across items, supplier items, BOMs, item packaging,
  purchase-order lines, and packing-order materials. Once referenced, class,
  factor, and base status are locked; a name correction remains possible.
  Equivalent factors such as 1 and 1.00000000 compare exactly with scaled BigInt.
- A base with other units is a class anchor: its definition and deletion are
  locked even before operational use. Delete only unused non-anchor units.
  Delete only empty classes. The existing schema has no UOM active flag.
- Parent class rows lock in ascending ID order before unit rows. Recheck the
  current unit after locking and check references under the unit lock. Preserve
  this ordering in future writes so base creation and class deletion serialize.

## Location contract

- Fields: unique uppercase trimmed code (30 characters), trimmed name
  (100 characters), one of Warehouse, Packing, Branch, Store, Quarantine, Scrap,
  or In Transit, and active status (default true on create).
- DTOs include `isInUse`, `hasOperationalActivity`, and server audit fields.
  Historical stock, reservations, ledger entries, packing orders, or transfers
  make a location in use. Its type then remains locked; code/name corrections
  are allowed.
- Locations deactivate/reactivate through PATCH. There is no hard-delete API.
  Deactivation is blocked by positive on-hand stock, unreleased outstanding
  reservations, packing orders in Draft/Planned/In Progress, or transfers in
  Draft/In Transit. Check both source and destination links.
- A location update locks its row FOR UPDATE before rechecking references and
  operational activity. Inventory writers must call the intentional service
  export `requireActiveLocation(transaction, locationId)` in their transaction
  before writing balances, reservations, or operational source/destination use.
  It checks existence/activation and holds a key-share lock through commit.
  Lock multiple locations in ascending ID order in future multi-location flows.
- Stock adjustments now use that guard. The frontend disables inactive location
  options and validates active selection. Metadata changes invalidate stock
  labels/options. A deactivated location can still appear in historical reads.

## Frontend organization

Each feature owns schema/DTO validation, a query/mutation hook, forms, statistics,
table columns, toolbar, and table under its own module folder. Pages directly
compose those pieces. The UOM module also owns its class manager.

Use the Users layout: header actions beside the title, summary cards, one
wrapping toolbar, sortable/selectable tables, column visibility, CSV export,
and pagination. Export selected filtered rows when selected, otherwise all
filtered rows; preserve exact factors and escape spreadsheet formulas.
Keep cached data visible on background refresh errors. Disable submission and
dialog dismissal while pending and preserve form input after failed mutations.
The location bulk action deactivates only eligible selected rows, reports partial
success, and retains failed rows for retry.

Query keys are scoped by signed-in user: `uoms`, `uom-classes`, and `locations`.
UOM changes also invalidate `item-uoms`, `items`, `inventory-stocks`, and
`inventory-stock-options`; location changes invalidate both inventory keys.
Do not import another feature's internal schemas/hooks to perform invalidation.

## Verification

The modules use existing database tables and require no schema migration.
Run backend type checking/tests and frontend tests, type checking, lint, and a
production build. Contract tests use fake services and fetch mocks; policy tests
cover exact factors, base definitions, usage locks, and location lifecycle rules.
Real PostgreSQL tests are still required to verify persistence, row-lock
concurrency, and rollback against an isolated database. Browser checks require
an available browser runtime.
