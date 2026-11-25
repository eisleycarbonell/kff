# KFF Backend — Agent Rules

Applies to `backend/`. This file lives in the root `docs/` folder (outside
`backend/`) so AI instructions are never committed to the backend Git repository.
Run backend commands from `backend/`.

## Read first

| When | Read |
| --- | --- |
| Always, before business changes | [business-rules.md](business-rules.md) — shared rules (not repeated here) |
| Changing business behavior | the relevant section of [system-flow.md](system-flow.md) |
| Touching a module | its contract in `docs/` (e.g. [items](items-module.md), [sales/delivery](sales-delivery-modules.md), [inventory stocks](inventory-stocks-module.md), [UOM/locations](uom-locations-modules.md), [controls](inventory-controls-and-reports.md)) |
| HTTP route, DTO, error code, permission, CORS/cookie, `X-Notify-*`/`X-Socket-Id`, Socket.IO | [api-contract.md](api-contract.md) |
| Directory layout, request lifecycle, DB connection, SQLSTATE map, test pattern | [backend-architecture.md](backend-architecture.md) |
| Seed/sample data, resets | [test-data.md](test-data.md) |

## Skills (`../.agents/skills/`)

| Skill | Use when |
| --- | --- |
| `kff-backend-module` | Creating/refactoring/debugging an Express + Drizzle module and its tests |
| `kff-frontend-bridge` | Any HTTP/DTO/permission/CORS/cookie/`ROUTE_SYNC_SPECS` change |
| `supabase-postgres-best-practices` | Indexes, locking, pooling, query tuning |
| `supabase` | Supabase Auth/Storage/RLS/CLI/connection issues |

[skills-lock.json](../skills-lock.json) tracks external skills; local `kff-*`
skills live directly in `../.agents/skills/`.

## Enforcing the business rules in the backend

- Validate request shape with Zod; enforce permissions, workflow state,
  relationships, quantities and availability in the service or authorization
  middleware, using the shared Drizzle client and the actual schema.
- Run these inside one PostgreSQL transaction: receiving, reservation creation,
  packing start/completion, adjustments, scrap, transfer dispatch/receipt and
  delivery dispatch/completion. Commit operational records, ledger entries,
  balances, reservation changes and statuses together, or roll everything back.
- Concurrency: call `requireActiveLocation(tx, id)` before inventory writes and
  hold that transaction through ledger/balance commit; lock locations and lots
  in ascending ID order; lock lots → balances → reservations; re-check
  `onHand - activeReservations` (packing + delivery) after acquiring locks.
- Convert compatible UOMs into the item's primary UOM with exact decimal precision.
- Retired workflows (Count Sessions, QC Decisions, Stock Dispositions) reject
  new creation/transition requests. Brands schema is retained but not mounted.
- Populate `createdBy`/`updatedBy` from `request.user`; enforce role flags
  independently of frontend controls.
- The system flow's service names are business responsibilities; implement
  them with the existing route → controller → service → transaction/Drizzle layers.

## Stack and conventions

- Node.js 24+, Express 5, TypeScript, ESM, Drizzle ORM with postgres.js, Zod 4.
- Explicit `.ts` extensions on relative imports and `import type` for types.
  Node runs TypeScript by type stripping: no runtime `enum`, no constructor
  parameter properties.
- Reuse the response helpers, status constants, Pino logger, password helpers,
  database client and shared middleware. Follow `.prettierrc`.
- Module folders plural, feature files singular kebab-case:
  `src/modules/items/item.schema.ts`, `item.routes.ts`, `item.controller.ts`,
  `item.service.ts` (optional `item.rules.ts` for pure invariants).
- Create only the files a feature needs. Shared infrastructure goes in
  `src/errors/`, `src/middleware/`, `src/db/` or `src/utils/`. No repository
  layer, DI framework or generic CRUD base class.

## Module pattern (reference: `backend/src/modules/users/`)

Adapt fields and behavior to the feature and the actual database schema.

1. **Schema** — [user.schema.ts](../backend/src/modules/users/user.schema.ts):
   separate create, partial-update, params and query schemas; infer service
   input types with `z.output<typeof schema>`. Synchronous constraints here;
   database lookups and business checks in the service.
2. **Routes** — [user.routes.ts](../backend/src/modules/users/user.routes.ts):
   router factory receives the service; `validateRequest(schema)` before each
   handler that consumes input.
3. **Controller** — [user.controller.ts](../backend/src/modules/users/user.controller.ts):
   read `response.locals.validated` (typed `ValidatedResponse`), use response
   helpers, throw `AppError` for expected failures; Express 5 forwards rejected
   async handlers, so just await and return.
4. **Service** — [user.service.ts](../backend/src/modules/users/user.service.ts):
   no Express objects; explicit projections and writable fields; parameterized
   queries; transactions for multi-step writes. Other features may call a
   service's exported operations, never another feature's controller/router.
