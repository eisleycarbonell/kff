# Testing database and sample data

Use a dedicated PostgreSQL or Supabase **test database**, configured through
`DATABASE_URL` in `backend/.env`. Use Node.js 24 or newer and install backend dependencies with `npm ci` first.
The scripts use the same connection as the backend. Console output shows the
host/database without credentials.

## Double-click Windows launchers

Run these files from the repository root; each works regardless of the current
working directory and keeps its console open to display the result.

| File | Action |
| --- | --- |
| [rebuild-test-database.cmd](../rebuild-test-database.cmd) | Recreates KFF tables, enums, constraints, indexes and identity sequences from the current Drizzle schema. **Deletes all KFF records**, including users and ledger history. Requires typing `REBUILD`. |
| [load-sample-data.cmd](../load-sample-data.cmd) | Loads the sample dataset only when all application tables are empty. Existing data is preserved. |
| [start-test-backend.cmd](../start-test-backend.cmd) | Builds and starts the backend, loading samples on its first start against an empty initialized database. Subsequent starts preserve all changes. |

For a fresh test setup, stop the backend, run the rebuild launcher, then run the
sample loader or testing backend launcher. Rebuilding leaves an empty schema;
loading samples is a separate action. The rebuild targets application objects
only, preserving Supabase `auth`/`storage` and unrelated tables. External objects
that depend on KFF tables block the rebuild instead of being dropped by cascade.
Both schema rebuilding and sample loading run transactionally; failures roll back
their respective operation. Stop other application instances during these tasks.

The schema is generated from [schema.ts](../backend/src/db/schema.ts), including
current tables such as customers, sales orders and delivery orders. Historical
migrations are not replayed and migration history is not rewritten; this
repository's `db:push` workflow remains available for schema changes.

## Troubleshooting backend startup

The message `Test sample initialization failed. Enable KFF_ALLOW_TEST_DATA=true
and initialize the empty test database schema before starting.` is a generic
startup failure. It can also mean that the database has an older schema, even
when both sample-data flags are already enabled and the connection works.
An existing database does not have to be emptied to start the backend.

Check the following before considering any reset:

1. Run backend commands from `backend/` so its `.env` is loaded. Confirm that
   `DATABASE_URL` points to the intended test database.
2. Use `npm run dev:test` for development sample startup, or
   `npm run build` followed by `npm run start:test` for compiled startup.
   Both test entry points set `KFF_ALLOW_TEST_DATA=true` and
   `KFF_SAMPLE_DATA_ON_START=true` automatically.
3. For an existing database created before sales and deliveries were added,
   apply the [additive sales/delivery migration](../backend/supabase/migrations/20261105000000_sales_delivery_orders/migration.sql)
   once, using the database SQL editor or the deployment's migration process,
   before restarting. It adds the four sales/delivery tables, their enum types,
   the delivery-line references on reservations and transactions, and the
   related constraints. It preserves existing application records and ledger
   history. Do not reapply a migration that is already installed.
4. For databases created before brand management, also apply the
   [additive brands migration](../backend/supabase/migrations/20261107000000_brands/migration.sql)
   once. It adds brands and optional item assignments, preserving operational
   records. Formula maintenance uses the existing BOM table.
5. Restart the backend. With an up-to-date populated database, the expected
   startup log is `sampleData: "skipped-existing"`, followed by `Server started`.
   This is successful startup: existing records are preserved and samples are
   not appended. On the default port, `http://localhost:3001/api/health` should
   return a successful response.

Do not use `rebuild-test-database.cmd` to repair an outdated database whose
records you want to keep; rebuilding deletes KFF data. Disabling sample loading
does not upgrade an outdated schema either. Updated sample accounts and records
are not automatically added to a preserved existing dataset.

## Sample dataset

- Black pepper, garlic powder, cayenne pepper ("cayin"), nata de coco, kaong,
  dried noodles, laurel leaves and chili powder.
- Bulk ingredients in kg; sellable packs in pieces, with matching pouches or
  food jars, labels, seals, BOMs and saved packing material snapshots.
- Suppliers, supplier prices, customers, units, roles and testing accounts.
- Three brands: active `SAMPLE-KFF` (Sample KFF Spices), active `SAMPLE-PANTRY`
  (Sample KFF Pantry), and inactive `SAMPLE-ARCHIVE` (Sample Archived Brand).
  All eight finished goods are assigned to the appropriate active brand.
- Eight editable packing formulas at Master Data > Packing Formulas (`/bom`).
  Each finished unit uses its bulk ingredient quantity in kg, one configured
  pouch/jar, one product label and one tamper seal. Existing packing orders
  retain their saved requirements when a current formula is edited or removed.
- Received and open purchase orders, plus partial receiving.
- Traceable purchased and finished lots, approved/quarantined/rejected/expired
  examples, and a lot expiring ten days after sample creation.
- Completed packing and open draft/planned/in-progress orders, active and
  consumed reservations, counted adjustment and scrap movements.
