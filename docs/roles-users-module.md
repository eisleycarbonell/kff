# Users, Roles & Permissions

The Users & Access sidebar group contains `/users` and `/roles`. Both screens
require `canManageUsers === true`. The backend independently checks that permission
on every request and rechecks the acting user's current permissions inside each
role/account write transaction.

## Roles

Role names, descriptions and the five supported permission flags use the existing
`roles` table and its `settings` JSON column. No database migration or rebuild is
required. The [rebuild script](../rebuild-test-database.cmd) already derives its
schema from the application's current tables; it is not needed to enable this module.

Supported permissions are `canManageInventory`, `canManagePurchasing`,
`canManagePacking`, `canManageTransfers` and `canManageUsers`. A new role starts
with every permission off. There are no wildcard or client-supplied administrator
flags. Only JSON boolean `true` grants a permission. Permission labels describe
the existing operational permission boundaries in the [system flow](system-flow.md).

Sales-order and customer management reuse `canManageInventory`. Delivery-order
management reuses `canManageTransfers`, which also manages internal stock
transfers. There are no additional `canManageSales` or `canManageDelivery` flags.
Authenticated readers can view those operational modules without management
permissions; every write still checks its corresponding permission on the backend.

The [sample dataset](test-data.md) creates six roles and six assigned accounts:
Administrator (all five permissions), Warehouse Manager (inventory, packing and
transfers), Purchasing (purchasing), Sales (inventory), Delivery (transfers), and
Viewer (none). Consequently Administrator and Warehouse Manager manage both
sales and delivery orders. Sales also manages inventory; Delivery also manages
stock transfers. These are configured role examples, not special role-name checks.

Role responses include `roleId`, `name`, nullable `description`, normalized
`settings`, `userCount`, `activeUserCount`, and server-managed audit fields.
`userCount` includes archived accounts because their historical role references
remain in the database. `activeUserCount` excludes soft-deleted accounts.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/roles` | Complete role list with permissions and assignment counts |
| GET | `/api/roles/:id` | A role or 404 |
| POST | `/api/roles` | Create a role; returns 201 |
| PATCH | `/api/roles/:id` | Update supplied fields; returns the updated role |
| DELETE | `/api/roles/:id` | Delete an unused role; returns 204 |

All endpoints require authenticated user management access. Names are trimmed,
required, limited to 80 characters, and unique ignoring case. Descriptions are
limited to 500 characters; blank/null descriptions clear the field. PATCH merges
only supplied permission keys, preserving omitted permissions and explicit false.
Empty updates, unknown keys, invalid IDs, and forged audit/count fields return 400.
Referenced roles cannot be deleted, including roles referenced by archived users;
the operation returns 409. The database foreign key provides an additional guard.

The UI offers search, permission filtering, sorting, pagination, row selection,
column controls and CSV export. Exports include selected filtered rows, or all
filtered rows when there is no selection. New/edit forms preserve values after
failures and block duplicate submissions/dismissal while saving.

## User assignments and permission changes

The Users page reads role options from `/api/roles` with its own DTO and cache.
Names, filters, CSV exports, role choices and user-manager statistics use configured
roles rather than fixed IDs or names. New accounts require an explicitly selected
role. Existing `/api/user` request and response contracts remain in place; passwords
are hashed on the backend and never returned in public user responses.

User create, update and soft-delete operations stamp the authenticated actor.
Creation and reassignment require an existing role. Changes to roles invalidate
role lists, user role options, user data and the acting client's session. User
changes invalidate role assignment counts and the current session. The sidebar
hides Users & Access for accounts without user management permission; direct
navigation still displays a permission message and protected API calls return 403.
Other clients obtain updated controls on session refresh. Their next API request
always uses the current database permissions, including already-issued tokens.

All role and account writes use a shared transaction advisory lock and recheck
the actor after acquiring it. Any change that would leave no active account with
`canManageUsers` is rejected with 409 and rolled back. This covers role permission
changes, account reassignment, account deletion, and concurrent combinations of
those operations. Administrators can change their own access when another active
manager remains.

## Verification

Run backend `npm run typecheck`, `npm test`, and affected-file Prettier checks.
Run frontend `npm run test:api`, affected-file lint, TypeScript and `npm run build`.
The role API tests cover authentication, current permission checks, strict payloads,
partial permission updates, authenticated audit identity and safe error responses.
Frontend request tests cover dynamic role options, payloads, assignment counts,
malformed responses, cancellation, form validation and explicit false/null.

Set `TEST_DATABASE_URL` to a dedicated PostgreSQL test database to enable
[role-integration.test.ts](../backend/tests/role-integration.test.ts). It uses a random
isolated schema and checks real role/user services, audit identities, password
privacy, references to archived users, duplicate names, rollback, concurrent
last-manager protection and rejection of a revoked actor. It never falls back to
the application `DATABASE_URL`.