5. **Composition** — register routers in `createApp` ([app.ts](../backend/src/app.ts)),
   supply real services and `listen` in [index.ts](../backend/src/index.ts).
   Pass all module services in one `modules` object (`{ userService, authService, ... }`,
   with optional feature properties so HTTP tests only pass the services they
   exercise); never add a separate positional argument.

## Validation rules

- Validate every body, param and query a handler uses through
  [validate-request.ts](../backend/src/middleware/validate-request.ts); keep
  Express's original request properties (including the read-only query getter) intact.
- Strict objects for writable bodies: reject unknown fields, client-supplied
  primary IDs, password hashes and audit fields; allow required writable FKs.
- Normalize names/email like the users schema; preserve passwords exactly.
  Match lengths, enums, numeric bounds, date formats and nullability to the contract.
- Keep omitted, null, empty, false and zero distinct where the domain needs it.
  PATCH updates supplied fields only, rejects empty updates and has no create defaults.
- IDs parse to positive integers within column range. Decimals, dates and
  timestamps follow their actual types — no silent lossy conversion.
- Validation failure → HTTP 400 with readable `error.message` and
  `error.details[{ path, message, code }]`; never echo input values or passwords.

## Errors and responses

- [AppError](../backend/src/errors/app-error.ts) for expected, client-safe
  failures; keep resource-specific business errors in the feature.
- [database-error.ts](../backend/src/errors/database-error.ts) translates
  PostgreSQL errors through Drizzle's nested `cause` chain (cycle-safe). Extend
  that shared mapping for new categories; no generic database handling in
  controllers. Status mapping: see
  [backend-architecture.md](backend-architecture.md#error-handling-boundary).
- Messages stay resource-agnostic: no raw SQL, driver messages, constraint
  details or parameters. Unknown failures → generic 500, logged server-side.
- [error-handler.ts](../backend/src/middleware/error-handler.ts) also handles
  Zod, malformed JSON and oversized bodies; register it after routes and the
  JSON 404 handler; if headers were sent, delegate with `next(error)`.
- Envelopes: `{ success: true, data }` and `{ success: false, error: { message, details? } }`.
  201 on create, 404 for missing records, 204 without body on delete.

## Database and compatibility

- Reuse `src/db/index.ts` and `src/db/schema.ts`; generated migration snapshots
  are not application source. Database changes must be explicitly in scope.
- Users API: keep `/api/user` URLs, camelCase fields, nullable values and
  soft-delete filtering. Password hashes only in auth lookups; public responses
  use a projection without passwords. Hash new passwords with the Argon2
  helper; user PATCH does not accept a password.
- The users list returns the full collection for frontend paging; coordinate
  any server-pagination change with the frontend (statistics, export scope).
- Auth routes live under `/api/auth`. Every other module router uses
  `createAuthMiddleware()` + `requirePermission(...)` per the permission matrix
  in [api-contract.md](api-contract.md#6-module-mapping-matrix-29-modules)
  and derives `createdBy`/`updatedBy` from `request.user`.

## Module boundaries

- **Inventory Stocks** ([contract](inventory-stocks-module.md)) owns
  quantities, not item master data. Count adjustments need `canManageInventory`,
  an existing lot/location, an Inventory Adjustment reason, the expected on-hand
  and the counted value; one transaction for balance + ledger; reject stale
  counts or counts below reservations. No direct balance-edit or delete endpoints.
- **UOM and Locations** ([contract](uom-locations-modules.md)): exact
  8-place factors, one base per nonempty class, reference locks, empty-class
  deletion. Locations deactivate (no hard delete) only with no stock,
  outstanding reservations or open work. Metadata APIs never edit stock.
- **Items** ([contract](items-module.md)): exact decimals,
  deactivation, primary-UOM/type lock on referenced items.
- **Controls** ([contract](inventory-controls-and-reports.md)): company
  settings, packaging/reorder/reason maintenance, scrap approvals, formula
  releases, operational reports and read-only history for retired kinds. Keep
  review and stock rules in backend transactions.

## Verification

- Run from `backend/` after request, routing, service, validation or error
  changes: `npm run typecheck`, `npm test`, and Prettier check on affected files.
  (`tsc` covers app source and Drizzle config; tests/migrations are excluded.)
- Examples: [user-schema.test.ts](../backend/tests/user-schema.test.ts),
  [database-error.test.ts](../backend/tests/database-error.test.ts),
  [user-api.test.ts](../backend/tests/user-api.test.ts). Cover required/invalid inputs,
  normalization, unknown fields, PATCH omission/null, ID parsing, envelopes and
  statuses, nested DB failures and private-data leakage.
- HTTP tests use fake services; verify real persistence only when a test
  database is in scope. Report checks that could not run.
- Inventory workflows: atomic rollback, concurrent reservation limits, lot and
  source-document traceability, primary-UOM quantities, ledger/balance
  consistency, authorization, state transitions and failed/repeated operations.
- Documentation-only changes: `kff check-docs`, no runtime tests.

References: [Zod](https://zod.dev/api),
[Express 5 errors](https://expressjs.com/en/5x/guide/error-handling/),
[SQLSTATE codes](https://www.postgresql.org/docs/current/errcodes-appendix.html).