- Completed, draft and in-transit transfers, including partial receiving.
- Five sales orders covering Draft, Confirmed, Partially Delivered, Completed
  and Cancelled, linked to the sample restaurant and grocery customers.
- Six delivery orders covering Draft, In Transit, Completed and Cancelled,
  including partial sales fulfillment across multiple deliveries. Dispatched
  lots retain their packing origins; completed deliveries record Sale entries.
- Delivery-linked transit reservations: active shipments remain protected, while
  completed deliveries consume and release their reservations. Transfers and
  customer deliveries can share the same lot and In Transit location.
- Raw/finished warehouses, packing, branch, store, quarantine, scrap, inactive
  warehouse and In Transit locations. Transit zero balances remain visible.

Every balance is derived from the same exact-decimal movement entries inserted
in the import transaction. Purchased lots link to PO lines, finished lots to
packing orders, and all inventory entries have a sample actor. Dates are relative
to when samples are created so expiry scenarios remain useful.

### Brand and packing formula examples

Open **Master Data > Brands** (`/brands`) to inspect or edit the three brands.
Open **Items / Products** (`/items`) to assign an active brand to an item; choose
**No brand** to clear an assignment. Deactivating a brand preserves its existing
assignments and prevents new assignments.

Open **Master Data > Packing Formulas** (`/bom`) to inspect each product's four
materials or choose **Edit formula** from its actions. These quantities are per
**one finished piece**, not per batch:

| Finished-product SKU | Brand | Bulk material per piece | Hardware per piece |
| --- | --- | --- | --- |
| `SAMPLE-FG-PEPPER-100` | Sample KFF Spices | 0.100000 kg black pepper | 1 x 100g pouch |
| `SAMPLE-FG-GARLIC-100` | Sample KFF Spices | 0.100000 kg garlic powder | 1 x 100g pouch |
| `SAMPLE-FG-CAYENNE-50` | Sample KFF Spices | 0.050000 kg cayenne | 1 x 50g pouch |
| `SAMPLE-FG-NATA-250` | Sample KFF Pantry | 0.250000 kg nata de coco | 1 x 250g jar with lid |
| `SAMPLE-FG-KAONG-250` | Sample KFF Pantry | 0.250000 kg kaong | 1 x 250g jar with lid |
| `SAMPLE-FG-NOODLES-250` | Sample KFF Pantry | 0.250000 kg dried noodles | 1 x 250g pouch |
| `SAMPLE-FG-LAUREL-25` | Sample KFF Spices | 0.025000 kg laurel leaves | 1 x 25g pouch |
| `SAMPLE-FG-CHILI-100` | Sample KFF Spices | 0.100000 kg chili powder | 1 x 100g pouch |

Every formula also includes **one matching product label and one tamper seal**.
For example, a new order for 10 garlic pieces requires 1 kg garlic, 10 pouches,
10 garlic labels and 10 seals. A compatible alternative such as 100 g garlic
per piece produces the same requirement after conversion to primary stock units.

To create another example, create its brand, assign that brand to a new active
Finished Good in Items / Products, then choose **Create formula**, select that
finished product and add its materials, quantities and compatible units. Save the
formula before creating a packing order. Editing or removing the current formula
preserves all existing packing-order material snapshots and reservations. Brand
writes require Inventory permission; formula writes require Packing permission.
See the [complete UI happy path](ui-setup-and-happy-path.md) and
[module contract](brands-packing-formulas-modules.md).

Sample accounts all use password `KffDemo123!`:

| Username | Role |
| --- | --- |
| `demo@spice.local` | Full administrator |
| `warehouse@spice.local` | Inventory, packing, transfers, sales orders and deliveries |
| `purchasing@spice.local` | Purchasing |
| `sales@spice.local` | Sales orders and inventory management |
| `delivery@spice.local` | Delivery orders and stock transfers |
| `viewer@spice.local` | Read only |

Sales orders use `canManageInventory`; delivery orders use `canManageTransfers`.
The Sales and Delivery sample roles deliberately reuse these existing settings,
so they also grant inventory management or stock transfer management respectively.
Administrator and Warehouse Manager have both permissions. Purchasing and Viewer
can view these modules but cannot change sales or delivery orders. Each sample
account is assigned its corresponding persisted role; there are no extra sales
or delivery permission flags.

## Command line and first-load behavior

For an existing database, apply the [brands migration](../backend/supabase/migrations/20261107000000_brands/migration.sql)
once before starting the updated backend. It adds a brand table and nullable
item references without deleting or reseeding operational data. Packing formula
publication now uses the controls/revision migration described below.
See [the module contract](brands-packing-formulas-modules.md) for permissions and
UI setup. Brand writes require Inventory; formula writes require Packing.
An existing populated dataset is still preserved by the normal sample loader:
the new examples are included only in a fresh sample import. Create brands and
formulas through the UI to extend an existing environment without a reset.

From `backend/` in PowerShell:

```powershell
$env:KFF_ALLOW_TEST_DATA = 'true'
npm run db:rebuild                 # interactive, deletes KFF data
npm run db:seed                    # empty database only
npm run build
npm run start:test                 # compiled backend with first-start seeding
```

