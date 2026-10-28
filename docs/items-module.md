# Items / Products module

The catalog follows the shared [system flow](system-flow.md). The frontend lives
at `/items` under Master Data; backend handlers live under `/api/items`.
The users module remains the architecture reference.

## Catalog behavior

- Create and edit raw materials, packaging hardware, packaging labels, and
  finished goods using the actual `items` table.
- Search by name, SKU, type, or unit; filter by type/status, sort, select rows,
  control visible columns, export filtered/selected CSV rows, and paginate.
- Deactivate and reactivate through `isActive`. Deactivation preserves item IDs,
  purchasing/packing relationships, lot history, and ledger references.
- Primary UOM options come from `uoms` and `uom_classes`, including their class.
- Items referenced by suppliers, BOMs, packaging configurations, purchasing,
  packing, lots, stock, reservations, transfers, or ledger entries have locked
  item type and primary UOM. The backend checks this under an item-row lock.
- Stock quantities belong in [Inventory Stocks](inventory-stocks-module.md) at
  `/inventory`. Keep catalog fields and stock balances in their separate modules.
- Catalog edits do not change inventory quantities or historical lot costs.

## Authentication and access

The login form uses the backend login route. Successful login sets an HttpOnly,
SameSite=Strict JWT cookie; production cookies also require HTTPS. The backend
requires `JWT_SECRET` in its environment and uses the existing `DATABASE_URL`
configuration. Supply a private, random signing secret for your environment.
The authenticated user and role settings are loaded from the database for every
protected request; a token alone does not grant inventory-management permission.

All authenticated users can read/export the catalog. Creating, editing,
activating, and deactivating require `permissions.canManageInventory === true`.
The frontend reflects the same permission. `createdBy` and `updatedBy` come from
the authenticated identity and cannot be supplied by the client.

| Method | Endpoint | Access / behavior |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ username, password }`; returns public session data and sets the JWT cookie |
| GET | `/api/auth/session` | Authenticated public user identity and role settings |
| POST | `/api/auth/logout` | Clears the cookie |
| GET | `/api/items` | Authenticated; all active and inactive catalog records |
| GET | `/api/items/uoms` | Authenticated; database UOM choices |
| GET | `/api/items/:id` | Authenticated; one item or 404 |
| POST | `/api/items` | Inventory manager; creates an item, returns 201 |
| PATCH | `/api/items/:id` | Inventory manager; partial update, returns 200 |

There is no permanent-delete operation in this catalog. Use PATCH with
`{ "isActive": false }` or `{ "isActive": true }` for availability changes.
Browser requests include credentials. API clients may also send a Bearer JWT.
Existing `/api/user` URLs and payloads are preserved; all user-management
operations now require an authenticated role with `canManageUsers === true`.
This prevents public account creation from bypassing catalog permissions.

## Fields and validation

Writable fields are `sku`, `name`, `itemType`, `primaryUomId`, `unitCost`,
`netWeightG`, `shelfLifeDays`, `requiresQc`, and `isActive`.

- SKU: trimmed, uppercase, required, maximum 50 characters; database uniqueness
  remains authoritative. Name is trimmed, required, and limited to 120 characters.
- Item types match the four database enum values in the system flow.
- Primary UOM IDs are positive PostgreSQL integers referencing an existing unit.
- Reference cost is a non-negative decimal **string** matching `numeric(14,4)`:
  up to 10 whole digits and 4 decimal places. No currency is assumed.
- Net weight is a nullable non-negative decimal string matching `numeric(12,4)`:
  up to 8 whole digits and 4 decimal places. Shelf life is nullable positive
  integer days. Clearing either optional value explicitly sends null.
- Flags must be actual booleans. Create defaults are cost `"0"`, QC false, and
  active true. PATCH applies only supplied fields and rejects empty updates.
- Unknown fields, audit identities, IDs in writable bodies, and computed fields
  are rejected. Public responses include the UOM/class names and `isInUse`.
- Numeric money/weight inputs, scientific notation, negatives, excess precision,
  invalid enums, and invalid foreign-key selections are rejected.

Responses use the shared success/error envelopes. Validation failures return
400 with field paths. Authorization returns 401/403, missing items return 404,
and conflicting or immutable changes return 409. Database errors use the shared
safe error middleware.

## Checks

From `backend/`: `npm run typecheck` and `npm test`.
From `frontend/`: `npm run test:api`, affected-file lint, TypeScript, and
`npm run build`. Tests use fake services/fetch and do not modify live databases.
Check persistence and visual interactions separately against the configured
local environment. The existing tables support this module without a migration.
