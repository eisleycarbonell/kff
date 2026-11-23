# Labels and Packing Formulas

These master-data responsibilities follow the [system flow](system-flow.md).
Labels are maintained as inventory items at `/items`; Packing Formulas are
created, updated, copied, and removed directly at `/bom`. Formula Revisions has
been retired (`/formula-revisions` redirects to `/bom`).

## Labels in Items / Products

Create a printed label as type `Packaging - Label`, with its own SKU and primary
stock UOM, usually pc. On a Finished Good select that material in **Labels**.
The association is optional and stored in `items.label_item_id`, a nullable
self-referencing foreign key. Public item fields are `labelItemId`,
`labelItemSku` and `labelItemName`. Only active label materials may be newly
assigned; existing inactive assignments can survive unrelated edits. Only a
Finished Good can carry a label association. Catalog writes require Inventory.

The association is optional, stored in `items.label_item_id`, and automatically
pre-included (`1` primary unit) when creating a packing formula in `/bom`.
Verify the label and quantities in the saved BOM so packing reserves and consumes
label stock. Changing the catalog association does not silently edit saved BOMs
or historical packing snapshots.

Brands are removed from the menu and active API composition. The old
`/brands` page redirects to Items. Legacy brand tables/references are retained
to preserve existing history; no new brand records are seeded or required.
The filename of this contract is retained so existing documentation links work.

Apply [the additive migration](../backend/supabase/migrations/20261114000000_customer_planning_labels/migration.sql)
with `npm run db:migrate:customer-planning` from `backend/`. It adds the label
reference and sales customer-PO reference without resetting operational data.
For existing formulas a unique label component can safely identify the initial
association; otherwise choose the label explicitly in Items. Do not infer a
label material from a former brand name.

## Packing formulas

Each Finished Good has at most one current formula, stored as its existing
`bill_of_materials` component rows. The finished product's `itemId` identifies the grouped current BOM.
Quantities describe the material required per one primary finished-product unit.
Product, label, output UOM, material details, component count and audits are
returned. Read access is authenticated; direct create, update, and remove writes
require `canManagePacking` without a separate revision approval step.

| Method | API | Behavior |
| --- | --- | --- |
| GET | `/api/packing-formulas` | Complete grouped formulas and components |
| GET | `/api/packing-formulas/options` | Active finished products (`labelItemId`), materials (`itemType`), and units |
| GET | `/api/packing-formulas/:itemId` | Formula or 404 |
| POST | `/api/packing-formulas` | Create a direct packing formula (requires `canManagePacking`) |
| PATCH | `/api/packing-formulas/:itemId` | Atomically replace formula components (requires `canManagePacking`) |
| DELETE | `/api/packing-formulas/:itemId` | Remove current formula rows while preserving historical orders |

Each component contains `{componentItemId, quantity, uomId}`. Require 1-100
distinct active raw materials, packaging hardware or labels. Self-reference and
finished-good components are prohibited. Units must share the material primary
unit's class. Quantities are positive exact strings compatible with
`numeric(14,6)`: up to eight whole digits and six fractional digits. Packing
continues to reject target/consumption quantities that cannot be represented
exactly in primary stock units; the editor does not round material requirements.

Edits do not move the formula to another product. They validate and replace all
rows in one transaction, or roll back the replacement. Product locks serialize
formula creation/replacement/removal with new packing-order snapshots. Material
and UOM locks protect referenced definitions during validation. Duplicate formula
creation conflicts. Existing packing orders, including drafts, keep their own
material snapshot; editing/removing today's formula does not recalculate them,
change reservations, or prevent valid historical-order completion. A product
without a current formula cannot create new packing orders.

Direct BOM edits at `/bom` validate and replace rows in a single transaction,
setting `revisionId: null` and preserving existing packing orders untouched.
`/formula-revisions` redirects to `/bom` and historical `Formula` control requests
in `review_requests` remain read-only history. See
[Controls and Reports](inventory-controls-and-reports.md).

All inputs reject unknown fields and client-provided audits. APIs use the shared
success/error envelopes and safe database-error boundary. Reads missing records
return 404; invalid inputs return 400; permission failures return 401/403; state,
duplicate or reference conflicts use 409 where applicable.

## Demo data and checks

[Realistic demo data](test-data.md) contains eight finished goods with matching
label-material assignments and four-component formulas. Each product uses bulk
ingredient, hardware, printed label and seal. The importer preserves populated
databases; it does not recreate Brands. Historical packing orders retain their
own material requirements. See [the module demo guide](module-demo-guide.md)
for setup, release, material planning and packing steps.