For development use `npm run dev:test`. For ordinary application startup with
automatic samples, explicitly set **both** `KFF_ALLOW_TEST_DATA=true` and
`KFF_SAMPLE_DATA_ON_START=true`, then run `npm start` or `npm run dev`.
The testing launcher sets both automatically. This explicit opt-in also allows
testing a production build; never point a testing launcher at a real business
database. Automatic loading finishes before the API starts accepting requests.
An already-populated database is skipped, and simultaneous loaders are serialized.
Updated sample definitions do not append to or replace an existing dataset. To
load the new sales/delivery examples and accounts, use an empty initialized test
database; a deliberate test rebuild removes previous test edits and records.
An empty database must already have its application schema, created by rebuilding
or `npm run db:push`.

Normal frontend/backend builds and ordinary startup do not create samples.
The browser receives real API data from the database; there are no frontend mock
records or browser-storage fallbacks. Build and run the frontend normally, with
its API URL pointing to this backend.

For unattended test resets, use `npm run db:rebuild -- --yes` with
`KFF_ALLOW_TEST_DATA=true`. Set `KFF_NO_PAUSE=1` when calling Windows launchers
from automation. `--help` on either database command performs no database work.

The [Inventory Reports page](../frontend/src/app/(protected)/reports/inventory/page.tsx)
implements five inventory reports with filters, exact per-UOM totals and CSV.
Samples include approved, held, expired, near-expiry and In Transit stock, both
packing and delivery reservations, and the never-stocked `SAMPLE-RM-REPORT-ZERO`
item for Low Stock. See [the inventory-report contract](inventory-reports-module.md).

## Verification

[sample-data-seed.test.ts](../backend/tests/sample-data-seed.test.ts) runs the
actual sample import against a transaction fake without writing to the
application database. It checks all six role/account assignments, sales and
delivery states, fulfillment and allocation totals, ledger/balance equality,
lot traceability, delivery reservations, preservation of existing data, and
rollback after a late ledger failure.
It also verifies three brands, two active brands, eight branded finished goods
and four formula components per product.

[sample-data.test.ts](../backend/tests/sample-data.test.ts) also checks the
static account configuration and inclusion of all current tables in rebuild
and empty-database protection. Its native PostgreSQL integration test runs only
when `TEST_DATABASE_URL` names a dedicated test database. That test uses a random
isolated schema and verifies import/rebuild behavior, concurrent loaders and
database invariants; it skips without that configuration and never uses
`DATABASE_URL` as a fallback.


## Inventory controls and report extension (2026-11-08)

Existing initialized databases can run `npm run db:migrate:controls` from
`backend/` to add the new tables and references without resetting records.
Restart the backend afterward. Fresh rebuilds already use the current schema.
Sample loading still skips any populated application database; it does not
overwrite existing operations or manufacture historic approvals.

Fresh samples additionally contain:

| Record | Current use |
| --- | --- |
| Company settings, PHP, default level 10, expiry 30 days | Settings → Company Settings |
| Eight finished-product box barcodes and gross weights | Master Data → Item Packaging |
| Garlic raw threshold 25 kg and finished threshold 100 pc | Master Data → Reorder Levels |
| `SAMPLE-COUNT-SESSION-DRAFT` | Retained read-only count request and observations; inspect through the authenticated controls API |
| `SAMPLE-COUNT-SESSION-APPROVED` | Retained read-only unchanged count and independent reviewer history; no stock transaction |
| `SAMPLE-QC-REVIEW` | Retained read-only QC evidence and request history; current lot status is edited in Lots / Batches |
| `SAMPLE-SCRAP-REVIEW` | Administrator reviews 0.2500 kg of expired chili disposal |
| `SAMPLE-DISPOSITION-DRAFT` | Retained read-only held-stock movement request; cannot be submitted or applied |
| `SAMPLE-FORMULA-REVIEW` | Administrator releases garlic revision one for future orders |

All these prepared records belong to `warehouse@spice.local`; the approved
unchanged count is reviewed by `demo@spice.local`. Both use `KffDemo123!` in
the dedicated sample dataset. Independent review still applies to active Scrap and Formula requests;
reviewers cannot approve their own preparation. Count Sessions, QC Decisions
and Stock Dispositions have been removed from active workflows. Their samples
remain unchanged and read-only through authenticated controls GET APIs; they
cannot be submitted, observed, reviewed, reopened, cancelled or applied. Their
old pages redirect to Inventory Stock.

The retained disposition and submitted scrap share an original source snapshot.
The retired disposition cannot apply a movement or stale the scrap request. If
another active stock operation changes that snapshot, reject and reopen the
Scrap request to refresh it. These draft and submitted samples add no ledger entries; initial sample stock remains derived
from the same operational ledger. Existing formulas remain a legacy baseline
until the submitted revision is actually approved.

Existing purchase, packing, transfer and sales records populate the four new
operational reports. See the [step-by-step controls guide](inventory-controls-and-reports.md)
and [UI happy path](ui-setup-and-happy-path.md).
