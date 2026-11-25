# KFF Backend <-> Frontend API & Realtime Contract

This document is the canonical integration contract between **Backend (`backend/`)** and **Frontend (`frontend/`)**. It lives in the root `docs/` folder outside both Git repositories so no documentation or AI files are pushed to app repos.

Whenever an API route, DTO, permission flag, header, CORS/cookie rule, or Socket.IO event changes:
- In this workspace, edit `docs/api-contract.md`, update both apps directly (skill `kff-fullstack-feature`), and run `.\kff.cmd check-docs`.
- When coordinating across separate AI sessions, emit a **Contract Handoff Block** (see [Cross-Repo Contract Handoff Protocol](#7-cross-repo-contract-handoff-protocol)) so another session can apply the matching changes accurately.

---

## 1. JSON Envelope & HTTP Status Conventions

Every JSON response uses one of two envelopes defined in the backend response helpers:

### Success Response
```json
{
  "success": true,
  "data": {}
}
```
- `message` may optionally appear when there is no payload (`sendSuccessNoDataResponse`: `{ "success": true, "message": "Signed out." }`).
- `200 OK`: Standard `GET`, `PATCH`, or action endpoints.
- `201 Created`: Resource creation endpoints (`POST`).
- `204 No Content`: Successful `DELETE` endpoints (empty body). The frontend's `apiRequest(..., allowEmpty = true)` handles both `204` and `{ "success": true }` envelopes.

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Readable client-safe error message.",
    "details": [
      { "path": "body.email", "message": "Invalid email", "code": "invalid_format" }
    ]
  }
}
```
- `400 Bad Request`: Zod validation failure (`error.details` populated, never echoes submitted secrets/passwords), malformed JSON, or invalid foreign keys/constraints.
- `401 Unauthorized`: Missing, invalid, or expired `jwt` session cookie / Bearer token. Frontend `QueryProvider` clears `["session"]` globally on `401`.
- `403 Forbidden`: Authenticated user lacks the required `RoleSettings` boolean flag.
- `404 Not Found`: Unknown route or missing record.
- `409 Conflict`: Unique constraint conflict (`23505`), exclusion conflict (`23P01`), restricted delete (`23001`), or stale optimistic state.
- `503 Service Unavailable`: Recognized PostgreSQL connectivity/capacity failure.

### Field & Precision Conventions
- All JSON keys use **camelCase** matching Drizzle schema properties.
- Monetary values and inventory quantities are formatted as **exact decimal strings** (4 decimal places for `numeric(14,4)`, 8 decimal places for UOM conversion factors) to avoid JavaScript floating-point precision loss.
- Dates use `YYYY-MM-DD`; timestamps use ISO-8601 strings with timezone offset (`new Date().toISOString()` / `z.iso.datetime({ offset: true })`).
- **PATCH semantics**: Omitted fields stay untouched; explicit `null` clears nullable fields; empty `{}` bodies are rejected (`400`).

---

## 2. Authentication, Sessions & Permissions

### Auth Endpoints (`/api/auth`)

| Method | Path | Request | Response `data` | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/login` | `{ "username": string, "password": string }` | `SessionUser` | Normalizes `username` with `.trim().toLowerCase()`. Sets `httpOnly` `jwt` cookie with a 3-hour (`10800s`) sliding idle timeout. |
| `POST` | `/api/auth/logout` | — | `{ "success": true, "message": "Signed out." }` | Clears `jwt` cookie using identical cookie options. |
| `POST` | `/api/auth/keepalive` | Authenticated | `{ "expiresAt": string, "idleTimeoutSeconds": 10800 }` | Slides `jwt` session cookie by 3 hours on active user input. Rejects tokens with `purpose: 'socket'`. |
| `GET` | `/api/auth/session` | Authenticated | `SessionUser` | Rejects tokens with `purpose: 'socket'`. Does not extend the idle timeout cookie. |
| `GET` | `/api/auth/socket-token` | Authenticated | `{ "token": string }` | Issues short-lived (`10m`) JWT with `{ id, purpose: 'socket' }` for proxy/cross-origin Socket.IO handshakes. |

Authenticated cookie mutations (`POST`/`PUT`/`PATCH`/`DELETE` outside `/api/auth/*`) also slide the `jwt` cookie when the token is at least 60 seconds old, while passive `GET` requests do not extend it. Expired or invalid cookie tokens are cleared and rejected with `401` (`Your session expired due to inactivity. Please sign in again.`).

### `SessionUser` Shape & `RoleSettings` Flags

