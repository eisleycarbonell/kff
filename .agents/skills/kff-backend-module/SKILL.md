---
name: kff-backend-module
description: >-
  Use when creating, refactoring, or debugging a backend KFF Express 5 + Drizzle ORM
  module (schema, routes, controller, service, transactions, error handling, or
  fake-service HTTP tests).
---

# KFF Backend Module Runbook

Step order only — the rules themselves are in
[docs/backend-rules.md](../../../docs/backend-rules.md) (conventions, validation,
errors, locking) and [docs/backend-architecture.md](../../../docs/backend-architecture.md)
(layout, lifecycle).

## Before editing

1. Read [docs/business-rules.md](../../../docs/business-rules.md), the relevant
   section of [docs/system-flow.md](../../../docs/system-flow.md), and the
   module contract under `docs/`.
2. Open the reference module under `backend/src/modules/users/` (`user.schema.ts`,
   `user.routes.ts`, `user.controller.ts`, `user.service.ts`); for stock or
   transactional work also inspect `backend/src/modules/inventory-stocks/` or
   `backend/src/modules/items/`.
3. Load companion skills when relevant: `supabase-postgres-best-practices` /
   `supabase` for schema, indexing, locking or connection issues;
   `kff-frontend-bridge` whenever an HTTP contract, DTO, permission flag or
   `ROUTE_SYNC_SPECS` entry changes.

## Steps

1. **Schema** `backend/src/modules/<module>/<entity>.schema.ts` — `z.strictObject`
   bodies; `z.output<typeof schema>` types; PATCH omission vs `null`.
2. **Service** `<entity>.service.ts` — explicit projections; one
   `db.transaction` per multi-table stock mutation; `requireActiveLocation(tx, id)`;
   lock order locations → lots → balances → reservations (ascending IDs);
   re-check availability; append to `inventory_transactions`.
3. **Routes + controller** — `authenticate` → `requirePermission(...)` →
   `validateRequest(...)` → handler reading `response.locals.validated`; throw
   `AppError`; shared response helpers; `.ts` import extensions.
4. **Composition** — register the router in `createApp(modules)`
   ([app.ts](../../../backend/src/app.ts)), inject the real service in
   [index.ts](../../../backend/src/index.ts), and add/verify the prefix in
   `ROUTE_SYNC_SPECS` ([notification.rules.ts](../../../backend/src/modules/notifications/notification.rules.ts)).
5. **Tests** — schema tests and `createApp(fakeServices)` HTTP tests modeled on
   `backend/tests/user-schema.test.ts` and `backend/tests/user-api.test.ts`.
6. **Contract** — if the HTTP surface changed, follow `kff-frontend-bridge`.
7. **Docs** — for any added feature or flow change, add `docs/<module>-module.md`
   (and index it in [docs/README.md](../../../docs/README.md)) or update the
   affected files in `docs/`, then run `.\kff.cmd check-docs`.

## Verify (from `backend/`)

```bash
npm run typecheck
npm test
npx prettier --check "src/**/*.ts"
```
