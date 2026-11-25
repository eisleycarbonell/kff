# Backend Architecture

This document explains how the standalone KFF backend is structured, how requests flow through Express 5 and Drizzle ORM, and what database and concurrency invariants must hold across modules.

---

## Directory Layout

```text
backend/
├── README.md                        # App quickstart and npm scripts
├── .env.example                     # Environment variable template
├── load-sample-data.cmd             # Load demo data into an empty test DB
├── rebuild-test-database.cmd        # Recreate schema (deletes test data)
├── start-test-backend.cmd           # Build & start testing backend
├── fresh-start.cmd                  # Rebuild empty DB (no sample data) & start clean backend
├── api/index.js                     # Vercel serverless entry wrapper (imports dist/)
├── src/
│   ├── index.ts                     # Composition root: env, services, HTTP + Socket.IO server
│   ├── app.ts                         # createApp(): middleware, routes, mutation sync, errors
│   ├── db/
│   │   ├── schema.ts                # Authoritative Drizzle PostgreSQL schema & RoleSettings
│   │   ├── connection.ts            # URL resolution, SSL/prepared/pool config (local vs Supabase)
│   │   ├── index.ts                 # Shared Drizzle client instance
│   │   ├── column.helpers.ts        # Shared audit columns (createdBy, createdAt, updatedBy, updatedAt)
│   │   ├── supabase.ts              # Lazy @supabase/supabase-js admin/public client
│   │   └── sample-*.ts / migrate-*.ts / create-demo-user.ts / seed.ts / rebuild.ts
│   ├── errors/
│   │   ├── app-error.ts             # Expected HTTP/domain errors safe to return to clients
│   │   └── database-error.ts        # PostgreSQL SQLSTATE & socket error translation
│   ├── middleware/
│   │   ├── auth.ts                  # createAuthMiddleware() & requirePermission()
│   │   ├── validate-request.ts      # Zod body/params/query parser -> response.locals.validated
│   │   ├── error-handler.ts         # Single final Express 5 JSON error boundary
│   │   ├── compression.ts           # HTTP response compression
│   │   └── httpLogger.ts            # Pino HTTP request logger
│   ├── realtime/
│   │   └── socket.ts                # Socket.IO server, JWT/cookie auth, room management, emitters
│   ├── utils/                       # jwtHandler, passwordHandler (Argon2), logger, responseHandler, auditLogger
│   ├── types/express.d.ts           # Express Request augmentation (request.user)
│   └── modules/<module>/            # Feature routes, controllers, Zod schemas, services, rules
└── tests/                           # Node test runner suites (fake services, no live DB)
```

---

## Request Lifecycle & Layers

```text
HTTP Request
  -> httpLogger & CORS (parseCorsOrigins(), credentials: true, allowedHeaders)
  -> compression & express.json()
  -> mutation sync `finish` hook (for POST/PUT/PATCH/DELETE outside /auth & /notifications)
  -> createAuthMiddleware() -> verifies `Authorization: Bearer` or `jwt` httpOnly cookie -> sets request.user & response.locals.session
  -> requirePermission(...) -> verifies `RoleSettings` boolean flags
  -> validateRequest(schema) -> Zod parses { body, params, query } -> response.locals.validated
  -> Controller -> translates HTTP params/validated data/actor ID -> calls Service -> sendSuccessResponse / 204
  -> Service -> PostgreSQL transaction, locking, domain invariants, Drizzle ORM queries
  -> Error Handler -> maps ZodError, JSON parse/limit errors, AppError, or SQLSTATE database errors
```

Key architectural rules:
- **Direct Node TypeScript execution**: Node 24 executes `.ts` directly via type stripping. Keep explicit `.ts` extensions on relative imports, use `import type` for types, and avoid runtime TypeScript `enum` or constructor parameter properties.
- **No per-module repository wrappers**: Route -> Controller -> Service is sufficient. Controllers own HTTP concerns and response helpers; services never import `Request` or `Response`.
- **Single factory composition**: `createApp(modules)` in [src/app.ts](../backend/src/app.ts) accepts one `modules` object containing every service so [tests/](../backend/tests) can pass fake services without starting the database or network listener.

---

## Database Resolution & Connection Management

Database connection resolution lives in [src/db/connection.ts](../backend/src/db/connection.ts):

1. **Environment selection (`resolveDatabaseUrl`)**:
   - `NODE_ENV=development`: Prefers `LOCAL_DATABASE_URL` or any local host (`localhost`, `127.0.0.1`, `::1`, socket `/`), falling back to `DATABASE_URL` / `POSTGRES_PRISMA_URL` / `POSTGRES_URL` / `DIRECT_URL`.
   - `NODE_ENV=test`: Reads runtime keys (`DATABASE_URL`, etc.).
   - `NODE_ENV=production`: Prefers non-local `SUPABASE_DB_URL` / `DATABASE_URL` / `POSTGRES_*` URLs first.