```ts
export type RoleSettings = {
  canManageInventory?: boolean;
  canManagePurchasing?: boolean;
  canManagePacking?: boolean;
  canManageTransfers?: boolean;
  canManageUsers?: boolean;
  canManageAccounting?: boolean;
  notifyInventory?: boolean;
  notifyPurchasing?: boolean;
  notifyPacking?: boolean;
  notifyTransfers?: boolean;
  notifySales?: boolean;
  notifyAccounting?: boolean;
  notifyUsers?: boolean;
};

export type SessionUser = {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
  permissions: RoleSettings;
};
```

> Password hashes (`passwordHash`) never leave backend authentication queries or appear in `SessionUser`, `/api/user`, or any public DTO. Audit fields (`createdBy`, `updatedBy`) are derived on the backend from `request.user.id`.

---

## 3. Separated Repository & Cross-Origin Deployment Modes

Because backend and frontend deploy and run separately, configure both sides consistently according to the topology below:

| Deployment Topology | Frontend Configuration | Backend Configuration | Cookie & Socket Transport |
| --- | --- | --- | --- |
| **1. Local Dev** (`localhost:3000` & `localhost:3001`) | `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api` | `PORT=3001`, `CORS_ORIGIN=http://localhost:3000`, `COOKIE_SAME_SITE=strict`, `REALTIME_ENABLED=true` | Browser sends `jwt` cookie directly (`credentials: "include"`). Socket.IO connects directly with cookie. |
| **2. Production Same-Origin Proxy** (Recommended) | `BACKEND_URL=https://api.example.com` (sets `NEXT_PUBLIC_API_PROXY=true` and rewrites `/api/:path*` -> `${BACKEND_URL}/api/:path*`), `NEXT_PUBLIC_API_BASE_URL=/api`, optional `NEXT_PUBLIC_SOCKET_URL=https://api.example.com` | `CORS_ORIGIN=https://app.example.com`, `COOKIE_SAME_SITE=strict` (or `lax`), `REALTIME_ENABLED=true` | REST uses same-origin `/api/*` cookie; Socket.IO fetches `/api/auth/socket-token` and passes `auth: { token }` directly to backend. |
| **3. Production Direct CORS** | `NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api`, optional `NEXT_PUBLIC_SOCKET_URL=https://api.example.com` | `CORS_ORIGIN=https://app.example.com`, `COOKIE_SAME_SITE=none` (HTTPS required for `secure: true`) | Cross-origin `fetch` with `credentials: "include"`. If cookie on WS fails, `RealtimeProvider` falls back to `getSocketToken()`. |
| **4. Serverless Backend** (Vercel `api/index.js`) | Same-origin proxy (`BACKEND_URL`) or Direct CORS | `VERCEL=1` / `REALTIME_ENABLED=false`, `CORS_ORIGIN=https://app.example.com` | `GET /api/health` returns `realtime: false`; frontend disables WebSocket retries and polls active queries every `30s`. |

### Required Backend CORS Allowed Headers
`backend/src/app.ts` allows these request headers (all required when frontend features send mutations):
- `Content-Type`, `Authorization`, `Accept`
- `X-Notify-Mode`, `X-Notify-Role-Ids`, `X-Notify-Message`, `X-Socket-Id`

---

## 4. Custom Mutation-Sync & Notification Headers

On authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests outside `/api/auth/*` and `/api/notifications/*`, the frontend's `buildNotifyRequestHeaders()` automatically attaches metadata consumed by backend's `response.on('finish')` hook:

| Header | Values | Purpose |
| --- | --- | --- |
| `X-Notify-Mode` | `'auto' \| 'custom' \| 'none'` | Controls whether role-targeted persistent notifications are created and broadcast |
| `X-Notify-Role-Ids` | Comma-separated role IDs (e.g., `"2,5"`) | Used when `X-Notify-Mode` is `'custom'` |
| `X-Notify-Message` | `encodeURIComponent(note.slice(0, 300))` | Optional operator note included in the broadcast notification |
| `X-Socket-Id` | Originating Socket.IO socket ID | Excluded from the `data:sync` broadcast so the originating tab avoids redundant refetches |

---

## 5. Realtime Socket.IO Protocol & Query Invalidation Map

- **Rooms**: `all-users`, `role:<roleId>`, `user:<userId>`.
- **Handshake Auth**: `extractSocketToken` checks `handshake.auth.token`, `Authorization: Bearer ...`, then the `jwt` cookie.
- **Health Fallback**: `GET /api/health` returns `{ status, uptime, realtime, timestamp }`. When `realtime === false` (or after `5` failed connection attempts), `RealtimeProvider` switches to `offline` mode and polls active TanStack queries every `30,000ms` (plus window focus / visibility regain).

### Server -> Client Socket.IO Events

