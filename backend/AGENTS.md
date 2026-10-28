# KFF Backend Rules

These rules apply to `backend/`. Run commands from this directory. Use the
users API as the reference for new modules and module refactors. Adapt its
fields and behavior to the feature and the actual database schema.

## Shared system flow and backend business rules

Read the [shared agent instructions](../AGENTS.md) and the
[complete system flow](../docs/system-flow.md) before changing a business
feature. The system-flow document defines the business requirements; the users
API below remains the reference for backend module structure.

- Implement inventory operations in backend business services using the shared
  Drizzle client and the actual database schema. Validate request shape with
  Zod, then enforce permissions, workflow state, relationships, quantities, and
  availability in the service or appropriate authorization middleware.
- Run receiving, reservation creation, packing start/completion, adjustments,
  scrap, and transfer dispatch/receipt inside PostgreSQL transactions. Commit
  related operational records, ledger entries, balances, reservation changes,
  and statuses together, or roll the entire operation back.
- Enforce availability under concurrency with appropriate database-level
  locking or atomic checks. Account for other active reservations when
  calculating available stock and maximum producible quantity.
- Snapshot BOM requirements into packing-order materials at creation and
  require a valid BOM before planning. Preserve those snapshots for historical
  orders. Consume reservations and release unused quantities as documented.
- Receiving creates a lot linked to the PO line, records the Receive ledger
  entry, updates stock, and supports partial receiving. Packing completion
  creates a finished lot linked to the packing order, records Consume/Produce
  entries, and updates source and destination stock atomically.
- Treat inventory transactions as append-only. Correct errors with additional
  transactions. Track balances by item/lot/location and use compatible UOM
  conversions into the item's primary UOM with appropriate decimal precision.
- Require distinct transfer locations. Dispatch posts source-to-In-Transit
  movements; receipt posts In-Transit-to-destination movements. Branches and
  stores use the same stock and ledger services as warehouses.
- Preserve foreign-key integrity and lot provenance. Support optional lot dates
  where appropriate. Populate `createdBy` and `updatedBy` from authenticated
  identity and enforce role permissions independently of frontend controls.
- Derive reports from operational data and use the documented statuses and
  relationships. Compare requested workflows with existing schema/contracts
  and coordinate necessary changes within the feature's scope.

The general service-layer diagram in the business document uses the existing
Express route -> controller -> service -> transaction/Drizzle architecture.
Keep services focused on the requested business operation and reuse shared
validation, response, authorization, and error handling.

## Stack and conventions

- Node.js 24+, Express 5, TypeScript, ESM, Drizzle ORM with postgres.js, and Zod 4.
- Use explicit `.ts` extensions for relative imports and `import type` for types.
  The server runs TypeScript directly; use syntax supported by Node's type
  stripping, without runtime TypeScript enums or constructor parameter properties.
- Use the existing response helpers, status constants, Pino logger, password
  helpers, database client, and shared middleware.
- Keep module folders plural and feature filenames singular and kebab-case,
  for example `modules/items/item.schema.ts` and `item.routes.ts`.
- Follow the installed dependency APIs and the formatting in `.prettierrc`.

## Structure

```text
backend/
  src/
    index.ts                       # Environment, real services, startup/listen
    app.ts                         # HTTP middleware, module registration, final errors
    modules/
      users/
        user.schema.ts             # Zod request schemas and inferred input types
        user.routes.ts             # Router factory and validation middleware
        user.controller.ts         # Controller factory and HTTP responses
        user.service.ts            # Business rules and Drizzle queries
      items/
        item.schema.ts             # Catalog validation and exact decimal strings
        item.routes.ts             # Authenticated catalog routes
        item.controller.ts         # Catalog responses and authenticated audit IDs
        item.service.ts            # Catalog persistence and relationship protection
      inventory-stocks/
        inventory-stock.schema.ts  # Stock filters and counted-adjustment inputs
        inventory-stock.routes.ts  # Authenticated stock reads and protected counts
        inventory-stock.controller.ts # HTTP contract and server actor
        inventory-stock.service.ts # Balances, reservations, atomic ledger writes
        inventory-stock.rules.ts   # Exact decimal and count invariants
      auth/
        auth.schema.ts             # Login validation and public session types
        auth.routes.ts             # Login/logout/session routes
        auth.controller.ts         # Cookie/session responses
        auth.service.ts            # Credentials and current role settings
    errors/
      app-error.ts                 # Expected failures with safe client messages
      database-error.ts            # Shared SQLSTATE extraction and translation
    middleware/
      validate-request.ts          # Parse body/params/query into response.locals
      error-handler.ts             # One API error response boundary
      auth.ts                      # Session authentication and role permission checks
      httpLogger.ts                # Shared HTTP logging
    db/
      index.ts                     # Shared database client
      schema.ts                    # Authoritative application database schema
      column.helpers.ts            # Shared database columns
    utils/                         # Existing response, logging, hashing, JWT helpers
    types/express.d.ts             # Shared request augmentation
  tests/                           # Node tests with fake services; no live database
  drizzle.config.ts
```

