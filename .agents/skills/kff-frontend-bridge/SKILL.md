---
name: kff-frontend-bridge
description: >-
  Use whenever modifying backend API routes, request/response DTO schemas, error codes,
  RoleSettings permission flags, CORS/cookie configuration, or Socket.IO realtime
  notifications and query keys (`ROUTE_SYNC_SPECS`). Keeps docs/api-contract.md and
  the frontend synchronized.
---

# KFF Frontend Bridge

Keep the **KFF Frontend** synchronized whenever backend contracts or communication behavior change.

## Procedure

1. **Read the canonical contract and specs first**:
   - Read [docs/api-contract.md](../../../docs/api-contract.md).
   - Read [docs/business-rules.md](../../../docs/business-rules.md) and the affected module contract under `docs/` (starting from [docs/system-flow.md](../../../docs/system-flow.md)).
2. **Verify API & DTO compatibility**:
   - Preserve `{ success: true, data }` / `{ success: false, error: { message, details? } }` envelopes, HTTP status codes (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `503`), and camelCase JSON keys matching Drizzle schema properties.
   - Keep money and stock quantities as exact decimal strings (`4dp` balances/quantities, `8dp` UOM factors) and ISO-8601 date/timestamp formatting.
   - Distinguish omitted fields from explicit `null` in `PATCH` handlers, and never expose `passwordHash` or raw SQL errors.
3. **Check Auth, CORS, Cookies, & Realtime impacts**:
   - If adding custom request headers or routes, verify `cors({ allowedHeaders, origin: parseCorsOrigins(), credentials: true })` in [app.ts](../../../backend/src/app.ts).
   - If modifying `jwt` cookie options or socket auth, keep `/api/auth/socket-token` and `COOKIE_SAME_SITE` compatibility intact for proxy and cross-origin frontends (see [auth.controller.ts](../../../backend/src/modules/auth/auth.controller.ts) and [socket.ts](../../../backend/src/realtime/socket.ts)).
   - If adding or renaming API prefixes or `RoleSettings` flags, update `ROUTE_SYNC_SPECS` in [notification.rules.ts](../../../backend/src/modules/notifications/notification.rules.ts) so Socket.IO `data:sync` invalidates the right frontend TanStack Query keys.
4. **Update contract & frontend**:
   - Update [docs/api-contract.md](../../../docs/api-contract.md) whenever endpoints, payloads, permissions, or `ROUTE_SYNC_SPECS` change.
   - In this workspace, apply the matching frontend updates directly (follow `kff-fullstack-feature`). If handing off to a separate session, emit a `KFF Contract Handoff (Backend -> Frontend)` block using the template in [docs/api-contract.md](../../../docs/api-contract.md#7-cross-repo-contract-handoff-protocol).
5. **Validate backend checks**:
   - From `backend/`, run `npm run typecheck` and `npm test`.