| Event Name | Room Target | Payload Type | Frontend Effect |
| --- | --- | --- | --- |
| `realtime:ready` | Connecting socket | `{ userId, roleId, recovered, connectedAt }` | Sets realtime status `"connected"`, stores `socket.id` in `useNotifyTargetStore` |
| `data:sync` | `all-users` (except `X-Socket-Id`) | `{ eventId, module, action, method, path, entityId, queryKeys, actorUserId, actorName, actorRoleId, timestamp }` | Coalesces `queryKeys` over `80ms` and invalidates matching TanStack Query root keys (visibility-aware) |
| `notification:new` | `role:<id>` for each `targetRoleIds` | `RoleNotificationDto` (`notificationId`, `title`, `message`, `module`, `action`, `entityId`, `route`, `targetRoleIds`, `targetRoleNames`, `selectionMode`, `actorUserId`, `actorName`, `actorRoleId`, `actorRoleName`, `createdAt`, `isRead`) | Prepends to `["notifications", userId]` cache & shows info toast if `actorUserId !== userId` |
| `session:refresh` | Socket whose role/status changed | `{ reason: 'account-removed' \| 'role-changed' }` | Invalidates `["session"]`, `["notifications"]`, `["notification-roles"]` (disconnects if account removed) |

### Canonical `ROUTE_SYNC_SPECS` (Source: `backend/src/modules/notifications/notification.rules.ts`)

| API Prefix | `module` | Frontend Route | Invalidated TanStack Query Root Keys (`queryKeys`) | `notificationTag` |
| --- | --- | --- | --- | --- |
| `/api/purchase-orders` | `purchase-orders` | `/purchase-orders` | `purchase-orders`, `purchase-order-detail`, `purchase-order-options`, `dashboard`, `accounting`, `operational-reports` | `notifyPurchasing` |
| `/api/receiving` | `receiving` | `/receiving` | `receiving`, `receiving-options`, `purchase-orders`, `purchase-order-detail`, `purchase-order-options`, `inventory-stocks`, `inventory-stock-options`, `lots`, `lot-detail`, `inventory-movements`, `inventory-reports`, `operational-reports`, `dashboard`, `accounting` | `notifyPurchasing` |
| `/api/packing-orders` | `packing-orders` | `/packing-orders` | `packing-orders`, `packing-reservations`, `packing-options`, `packing-detail`, `packing-preview`, `inventory-stocks`, `inventory-stock-options`, `lots`, `lot-detail`, `inventory-movements`, `inventory-reports`, `operational-reports`, `dashboard`, `accounting` | `notifyPacking` |
| `/api/packing-formulas` | `packing-formulas` | `/bom` | `packing-formulas`, `packing-formula-options`, `packing-options`, `packing-preview`, `sales-order-options`, `sales-order-material-plan`, `items`, `inventory-controls` | `notifyPacking` |
| `/api/transfers` | `transfers` | `/transfers` | `transfers`, `transfer-options`, `transfer-detail`, `inventory-stocks`, `inventory-stock-options`, `lots`, `lot-detail`, `inventory-movements`, `inventory-reports`, `operational-reports`, `dashboard`, `accounting` | `notifyTransfers` |
| `/api/sales-orders` | `sales-orders` | `/sales-orders` | `sales-orders`, `sales-order-options`, `sales-order-detail`, `delivery-orders`, `delivery-order-options`, `packing-orders`, `dashboard`, `accounting`, `operational-reports` | `notifySales` |
| `/api/delivery-orders` | `delivery-orders` | `/delivery-orders` | `delivery-orders`, `delivery-order-options`, `delivery-order-detail`, `sales-orders`, `sales-order-options`, `sales-order-detail`, `inventory-stocks`, `inventory-stock-options`, `lots`, `lot-detail`, `inventory-movements`, `inventory-reports`, `operational-reports`, `dashboard`, `accounting` | `notifyTransfers` |
| `/api/inventory/stocks` | `inventory-stocks` | `/inventory` | `inventory-stocks`, `inventory-stock-options`, `lots`, `lot-detail`, `inventory-movements`, `inventory-reports`, `operational-reports`, `dashboard`, `accounting` | `notifyInventory` |
| `/api/inventory-controls` | `inventory-controls` | `/inventory/scrap` | `inventory-controls`, `inventory-control-options`, `inventory-control-detail`, `inventory-stocks`, `inventory-stock-options`, `lots`, `lot-detail`, `inventory-movements`, `inventory-reports`, `operational-reports`, `dashboard`, `accounting`, `packing-formulas` | `notifyInventory` |
| `/api/lots` | `lots` | `/inventory/lots` | `lots`, `lot-detail`, `inventory-stocks`, `inventory-movements`, `inventory-reports`, `dashboard`, `accounting` | `notifyInventory` |
| `/api/items` | `items` | `/items` | `items`, `item-uoms`, `item-supplier-links`, `item-supplier-options`, `purchase-order-options`, `packing-options`, `sales-order-options`, `dashboard`, `accounting` | `notifyInventory` |
| `/api/item-packaging` | `item-packaging` | `/item-packaging` | `item-packaging-options`, `items`, `packing-formulas` | `notifyInventory` |
| `/api/suppliers` | `suppliers` | `/suppliers` | `suppliers`, `supplier-items`, `supplier-options`, `item-supplier-links`, `item-supplier-options`, `purchase-order-options` | `notifyPurchasing` |
| `/api/customers` | `customers` | `/customers` | `customers`, `sales-order-options`, `delivery-order-options` | `notifySales` |
| `/api/locations` | `locations` | `/locations` | `locations`, `inventory-stocks`, `inventory-stock-options`, `transfer-options`, `packing-options`, `receiving-options` | `notifyInventory` |
| `/api/uoms` | `uoms` | `/uom` | `uoms`, `items`, `item-uoms` | `notifyInventory` |
| `/api/reason-codes` | `reason-codes` | `/reason-codes` | `reason-codes`, `inventory-control-options` | `notifyInventory` |
| `/api/reorder-policies` | `reorder-policies` | `/reorder-policies` | `reorder-policies`, `reorder-policies-options`, `dashboard`, `inventory-reports` | `notifyInventory` |
| `/api/company-settings` | `company-settings` | `/settings` | `company-settings`, `dashboard`, `accounting` | `notifyAccounting` |
| `/api/roles` | `roles` | `/roles` | `roles`, `users`, `user-role-options`, `notification-roles`, `session` | `notifyUsers` |
| `/api/user` | `users` | `/users` | `users`, `roles`, `user-role-options`, `notification-roles`, `session` | `notifyUsers` |