2. **CLI direct URLs (`resolveDirectDatabaseUrl` / `resolveDrizzleKitUrl`)**:
   - Strips `?pgbouncer` and `?supa` query params and enforces `sslmode=require&uselibpqcompat=true` for non-local databases so `drizzle-kit` and direct migration scripts succeed cleanly on Supabase.
3. **Pooling & Serverless safeguards (`resolveDatabaseConfig`)**:
   - Automatically sets `prepare: false` for Supabase poolers (`*.pooler.supabase.com`), port `6543`, `pgbouncer=true`, serverless (`VERCEL` / `AWS_LAMBDA_FUNCTION_NAME`), or `DB_PREPARE=false`.
   - Defaults connection pool size (`max`) to `1` on serverless and `10` on persistent Node processes (`DB_POOL_MAX` overrides).
   - Defaults SSL to `false` for local hosts and `'require'` for remote hosts (`DB_SSL` overrides).

---

## Inventory & Transaction Invariants

Stock-mutating operations run atomically inside a single PostgreSQL transaction:

1. **Append-only ledger**: Every stock change appends rows to `inventory_transactions` and updates `inventory_stock` balances in the same transaction. Never mutate historical ledger rows.
2. **Exact decimals**: Inventory quantities and currency amounts are modeled as fixed-scale decimal strings (`numeric(14, 4)` in PostgreSQL; 8-place UOM factors in `uom_conversions`) and converted to/from primary UOM safely without floating-point drift.
3. **Concurrency lock order**:
   - Lock locations in ascending ID order when touching multiple locations, always calling `requireActiveLocation(tx, id)` before stock writes.
   - Lock `lots` first (ascending ID order), then `inventory_stock` balances, then active reservations (`inventory_reservations` for packing and delivery allocations).
   - Availability (`onHand - activeReservations`) must be re-checked after acquiring locks so concurrent packing orders, count adjustments, scrap approvals, transfers, or delivery dispatches cannot double-allocate stock.
4. **BOM & Historical Snapshots**: Packing orders require an active packing formula and snapshot component requirements at creation.
5. **Retired workflows**: Count Sessions, QC Decisions, and Stock Dispositions under `/api/inventory-controls` remain readable for historical records; new creation/state mutations for those kinds are rejected. Use direct Stock Adjustments (`POST /api/inventory/stocks/adjustments`) and Scrap & Disposal (`/api/inventory-controls`).
6. **Audit fields**: `createdBy` and `updatedBy` are populated server-side from the authenticated session (`request.user.id`), never from request payloads.

---

## Error Handling Boundary

All uncaught route/middleware rejections flow to [errorHandler](../backend/src/middleware/error-handler.ts):

- `ZodError` -> `400 Bad Request` (`{ success: false, error: { message, details: [{ path, message, code }] } }`, no input values leaked).
- Malformed JSON (`entity.parse.failed`) -> `400`, oversized body (`entity.too.large`) -> `413`.
- `AppError` -> domain status (`400`, `401`, `403`, `404`, `409`, etc.) and safe message.
- Drizzle/Postgres errors -> [mapDatabaseError](../backend/src/errors/database-error.ts) inspects nested `cause` chains safely:
  - `23505`, `23P01`, `23001` -> `409 Conflict`
  - `23503`, `23502`, `23514`, `22P02`, `22001`, `22003` -> `400 Bad Request`
  - Connection / `08*` / `53300` / `53400` / `57P01`–`57P03` -> `503 Service Unavailable`
  - Anything else -> `500 Internal Server Error` logged via Pino without exposing SQL or driver internals.

---

## Testing Pattern

Tests in `backend/tests/*.test.ts` use Node's built-in `node --experimental-strip-types --test`:
- **Schema tests**: Strict field rejection, normalization, decimal bounds, nullability, and PATCH omission rules (reference: [user-schema.test.ts](../backend/tests/user-schema.test.ts)).
- **Error mapping tests**: Nested SQLSTATE & connection error cycles (reference: [database-error.test.ts](../backend/tests/database-error.test.ts)).
- **HTTP app tests**: Construct `createApp(fakeServices)` and test routing, Zod middleware, permission middleware, envelope shapes, `204` deletes, and zero private-field leaks without hitting a live database (reference: [user-api.test.ts](../backend/tests/user-api.test.ts)).
