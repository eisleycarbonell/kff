# Test database and realistic demo records

Use a dedicated PostgreSQL or Supabase test database through `DATABASE_URL` in
`backend/.env`, Node.js 24+, and installed backend dependencies (`npm ci`).
The dataset uses ordinary product names, SKUs, suppliers, customers and order
references. It is realistic fictional demonstration data, not verified business
records. Supplier/customer email addresses use the reserved `.example` domain.
Known test logins remain unchanged. The browser reads persisted API data;
there are no frontend mock rows or browser-storage stock substitutes.

## Existing database: update without resetting

1. Stop other backend instances and confirm the intended database target.
2. Apply missing older additive migrations in order: [sales/delivery](../backend/supabase/migrations/20261105000000_sales_delivery_orders/migration.sql),
   [legacy brands schema](../backend/supabase/migrations/20261107000000_brands/migration.sql),
   then controls with `npm run db:migrate:controls`. The historical brands
   schema remains for history; Brands is retired from the active application.
3. Run `npm run db:migrate:customer-planning` from `backend/` for the
   [labels/customer-PO migration](../backend/supabase/migrations/20261114000000_customer_planning_labels/migration.sql).
   It adds nullable item-label and customer-PO references without dropping
   orders, lots, reservations, stock or ledger records. A unique current BOM
   label can establish the initial association; otherwise select it in Items.
4. For an existing dedicated demo dataset only, set `KFF_ALLOW_TEST_DATA=true`
   and run `npm run db:upgrade:demo`. The guarded metadata upgrade recognizes
   known former demo records and changes matching old SKU/name/contact/role/
   company values, preserving user edits. It does not replace orders, change
   quantities, or rewrite the ledger. Saved PO/order numbers and historical
   `SAMPLE-` references remain unchanged. Fresh imports use normal references.
5. Restart. Test startup finding populated tables reports
   `sampleData: "skipped-existing"`; this preserves existing records.

The empty-database loader never appends updated fixtures to populated data.
Updating fixture source does not replace an existing dataset. Do not rebuild
a database to repair an outdated schema or to rename demo rows.

## Fresh demo setup

| Windows launcher | Action |
| --- | --- |
| [Rebuild test database](../rebuild-test-database.cmd) | Recreates KFF tables, enums, constraints, indexes and sequences. Deletes KFF records, including users and ledger history; requires `REBUILD`. |
| [Load demo data](../load-sample-data.cmd) | Imports only when every application table is empty. Preserves existing data. |
| [Start test backend](../start-test-backend.cmd) | Builds/starts; imports on first start only if the initialized database is empty. |

Launchers work from any current directory and retain their result. Initialize
the current schema, then load the dataset. Rebuilds generate SQL from
[schema.ts](../backend/src/db/schema.ts), preserving unrelated Supabase auth/
storage objects; external dependencies block deletion rather than cascading.

From `backend/` in PowerShell:

```powershell
$env:KFF_ALLOW_TEST_DATA = 'true'
npm run db:seed                    # empty initialized database only
npm run build
npm run start:test                 # preserves populated data
```

Use `npm run dev:test` for development. Ordinary `npm start`/`npm run dev`
imports only when both `KFF_ALLOW_TEST_DATA=true` and
`KFF_SAMPLE_DATA_ON_START=true` are explicitly set. Test entry points set both.
Normal builds and ordinary startup do not create data. Never point a testing
launcher at an operational business database.

A deliberate `npm run db:rebuild` asks for confirmation. Unattended dedicated
test resets require `npm run db:rebuild -- --yes` and the opt-in. `--help`
does no database work. Use `KFF_NO_PAUSE=1` for automated Windows launcher calls.
Recreation and import each run transactionally; failed imports roll back.
Concurrent imports are serialized and only one populates an empty database.

## Realistic catalog

Company: **Kusina Filipino Food Trading & Packing**, PHP, default reorder level
10 and expiry horizon 30 days. Fictional suppliers: **Davao Harvest Spice
Trading**, **Laguna Pantry Ingredients**, **Metro Manila Food Packaging**.
Fictional customers: **Lutong Bahay Restaurant**, **Barangay Fresh Mart**.

| Finished SKU | Assigned label SKU | Bulk kg per finished pc | Hardware per pc |
| --- | --- | --- | --- |
| `FG-PEPPER-100` | `LBL-PEPPER` | 0.100000 black pepper | 1 x 100g pouch |
| `FG-GARLIC-100` | `LBL-GARLIC` | 0.100000 garlic powder | 1 x 100g pouch |
| `FG-CAYENNE-50` | `LBL-CAYENNE` | 0.050000 cayenne | 1 x 50g pouch |
| `FG-NATA-250` | `LBL-NATA` | 0.250000 nata de coco | 1 x 250g jar/lid |
| `FG-KAONG-250` | `LBL-KAONG` | 0.250000 kaong | 1 x 250g jar/lid |
| `FG-NOODLES-250` | `LBL-NOODLES` | 0.250000 dried noodles | 1 x 250g pouch |
| `FG-LAUREL-25` | `LBL-LAUREL` | 0.025000 laurel leaves | 1 x 25g pouch |
| `FG-CHILI-100` | `LBL-CHILI` | 0.100000 chili powder | 1 x 100g pouch |

