# Frontend Architecture

This document describes the standalone Next.js 16 frontend architecture, how it communicates with the separate Express backend over REST and Socket.IO, and the conventions governing feature modules, state, and tests.

---

## Directory Layout

```text
frontend/
├── README.md                        # App quickstart, env modes, route map & checks
├── .env.example                     # Environment variable template
├── next.config.ts                   # /api/* production proxy rewrite & Watchpack guard
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Self-hosted Inter font, Toaster, QueryProvider
│   │   ├── globals.css              # Tailwind v4 tokens (@theme inline -> --font-inter)
│   │   ├── page.tsx                 # Public login entry
│   │   └── (protected)/             # Sidebar-grouped App Router pages + protected shell
│   ├── components/
│   │   ├── ui/                      # shadcn/ui (base-nova / Base UI) primitives
│   │   ├── shared/                  # PageHeader, ModuleGuide, ComboboxSelect, BulkImport*, RecordTable
│   │   ├── layout/                  # AppSidebar, NavMain, NavUser, AppBreadcrumb, Realtime bell
│   │   └── modules/<module>/        # Feature components & Zod schemas (<entity>.schema.ts)
│   ├── hooks/
│   │   ├── use-session.ts           # Auth login, logout, session query & state reset
│   │   ├── use-mobile.ts            # Mobile breakpoint helper
│   │   └── modules/<module>/        # Feature hooks (API calls, TanStack Query, dialog store)
│   ├── lib/
│   │   ├── api-request.ts           # HTTP boundary, proxy resolution, notify headers, ApiError
│   │   ├── realtime-notify-store.ts # Zustand store for notify target roles, note, and socketId
│   │   ├── create-dialog-store.ts   # Per-module Zustand modal/confirmation state factory
│   │   ├── load-status.ts           # Unified session + query loading/error status helper
│   │   ├── workspace-access.ts      # Accounting-only portal vs. operational workspace routing helpers
│   │   ├── idle-session.ts          # 3-hour idle session timeout timers, keepalive & cross-tab helpers
│   │   ├── module-guides.ts         # In-app module help entries (required for active routes)
│   │   └── module-bulk-imports.ts   # CSV templates, column validators & bulk upserts (21 modules)
│   └── providers/
│       ├── query-provider.tsx       # Shared TanStack QueryClient & global 401 session expiry
│       └── realtime-provider.tsx    # Socket.IO sync, notifications, & 30s health polling fallback
└── tests/                           # Node test runner mocked-fetch & validation suites
```

---

## Feature Module Pattern (Reference: `users`)

Every feature module follows the same unidirectional flow without extra API wrapper layers or putting server state in Zustand:

```text
app/(protected)/<section>/<route>/page.tsx
  -> hooks/modules/<module>/use-<module>.ts   (TanStack Query + mutations + createDialogStore)
     -> lib/api-request.ts                    (fetch with credentials, notify headers, error parsing)
        -> Express API (`/api/<prefix>`)
```

1. **Page (`page.tsx`)**: Calls the feature hook once and renders `PageHeader`, statistics cards, table, confirmation dialogs, and lazy-loaded forms as siblings.
2. **Schema (`components/modules/<module>/<entity>.schema.ts`)**: Owns Zod response DTO schemas, strict create/update input types, form validation, and domain helpers.
3. **Hook (`hooks/modules/<module>/use-<module>.ts`)**: Defines endpoint constants, `apiRequest` helpers, Zod parsing (`schema.array()` on lists), query keys, mutations with cache updates/invalidations, toast notifications, `createDialogStore()`, and `getLoadStatus()`.
4. **Statistics & Tables**: Receive query data via props. Tables use TanStack Table v9 (`useTable`, `tableFeatures`, `createColumnHelper`, `table.FlexRender`), support sorting (`aria-sort`), column visibility, row selection, CSV export of selected/filtered rows, and responsive mobile horizontal scroll (`@media`/`overflow-x-auto`) inside the table container.
5. **Forms**: Receive values and async save callbacks via props, lazy-loaded via `next/dynamic`, remain mounted after first open so close/focus transitions complete cleanly, and await server confirmation before closing.

---

## HTTP & Proxy Client ([src/lib/api-request.ts](../frontend/src/lib/api-request.ts))

- **Base URL resolution (`resolveRequestBaseUrl`)**:
  - Defaults to `NEXT_PUBLIC_API_BASE_URL` (fallback `http://localhost:3001/api`).
  - When running in the browser with `NEXT_PUBLIC_API_PROXY === "true"`, routes REST requests through same-origin `/api` so Next.js rewrites forward requests to `BACKEND_URL` (keeping session cookies first-party).
- **Credentials & Envelopes**:
  - Always sends `credentials: "include"` and JSON headers (`Accept: application/json`).
  - Handles `204` / bodyless success when `allowEmpty` is `true`, and parses `{ success: true, data }` vs `{ success: false, error: { message } }` into `ApiError(status, message)`.
