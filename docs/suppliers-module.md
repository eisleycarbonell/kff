# Suppliers module

Suppliers follows the [shared system flow](system-flow.md). The page is
`/suppliers` under Master Data; its API is `/api/suppliers`. The existing
`suppliers` and `supplier_items` tables support this module without a migration.

## Supplier records

Supplier records contain a required name (up to 100 characters), an optional
email (up to 100 characters), and active status. Names are trimmed; emails are
trimmed and lowercased, and clearing an email sends null. Database uniqueness
protects supplier names.

The table shows contacts, status, **Linked items** and open purchasing work.
Search, status filters, sorting, selection, column controls, CSV and pagination
use the loaded records. The table and CSV use `activeItemCount`, calculated by
the backend from current `supplier_items.isActive` links. The summary sums that
same count across suppliers, counting supplier-item pairs rather than distinct
catalog items. Each row counts only relationships belonging to that supplier;
for example, two current links show 2 even if other suppliers have 22 links.
The open-order flag is also specific to that supplier. Old unlinked records
do not inflate the displayed count.
`itemCount` (all historical relationships) and `preferredItemCount` remain in
the API for compatibility but are not shown as separate counters.

Deactivation preserves history. Suppliers with Draft, Sent or Partially
Received orders cannot be deactivated. Successful deactivation unlinks their
items and clears legacy preferred flags in one transaction. Reactivating a
supplier does not relink its items automatically.

## Shared item links

Choose **Link items** from a supplier's row menu. The dialog initially lists only
currently linked items; search by name/SKU or use **Unlink**. Choose **Link another
item** to see eligible unlinked materials and use **Link item**. **Back to linked
items** returns to the supplier's current links. The dialog shows
a current linked count independent of search, item name, SKU, primary UOM and
link status. There is no offer editor, price form, preferred selector or
separate active-offer switch.

Items / Products offers the same link/unlink action from its Suppliers column.
Both screens write the same `supplier_items` record. One item may have several
suppliers, with one record per pair. New links require an active supplier and
active raw material, packaging item or label. Finished goods are packed internally.
Unlinking sets `isActive: false` and preserves history; relinking uses PATCH on
the same record. A retained link to an inactive item is visible but cannot
permit a new PO line. Only active links between active suppliers and active
materials permit purchasing.

Creating a link sends only `{ itemId, isActive: true }`; changing an existing
link sends only `{ isActive }`. Purchase units and prices are entered on the PO.
A new link has no price default and uses the item's primary UOM. Existing
optional supplier codes, purchase-unit/price defaults, lead times and preferred
flags remain stored for compatibility, and existing defaults can still prefill
PO lines. Link toggles do not overwrite those terms; unlinking clears a legacy
preferred flag. The supplier UI no longer edits these optional terms.

After saving, the dialog updates its cached relationship and awaits refresh of
supplier counts, Items tags, supplier choices and PO options before enabling the
next action. Failed writes keep the dialog open with a readable error. Writes
are permission-gated, duplicate clicks and dismissal are blocked while saving,
and query failures provide retry without inventing placeholder counts.

## Backend compatibility and integrity

The existing optional term fields remain supported by the API. Prices use exact
`numeric(14,4)` decimal strings; null means unspecified and zero is a real price.
A null purchase UOM means the primary UOM; an explicit one must be compatible.
Only one active preferred supplier can exist per item. Unlinking clears that
flag; relinking revalidates supplier, item and unit compatibility. Clients cannot
change the item identity on an existing link.

Writes lock the supplier and item and validate units under held locks. Unique
indexes protect duplicate pairs and legacy preferred relationships. Supplier
changes create no inventory or ledger entries and do not alter historical PO
prices. [Purchase Orders](purchase-orders-module.md) revalidates active links
under a supplier lock when creating, editing or sending drafts.

## Access and API

Reads require authentication. Supplier and item-link writes require
`canManagePurchasing`, including when opened from Items. Inventory-only users
can view relationships but cannot change them. Audit fields use the session.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/suppliers` | Supplier collection and database-derived counts |
| POST | `/api/suppliers` | Create supplier; returns 201 |
| GET | `/api/suppliers/options` | Actual catalog items and compatible units |
| GET | `/api/suppliers/:id` | Supplier or 404 |
| PATCH | `/api/suppliers/:id` | Partial profile/status update |
| GET | `/api/suppliers/:id/items` | Current and historical item links |
| POST | `/api/suppliers/:id/items` | Create item link; returns 201 |
| PATCH | `/api/suppliers/:id/items/:supplierItemId` | Link/unlink or legacy optional-term update |

Strict Zod requests and shared response envelopes remain in use. PATCH retains
omitted values and rejects empty updates. Errors use 400 for validation,
401/403 for access, 404 for missing records and 409 for conflicts.

## Verification

Run backend TypeScript/tests and affected-file formatting checks when backend
code changes. Frontend verification covers request payloads, link/unlink/relink,
error responses, lint, TypeScript and production build. Mocked request tests
create no real records. Verify persistence/concurrency and desktop/narrow browser
interaction separately when a database test environment and browser are available.