---

## 6. Module Mapping Matrix (29 Modules)

| API Prefix | Backend Module | Frontend Hook | Primary Frontend Route(s) | Write Permission |
| --- | --- | --- | --- | --- |
| `/api/health` | `app.ts` inline | `realtime-provider.tsx` | All protected pages | Public |
| `/api/auth` | `auth` | `use-session.ts` | `/`, app shell | Session auth |
| `/api/notifications` | `notifications` | `notifications/use-notifications.ts` | Header bell / notification popover | Authenticated |
| `/api/dashboard` | `dashboard` | `dashboard/use-dashboard.ts` | `/dashboard` | Authenticated |
| `/api/user` | `users` | `users/use-users.ts` | `/users` | `canManageUsers` |
| `/api/roles` | `roles` | `roles/use-roles.ts` | `/roles` | `canManageUsers` |
| `/api/company-settings` | `company-settings` | `company-settings/use-company-settings.ts` | `/settings` | `canManageUsers` |
| `/api/items` | `items` | `items/use-items.ts` | `/items` | `canManageInventory` |
| `/api/item-packaging` | `item-packaging` | `item-packaging/use-item-packaging.ts` | `/item-packaging` | `canManageInventory` |
| `/api/reorder-policies` | `reorder-policies` | `reorder-policies/use-reorder-policies.ts` | `/reorder-policies` | `canManageInventory` |
| `/api/reason-codes` | `reason-codes` | `reason-codes/use-reason-codes.ts` | `/reason-codes` | `canManageInventory` |
| `/api/uoms` | `uoms` | `uoms/use-uoms.ts` | `/uom` | `canManageInventory` |
| `/api/locations` | `locations` | `locations/use-locations.ts` | `/locations` | `canManageInventory` |
| `/api/suppliers` | `suppliers` | `suppliers/use-suppliers.ts` | `/suppliers` | `canManagePurchasing` |
| `/api/customers` | `customers` | `customers/use-customers.ts` | `/customers` | `canManageInventory` |
| `/api/purchase-orders` | `purchase-orders` | `purchase-orders/use-purchase-orders.ts` | `/purchase-orders` | `canManagePurchasing` |
| `/api/receiving` | `receiving` | `receiving/use-receiving.ts` | `/receiving` | `canManageInventory` |
| `/api/lots` | `lots` | `lots/use-lots.ts` | `/inventory/lots`, `/lots` | `canManageInventory` |
| `/api/inventory/stocks` | `inventory-stocks` | `inventory-stocks/use-inventory-stocks.ts` | `/inventory`, `/inventory/adjustments` | `canManageInventory` |
| `/api/inventory/movements` | `inventory-movements` | `inventory-movements/use-inventory-movements.ts` | `/inventory/transactions` | Authenticated (read-only) |
| `/api/inventory-controls` | `inventory-controls` | `inventory-controls/use-inventory-controls.ts` | `/inventory/scrap`, `/formula-revisions`, `/inventory/count-sessions`, `/inventory/counts`, `/inventory/qc-decisions`, `/inventory/dispositions` | `canManageInventory` / `canManagePacking` / `canManageUsers` |
| `/api/packing-formulas` | `packing-formulas` | `packing-formulas/use-packing-formulas.ts` | `/bom` | `canManagePacking` |
| `/api/packing-orders` | `packing-orders` | `packing-orders/use-packing-orders.ts` | `/packing-orders`, `/packing-orders/reservations` | `canManagePacking` |
| `/api/transfers` | `transfers` | `transfers/use-transfers.ts` | `/transfers`, `/transfers/in-transit` | `canManageTransfers` |
| `/api/sales-orders` | `sales-orders` | `sales-orders/use-sales-orders.ts` | `/sales-orders` | `canManageInventory` |
| `/api/delivery-orders` | `delivery-orders` | `delivery-orders/use-delivery-orders.ts` | `/delivery-orders` | `canManageTransfers` |
| `/api/reports/inventory` | `inventory-reports` | `inventory-reports/use-inventory-reports.ts` | `/reports/inventory` | Authenticated |
| `/api/reports/operations` | `operational-reports` | `operational-reports/use-operational-reports.ts` | `/reports/packing`, `/reports/purchasing`, `/reports/transfers`, `/reports/genealogy` | Authenticated |
| `/api/accounting` | `accounting` | `accounting/use-accounting.ts` | `/accounting/*` (6 routes) | `canManageAccounting` |