- **Global HTTP 401 expiry ([query-provider.tsx](../frontend/src/providers/query-provider.tsx))**:
  - `QueryCache` and `MutationCache` inspect errors once at the root and clear `SESSION_QUERY_KEY` (`["session"]`) on any `401 ApiError`.
- **Mutation notification metadata**:
  - For non-auth, non-notifications `POST`/`PUT`/`PATCH`/`DELETE` calls, `buildNotifyRequestHeaders()` attaches `X-Notify-Mode`, `X-Socket-Id`, optional `X-Notify-Role-Ids`, and optional `X-Notify-Message`.

---

## Realtime & Fallback Sync ([src/providers/realtime-provider.tsx](../frontend/src/providers/realtime-provider.tsx))

When a session user is signed in (`userId != null`):
1. Connects Socket.IO to `resolveSocketUrl()` (`NEXT_PUBLIC_SOCKET_URL`, or `API_BASE_URL` without `/api`) with `withCredentials: true` and `transports: ["websocket", "polling"]`.
2. In proxy mode (`NEXT_PUBLIC_API_PROXY === "true"`), or if cookie WS auth fails, calls `GET /api/auth/socket-token` and passes `auth: { token }` in the Socket.IO handshake.
3. On `realtime:ready`, records `socket.id` in `useNotifyTargetStore` so the backend can exclude the originating tab via `X-Socket-Id`.
4. On `data:sync`, coalesces `payload.queryKeys` over an `80ms` window (or until tab becomes visible) and invalidates each matching root query key in TanStack Query.
5. On `notification:new`, validates with `roleNotificationSchema`, prepends to `["notifications", userId]`, increments `unreadCount`, and triggers an info toast if sent by another user.
6. On `session:refresh`, invalidates session, notification inbox, and notification role options.
7. **Health fallback**: Checks `GET /api/health` after 3 failed socket attempts; if `realtime === false` (or after 5 retries), activates `offline` fallback polling (`30_000ms` interval + refetch on tab focus/visibility).

---

## Shared UI Components

- **Dual Workspace Shell (`Operational Workspace` vs. `Accounting Portal`)**: [workspace-access.ts](../frontend/src/lib/workspace-access.ts), [login-form.tsx](../frontend/src/components/modules/login/login-form.tsx), [protected-route-guard.tsx](../frontend/src/components/layout/protected-route-guard.tsx), and [app-sidebar.tsx](../frontend/src/components/layout/app-sidebar.tsx) isolate Accounting-only roles (`canManageAccounting === true` with all five operational/admin permissions false) into their own simple Accounting Portal (**Dashboard** with 4 KPI boxes and 4 visual charts, **Sales & Invoices** with printable invoice preview via [accounting-invoice-dialog.tsx](../frontend/src/components/modules/accounting/accounting-invoice-dialog.tsx), **Expenses & Bills**, **Financial Reports** quick CSV hub, **Stock Value**, and **Production Costs**), while hiding Accounting from the sidebar and `/accounting*` routes for all other roles. The main operational `/dashboard` also uses a focused 4-box + 4-chart layout.
- **Idle Session Monitor (`SessionIdleGuard`)**: [idle-session.ts](../frontend/src/lib/idle-session.ts) and [session-idle-guard.tsx](../frontend/src/components/layout/session-idle-guard.tsx) track real user input across tabs, trigger `POST /api/auth/keepalive` every 15 minutes while active, warn 5 minutes before timeout, and sign out automatically after 3 hours of inactivity.
- **Dropdowns (`ComboboxSelect` / `Combobox`)**: Mandatory on every form selector, filter, and pagination page-size control ([frontend-rules.md](frontend-rules.md)).
- **Navigation & Guides**: Every sidebar route in [app-sidebar.tsx](../frontend/src/components/layout/app-sidebar.tsx) has matching entries in [app-breadcrumb.tsx](../frontend/src/components/layout/app-breadcrumb.tsx) and [module-guides.ts](../frontend/src/lib/module-guides.ts).
- **Bulk CSV Import**: Shared `BulkImportActions` ([bulk-import-actions.tsx](../frontend/src/components/shared/bulk-import-actions.tsx)) renders **Import CSV** in `PageHeader` actions across 21 modules; template download sits exclusively inside `BulkImportDialog` ([bulk-import-dialog.tsx](../frontend/src/components/shared/bulk-import-dialog.tsx)).
- **Typography & Theme**: [layout.tsx](../frontend/src/app/layout.tsx) loads local `src/app/fonts/inter-variable.woff2` (`--font-inter`) and [globals.css](../frontend/src/app/globals.css) binds `@theme inline` `--font-sans` and `--font-heading` to `var(--font-inter)`.

---

## Testing Pattern

Tests in `frontend/tests/*.test.mjs` run on Node's native test runner and mock `globalThis.fetch` without contacting a live backend:
- Verify request URLs, query parameters, HTTP methods, `credentials: "include"`, notify headers, `AbortSignal` preservation, error envelope extraction, nullability, and Zod rejection of malformed DTOs.