Create only the files a feature needs. Keep routes, controllers, schemas, and
services together under `src/modules/<module>/`. Shared infrastructure belongs
under `src/errors/`, `src/middleware/`, `src/db/`, or `src/utils/`. A separate
repository layer, dependency-injection framework, or generic CRUD base class
is unnecessary for the current modules.

## Reference files and responsibilities

1. **Schemas validate and normalize inputs.** Read
   [user.schema.ts](src/modules/users/user.schema.ts). Define separate create,
   partial-update, route-parameter, and query schemas as needed. Infer service
   input types with `z.output<typeof schema>` so runtime parsing and TypeScript
   agree. Validate synchronous input constraints here; perform database lookups
   and business checks in the service.

2. **Routes connect validation to controllers.** Read
   [user.routes.ts](src/modules/users/user.routes.ts). Register
   `validateRequest(requestSchema)` before each handler that consumes input.
   Router and controller factories receive the feature service explicitly.

3. **Controllers translate between HTTP and services.** Read
   [user.controller.ts](src/modules/users/user.controller.ts). Consume parsed
   data from `response.locals.validated`, typed with `ValidatedResponse`.
   Use the response helpers and status constants. Throw `AppError` for expected
   failures such as a missing record. Express 5 forwards rejected async handlers
   to the shared error middleware, so handlers can simply await and return.

4. **Services own business rules and persistence.** Read
   [user.service.ts](src/modules/users/user.service.ts). Keep Express request and
   response objects out of services. Use explicit projections and writable
   fields, parameterized Drizzle queries, and transactions for operations that
   must succeed together. Other features may call a service's intentional
   exported operations; avoid importing another
   feature's controller or router.

5. **Application composition stays in the entry files.** Read
   [app.ts](src/app.ts) and [index.ts](src/index.ts). Register feature routers in
   `createApp`; supply real services and call `listen` in `index.ts`. Pass every
   service, including Users, in the same modules object:
   `createApp({ userService, authService, itemService, stockService, uomService, locationService })`.
   Do not give a feature service a separate positional argument. Extend the
   modules object when adding a module. Tests use the same factory signature
   with fake services instead of importing startup or connecting to the database.

## Validation rules

- Validate bodies, route parameters, and query parameters that a handler uses.
  Use [validate-request.ts](src/middleware/validate-request.ts) to obtain parsed
  output. Keep Express's original request properties intact, including its
  read-only query getter.
- Use strict objects for writable bodies. Reject unknown fields, client-supplied
  primary IDs, password hashes, and server-managed audit fields. Include actual
  writable foreign keys required by the feature.
- Normalize names and email as the users schema does. Preserve passwords
  exactly. Match lengths, enum values, numeric bounds, date formats, and
  nullability to the feature's API and database contract.
- Keep omitted, null, empty, false, and zero values distinct where the domain
  requires it. In PATCH requests, update supplied fields only. Reject empty
  updates and keep create-only defaults out of partial-update schemas.
- Parse IDs into valid positive integers within the database column's range.
  Validate decimal, date, and timestamp values according to their actual types;
  avoid silent lossy conversions for money or inventory quantities.
- A validation failure returns HTTP 400 with a readable `error.message` and
  `error.details` containing `path`, `message`, and `code`. Include no input
  values or passwords in the error response.

## Shared error handling

- Use [AppError](src/errors/app-error.ts) for expected failures with messages
  safe for clients. Keep resource-specific business errors in the feature.
- Use [database-error.ts](src/errors/database-error.ts) for PostgreSQL errors.
  It reads SQLSTATE codes through Drizzle's nested `cause` chain and guards
  against cycles. Extend this shared mapping when another module needs a new
  database error category; keep generic database handling out of controllers.