> Legacy `brands` (`backend/src/modules/brands/`, `frontend/src/app/(protected)/(master-data)/brands/`) is retired; `labelItemId` on `items` replaces brands.

---

## 7. Cross-Repo Contract Handoff Protocol

When working in two separate repositories (one AI session for Backend, one AI session for Frontend), use the structured handoff blocks below so neither side guesses DTO fields, routes, permission flags, or cache keys.

### Template A: Backend -> Frontend Handoff
Emitted by backend AI agents after changing any API route, schema, response field, permission, or realtime spec:

```markdown
### KFF Contract Handoff (Backend -> Frontend)
- **Module / Route Prefix**: `<module>` (`/api/<prefix>`)
- **Breaking vs Additive**: `Additive | Breaking`
- **Endpoints Changed**:
  - `METHOD /api/<prefix>/...` — auth/permission guard (`canManage...`), HTTP status codes
- **Request Payload Schema**:
  - Strict fields, types, nullable/omitted behavior, exact decimal scale (e.g. `quantity: string (4dp)`), date/timestamp format
- **Response DTO Diff (`data`)**:
  - Added/updated/removed camelCase fields and nullability
- **Realtime & Cache Invalidation (`ROUTE_SYNC_SPECS`)**:
  - `queryKeys`: `[...]`
  - `notificationTag`: `notify...`
- **Recommended Frontend Files to Update**:
  - `frontend/src/components/modules/<module>/<entity>.schema.ts`
  - `frontend/src/hooks/modules/<module>/use-<module>.ts`
  - `frontend/src/lib/module-bulk-imports.ts` (if CSV import columns changed)
  - `frontend/tests/<entity>-api.test.mjs`
  - `docs/api-contract.md`
```

### Template B: Frontend -> Backend Request
Emitted by frontend AI agents when UI work requires a new or modified backend capability:

```markdown
### KFF Contract Request (Frontend -> Backend)
- **Requested Module / Endpoint**: `METHOD /api/<prefix>/...`
- **Business Goal / Spec Reference**: `docs/...`
- **Permission Guard Needed**: e.g. `canManageInventory`
- **Expected Request Schema**: Body/params/query fields, exact decimal/date types, nullable semantics
- **Expected Response DTO (`{ success: true, data }`)**: CamelCase shape needed by Zod parser
- **Expected Realtime `queryKeys` & Error Cases**: e.g. `409 Conflict` conditions, invalidation keys
- **Target Backend Files**:
  - `backend/src/modules/<module>/<entity>.schema.ts`
  - `backend/src/modules/<module>/<entity>.routes.ts`
  - `backend/src/modules/<module>/<entity>.controller.ts`
  - `backend/src/modules/<module>/<entity>.service.ts`
  - `backend/src/modules/notifications/notification.rules.ts`
  - `docs/api-contract.md`
```
