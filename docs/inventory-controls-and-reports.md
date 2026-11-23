# Inventory controls, master data and operational reports

Implemented extension of the [canonical system flow](system-flow.md), reviewed
2026-11-11. Quantities are exact decimal strings in the item's primary UOM.
These modules use the existing five permissions and authenticated audit identity.

## Pages and access

| Page | Purpose | Write permission |
| --- | --- | --- |
| `/settings` | Company identity, currency, default reorder level and expiry horizon | `canManageUsers` |
| `/item-packaging` | Item-specific pack ratios, barcode and gross weight | `canManageInventory` |
| `/reorder-policies` | Saved item reorder levels in primary UOM | `canManageInventory` |
| `/reason-codes` | Reasons, categories and active status | `canManageInventory` |
| `/inventory/scrap` | Permanently remove stock through a reviewed disposal | `canManageInventory` |
| `/bom` | Create, edit, copy, bulk-import, and remove packing formulas directly | `canManagePacking` |
| `/reports/packing` | Output variance and saved material requirements versus ledger consumption | Read only |
| `/reports/purchasing` | PO line quantities, remaining demand and monetary exposure | Read only |
| `/reports/transfers` | Source/destination, shipment dates and outstanding transit per line | Read only |
| `/reports/genealogy` | Purchased/packed origins, material links, locations and complete movement history | Read only |

All reads require a session. Scrap reviewers need both `canManageInventory`
**and** `canManageUsers`, and must differ from the creator and submitter. (`/formula-revisions` is retired and redirects to `/bom`.)
The sample warehouse account prepares; the sample administrator reviews.
Read-only accounts can inspect requests, details and reports. Rejected requests
can be reopened only by their creator. There is no self-approval exception.

## Setup through the UI

1. Sign in as an administrator. In **Settings → Company Settings**, save the
   company/contact details, ISO currency, default reorder level and expiry
   warning horizon. Currency defaults to PHP and cannot change after priced
   operational records exist. Changes require the current version; refresh after
   a conflicting save. This labels amounts; it does not convert currencies.
2. Configure compatible UOM classes and units, then items and locations using
   the [setup guide](ui-setup-and-happy-path.md). Use active Warehouse locations for new purchase receipts. Quarantine and Scrap
   locations remain optional metadata for existing held-stock history; the
   simplified flow has no hold/release movement. Customer contacts remain separate.
3. In **Master Data → Item Packaging**, select an item and a compatible pack
   UOM. Enter the number of primary units per pack, and optional barcode/weight.
   Example: one box of bags contains **24 pc**. This item-specific ratio
   overrides a generic box factor of 12 for that item in receiving and new
   packing requirements. Global conversions remain the fallback.
4. Define packaging before using that item/UOM in PO or formula records. A
   referenced ratio cannot change or be deleted; barcode and weight can change.
   A primary-unit packaging row must have ratio one. Barcodes are stored
   metadata; this module does not implement a scanner workflow.
5. In **Master Data → Reason Codes**, create active Inventory Adjustment
   reasons for direct stock corrections, and other categories for scrap/disposal. Deactivate
   obsolete codes; referenced categories are protected. Historical codes remain
   visible. Existing manual adjustments also require active adjustment reasons.
   Reason names are unique ignoring capitalization; concurrent creation/rename
   requests enforce the same rule within their database transaction.
6. In **Master Data → Reorder Levels**, select each item and save its threshold
   in primary units. Zero is valid. Items without an override use the company
   default. Low Stock includes active items that have never held stock.

## Shared review lifecycle

```text
Draft → Submitted → Approved
                  → Rejected → Draft (reopen with fresh snapshot)
Draft / Submitted / Rejected → Cancelled
```

Every action needs a note. Approved/Cancelled requests are final. Actions and
prior snapshots are preserved as append-only request events; stock history
remains the separate append-only inventory ledger. Request numbers are manually
entered unique identifiers. They are not automatically generated sequences.

Reopening Scrap refreshes its expected source balance. Submitted and approved
records cannot be edited arbitrarily.

### Removed workflows and preserved history

Count Sessions, QC Decisions, Stock Dispositions, and Formula Revisions are
removed from the active system flow. Old control pages redirect to Inventory
Stock, `/inventory/counts` redirects to Stock Adjustments, and
`/formula-revisions` redirects to Packing Formulas (`/bom`), where formulas are
managed directly with `canManagePacking`.

Authenticated GET list/detail APIs preserve existing Count, QC, Disposition, and
Formula requests, observations, evidence references, and action history. Creating
these request kinds, saving count observations, or submitting/reviewing/reopening/
cancelling a retired request returns 409. Records and ledger entries remain
intact; legacy requests are not automatically approved or posted.

New purchased and packed lots start Approved; the legacy item `requiresQc` flag
does not create a new QC approval step. Existing lot statuses remain unchanged.
Inventory managers edit quality status directly in Lots / Batches with the same
reservation protections as date edits. Lot metadata updates do not change stock
or create stock ledger entries. Expiry and approved-status checks still apply
when stock is reserved, packed or dispatched.

New receipts use active Warehouse destinations. Existing stock in Quarantine or
Scrap locations remains visible in balances and history; the normal transfer
workflow cannot relocate that held stock. There is no replacement hold/release
workflow in this simplified scope.

### Scrap and disposal happy path

1. Open **Inventory > Scrap & Disposal** and prepare a request with a unique
   number, lot, source location, quantity in the item's primary UOM, a
   non-adjustment reason and supporting notes.
