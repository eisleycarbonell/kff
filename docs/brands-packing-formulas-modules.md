# Brands and Packing Formulas

These master-data modules follow the [system flow](system-flow.md). Brands are
available at `/brands`; Packing Formulas are available at `/bom`. Both use real
backend records and the existing Users-style forms, tables, search, sorting,
selection, CSV export, column controls and pagination.

## Brands

A brand has a unique uppercase code (up to 30 characters), a name unique ignoring
case (up to 120 characters), an optional description (up to 2,000 characters),
active status and authenticated audit fields. Public records include `itemCount`.
Items have an optional `brandId`; responses include nullable brand code/name.
The item form offers active brands and preserves an item's current inactive
brand. Clearing the selection sends null; an omitted PATCH value is unchanged.

All authenticated users can read brands. Writes require `canManageInventory`.
Only active brands may be newly assigned. Deactivation preserves existing item
assignments; it does not deactivate items or change stock. Brands are not hard
deleted. Names/labels represent current master data, not versioned historical
brand artwork or a labeling-approval workflow.

| Method | API | Behavior |
| --- | --- | --- |
| GET | `/api/brands` | Complete brand collection |
| GET | `/api/brands/:id` | Brand or 404 |
| POST | `/api/brands` | Create; 201 |
| PATCH | `/api/brands/:id` | Update supplied fields; activate/deactivate |

Apply the [additive migration](../backend/supabase/migrations/20261107000000_brands/migration.sql)
once before starting the updated application against an existing database. It
creates brands and adds a nullable item reference without changing stock, lot,
order, ledger or reservation records. Existing items initially have no brand.

## Packing formulas

Each Finished Good has at most one current formula, stored as its existing
`bill_of_materials` component rows. The finished product's `itemId` identifies the grouped current BOM.
[Formula Revisions](inventory-controls-and-reports.md) provides release headers.
Quantities describe the material required per one primary finished-product unit.
Product, brand, output UOM, material details, component count and audits are
returned for inspection. Read access is authenticated; writes require
`canManagePacking`; release review additionally requires `canManageUsers`
and an independent user.

| Method | API | Behavior |
| --- | --- | --- |
| GET | `/api/packing-formulas` | Complete grouped formulas and components |
| GET | `/api/packing-formulas/options` | Active finished products, materials and units |
| GET | `/api/packing-formulas/:itemId` | Formula or 404 |
| POST | `/api/packing-formulas` | 409; prepare a Formula Revision |
| PATCH | `/api/packing-formulas/:itemId` | 409; release a Replace revision |
| DELETE | `/api/packing-formulas/:itemId` | 409; release a Retire revision |

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

Current BOM maintenance uses numbered, dated revisions with independent release
approval. Existing BOMs are a legacy published baseline. Release is manual on or
after the effective date; there is no scheduled automatic publication. Failed
release rolls back the published rows and approval state. See the complete
[release contract and UI path](inventory-controls-and-reports.md).

All inputs reject unknown fields and client-provided audits. APIs use the shared
success/error envelopes and safe database-error boundary. Reads missing records
return 404; invalid inputs return 400; permission failures return 401/403; state,
duplicate or reference conflicts use 409 where applicable.

## Sample data and checks

[Sample data](test-data.md) includes two active brands, one inactive brand and
eight branded finished goods, each with a four-material packing formula. The
empty-database importer does not overwrite existing brands, formulas, items or
operational data. Existing populated datasets need explicit UI setup or a fresh
dedicated test dataset to receive the new examples.

Backend HTTP/schema tests check strict inputs, independent permissions, exact
decimals, server audit identity and safe failures. Frontend request tests check
URLs, payloads, DTOs, cancellation, six-place quantities and compatible units.
The PostgreSQL integration test uses `TEST_DATABASE_URL` only and checks actual
brand assignment, concurrent formula creation, failed-replacement rollback,
immutable packing snapshots, completion after formula removal and ledger/balance
consistency. It never falls back to the application database.