- The shared mapping handles duplicate/exclusion conflicts as 409; foreign-key,
  missing-value, check, format, length, and range failures as 400; restricted
  deletes as 409; and recognized connection/capacity failures as 503.
- Keep messages independent of users, roles, or other specific resources.
  Return no raw SQL, driver messages, constraint details, or query parameters.
  Unknown failures produce a generic HTTP 500 and are logged server-side.
- [error-handler.ts](src/middleware/error-handler.ts) also handles Zod errors,
  malformed JSON, and oversized bodies. Register it after routes and the JSON
  404 handler. If headers were already sent, delegate with `next(error)`.
- Return `{ success: true, data }` for successful reads/writes and
  `{ success: false, error: { message, details? } }` for errors. Use 201 for
  creation, 404 for missing records, and 204 without a body for successful deletes.

## Database and compatibility rules

- Reuse `src/db/index.ts` and `src/db/schema.ts`; generated migration snapshots
  are not application source. Include database changes explicitly in the task
  scope rather than changing tables as a side effect of an API refactor.
- Preserve the users API's `/api/user` URLs, camelCase fields, nullable values,
  and soft-delete filtering. Keep hashes in authentication lookups only;
  public users responses use an explicit projection that excludes passwords.
- Hash new passwords with the existing Argon2 helper. The current user PATCH
  contract updates profile fields and does not accept a password.
- The current users list returns a complete collection for frontend filtering
  and pagination. Coordinate any future server pagination contract with the
  frontend, including statistics and export scope.
- User-management routes require authenticated `canManageUsers` access. Enforce
  permissions in backend middleware even when the frontend hides actions.
- Authentication routes are registered under `/api/auth`. Catalog routes under
  `/api/items` require an authenticated session; writes require
  `canManageInventory`. Use the shared authentication/permission middleware and
  server-derived audit identities for new protected features.
- Read [the items module contract](../docs/items-module.md) for exact decimal
  fields, deactivation, and the primary-UOM/type lock on referenced catalog items.
  Register real item and auth services through the app factory in `index.ts`.

## Verification

Run `npm run typecheck` and `npm test` after changes to requests, routing,
services, validation, or errors. Check formatting on affected files using the
installed Prettier CLI. Type checking covers application source, tests, and
the Drizzle config; historical generated migration files are excluded.

Use [user-schema.test.ts](tests/user-schema.test.ts),
[database-error.test.ts](tests/database-error.test.ts), and
[user-api.test.ts](tests/user-api.test.ts) as examples. Test required and invalid
inputs, normalization, unknown fields, PATCH omission/null behavior, ID parsing,
response envelopes/statuses, nested database failures, and private-data leakage.
Use fake services for HTTP tests; verify real persistence separately when a
database test environment is part of the task. Report checks that could not run.
Documentation-only changes need a consistency review rather than runtime tests.

For inventory workflows, also verify atomic rollback, concurrent reservation
limits, lot and source-document traceability, primary-UOM quantities, ledger
and balance consistency, and authorization. Cover receiving/packing/transfer
state transitions and failed/repeated operations according to the business flow.

API references: [Zod schemas](https://zod.dev/api),
[Express 5 error handling](https://expressjs.com/en/5x/guide/error-handling/), and
[PostgreSQL SQLSTATE codes](https://www.postgresql.org/docs/current/errcodes-appendix.html).

## Inventory Stocks boundary

Stock quantities belong to [Inventory Stocks](../docs/inventory-stocks-module.md),
not item master data. Count adjustments require `canManageInventory`, an existing
lot/location, an Inventory Adjustment reason, an expected on-hand value, and the
counted value. Update balances and append the ledger entry in one transaction.
Lock lots first, then balances, then reservations; lock multiple lots in ascending
ID order. Recheck active outstanding reservations and reject stale counts or a
count below reservations. Do not create direct balance-edit or delete endpoints.

## UOM and Locations boundary

Read [the UOM and Locations contract](../docs/uom-locations-modules.md) before
changing these modules. Preserve exact 8-place UOM factors, one base per nonempty
class, reference locks, and empty-class deletion. Locations deactivate without
hard deletion and must have no stock, outstanding reservations, or open work.
Inventory writers use `requireActiveLocation(transaction, id)` from the locations
service before writes and hold that transaction through ledger/balance commit.
Lock multiple locations in ascending ID order. Metadata APIs never edit stock.