2. Submit it with an action note. A different authorized reviewer inspects the
   request and approves it.
3. Approval rechecks the saved expected source balance and active reservations,
   appends a negative Scrap entry, and updates the balance atomically.
4. Verify Inventory Stock and Stock Movements. Failed approval rolls back stock,
   ledger and request actions; the submitted request remains available.

Scrap cannot consume stock reserved for packing or delivery. In Transit stock
must be handled by its owning transfer or customer delivery. Permanent scrap
reduces company inventory; storage at a Scrap location alone is not disposal.

### Direct packing formulas (replacing Formula Revisions)

1. As a packing manager (`canManagePacking`), open **Master Data → Packing
   Formulas** (`/bom`)—or use **Save & add components** right after creating a
   Finished Good in `/items`.
2. Select an active Finished Good, optionally copy components from another
   product, verify its pre-added printed label (`labelItemId`), and enter 1–100
   distinct active raw/packaging/label components with compatible UOMs (or use the
   per-row **From batch** calculator).
3. Save directly via `POST`/`PATCH /api/packing-formulas`. No separate revision
   approval step or future effective-date gate is required.
4. Create a new packing order—it immediately reads and snapshots the current BOM
   while existing orders keep their original saved requirements.

Historical `FORMULA-REVIEW` requests in `review_requests` / `formula_revisions`
remain read-only history; `kind: 'Formula'` writes on `/api/inventory-controls`
return 409.

## APIs and persistence

| API | Methods |
| --- | --- |
| `/api/company-settings` | GET, PATCH with `expectedVersion` |
| `/api/item-packaging`, `/:id` | GET list, POST; PATCH/DELETE individual unused/protected records |
| `/api/reorder-policies`, `/:itemId` | GET list, POST; PATCH level, DELETE override |
| `/api/reason-codes`, `/:id` | GET list, POST; PATCH metadata/active status |
| `/api/inventory-controls` | GET optional `kind`; POST typed preparation |
| `/api/inventory-controls/options` | GET authenticated preparation options |
| `/api/inventory-controls/:id` | GET full request, typed details, observations and events |
| `/api/inventory-controls/:id/observations` | PATCH returns 409; historical observations are read-only |
| `/api/inventory-controls/:id/actions` | POST `{action, reviewNote}` |
| `/api/reports/operations` | GET `report=packing|purchasing|transfers|genealogy`, optional date range or genealogy `lotId` |

Active preparations accept only Scrap; Count, QC, Disposition, and Formula return 409.
Request headers use `review_requests`, with historical children in `count_sessions`,
`count_observations`, `inventory_disposals`, `qc_decisions`, `formula_revisions`
and `formula_revision_materials`. `review_events` preserves action/evidence
history. Stock changes link ledger entries to their review request; historical count
entries retain their observation links. Constraints prevent duplicate count postings; row locks
serialize approvals and stock operations. Failed writes roll back stock,
ledger, workflow status and events together.

## Reports and dashboard

Reports read one repeatable-read, read-only snapshot. Tables support search,
sorting, selection, column visibility, pagination and CSV export of selected
filtered rows or all filtered rows. Monetary values use the configured currency. Company Settings stores the configurable
default `vatRatePercent` (`0.00`–`100.00`, initially `'12.00'`) used to pre-fill VATable
item lines without modifying saved historical orders. `/accounting` surfaces Ex-VAT inventory
asset values, creditable Input VAT (`1150`), Output VAT Payable (`2200`), Net VAT Payable
(`Output VAT - Input VAT`), and a balanced Trial Balance.
Packing/purchasing/transfer date filters use the order creation/request date,
not transaction dates. Genealogy always includes complete relevant history.
Packing variance is actual minus target only for completed orders. Transfer
outstanding transit is shipped minus received, including partial receipt.

Genealogy follows input Consume and output Produce entries, tracing upstream
and downstream from the selected lot without expanding unrelated sibling lots.
It includes PO/supplier or packing origins, current physical/reserved/available
balances and transfer/delivery movement references. An all-lots view is available.

Dashboard quantity summaries are arrays grouped by primary UOM ID. The UI shows
each UOM separately; monetary totals may aggregate in the configured currency.
Open status filters apply before list limits and match the count definitions.
Low Stock uses eligible available supply (Approved, unexpired, active usable
locations), excluding In Transit/Quarantine/Scrap. Physical on-hand/reserved
quantities remain distinct. Saved reorder levels take precedence over company
defaults; an explicitly entered inventory-report threshold overrides policies.

There are no reconstructed historical stock snapshots, scheduled reports,
multicurrency conversion, scanner integration, invoice/payment accounting or
automatic reorder purchasing in this extension.

## Upgrade and sample data

From `backend/`, run `npm run db:migrate:controls` once against an existing
initialized KFF database, then restart the backend. The [migration](../backend/supabase/migrations/20261108000000_inventory_controls/migration.sql)
adds tables and nullable provenance columns without resetting operational data.
The runner uses one transaction and checks preservation of the ledger count.
Fresh test rebuilds use the current complete schema directly. Never rebuild a
database whose data must be retained.

[Sample data](test-data.md) includes settings, pack barcodes, reorder overrides,
historical count/QC/disposition/formula requests and a submitted scrap request.
Retired requests remain read-only examples. Existing seeded databases are still
preserved/skipped; the sample loader does not overwrite them.