Every formula additionally consumes one matching printed label and one seal.
Bulk SKUs include `RM-GARLIC`; hardware includes `PKG-POUCH-100`, `PKG-SEAL`.
`RM-ONION` intentionally has no stock for Low Stock. All eight finished goods
select their label through `labelItemId`; no Brands records are created.
Item Packaging defines box ratios/barcodes. Assigning a label does not edit
the formula: prepare and independently release Formula Revisions for changes.
`/bom` inspects published formulas. Historical orders retain saved snapshots.

## Prepared operational records

| Records | Demo use |
| --- | --- |
| `PO-2026-1001` to `PO-2026-1004` | Completed spice, pantry, packaging and historical held-lot receiving |
| `PO-2026-1005`, `PO-2026-1006`, `PO-2026-1007` | Sent, Partially Received and Draft supplier POs |
| `SO-2026-0001` | Draft customer PO for 1500 garlic and 1000 pepper packs; material-shortage demonstration |
| `SO-2026-0002` | Confirmed grocery demand, with Draft and In Transit deliveries |
| `SO-2026-0003` | Partially Delivered restaurant demand |
| `SO-2026-0004` / `SO-2026-0005` | Completed / Cancelled demand |
| `DO-2026-0001` to `DO-2026-0006` | Draft, In Transit, Completed and Cancelled examples |
| `PK-GARLIC-OPEN`, `PK-PEPPER-OPEN`, `PK-NOODLES-OPEN` | Planned, In Progress and Draft packing |
| `PK-<ingredient>-DONE`, `FG-<ingredient>` | Completed packing and traceable finished lots |
| `TR-PEPPER`, `TR-GARLIC`, `TR-CAYENNE`, `TR-NATA` | Completed, In Transit, partial receipt and Draft transfers |
| `SCRAP-REVIEW` | Submitted 0.2500 kg expired-chili disposal for a different reviewer |
| `FORMULA-REVIEW` | Submitted garlic revision one |

Customer PO references include `LB-PO-2026-0001` and `BFM-PO-2026-0002`.
The draft shortage quantities apply to fresh imports. Existing quantities are
preserved by the metadata upgrade; create a new draft to repeat that scenario.

Dates are relative to import day. Approved, Quarantine, Rejected, expired and
near-expiry historical scenarios populate reports. New operational lots use
the Approved-first flow. Locations include raw/finished warehouses, Packing,
Manila Branch, Quezon City Store, In Transit, historical hold/scrap and an
inactive warehouse. A laurel lot expires ten days after creation.

Retired `COUNT-SESSION-DRAFT`, `COUNT-SESSION-APPROVED`, `QC-REVIEW` and
`DISPOSITION-DRAFT` remain read history through authenticated controls GET
APIs; they cannot be resumed/submitted. Use Stock Adjustments for count
corrections and Scrap & Disposal for permanent removal. Prepared requests
belong to Warehouse; historical independent review belongs to Administrator.

Every stock balance derives from the same exact-decimal ledger inserted in
the import transaction. Purchased lots link to PO lines, finished lots to
packing orders. Active packing/delivery reservations stay within balances.
Dispatched deliveries protect transit; completion posts Sale and reconciles
fulfillment. Pending review examples add no invented stock movements.

## Demo accounts

All use password `KffDemo123!` in the dedicated demo dataset only.

| Username | Name | Role |
| --- | --- | --- |
| `demo@spice.local` | Elena Reyes | Administrator; all five permissions |
| `warehouse@spice.local` | Maria Santos | Inventory, Packing, Transfers |
| `purchasing@spice.local` | Carlo Mendoza | Purchasing |
| `sales@spice.local` | Sofia Garcia | Inventory, including Sales Orders |
| `delivery@spice.local` | Diego Ramos | Transfers, including Delivery Orders |
| `viewer@spice.local` | Ana Cruz | Read only |

Sales writes reuse `canManageInventory`; delivery writes reuse
`canManageTransfers`, including other operations covered by those flags.
Formula/Scrap review additionally needs `canManageUsers` and a different person
from creator/submitter. Prepare as Warehouse and review as Administrator.
Populated databases are never given new accounts automatically by the loader.

## Verification and use

Follow [the module demo guide](module-demo-guide.md) for customer-first planning
and every module's actions. The [UI happy path](ui-setup-and-happy-path.md)
provides an isolated 500-piece garlic exercise and ledger checkpoints.

[Seed tests](../backend/tests/sample-data-seed.test.ts) run the actual importer
against a transaction fake: labels, normal SKUs, customer POs, six roles, states,
allocations, lot provenance, reservations, ledger/balance equality, populated
data preservation and late-ledger rollback. [Database tests](../backend/tests/sample-data.test.ts)
check static definitions and opt-in isolated PostgreSQL invariants/concurrent
loaders. Native tests use `TEST_DATABASE_URL` only, skipping without it and
never falling back to `DATABASE_URL`.

For initialization failure verify connection, current schema/migrations and
flags before resetting. Disabling import does not upgrade a schema. A healthy
default-port server returns success from `http://localhost:3001/api/health`.
