# KFF Frontend — Agent Rules

Applies to `frontend/`. This file lives in the root `docs/` folder (outside
`frontend/`) so AI instructions are never committed to the frontend Git
repository. Run frontend commands from `frontend/`. Shorthand such as `app/`,
`components/`, `hooks/`, `lib/` means `frontend/src/<folder>/`.

## Framework docs & TanStack Intent

- **Next.js 16**: APIs, conventions, and file structure differ from older Next.js
  versions. Read the relevant bundled guide in `frontend/node_modules/next/dist/docs/`
  before changing Next.js routing, metadata, or config APIs, and heed
  deprecation notices.
- **TanStack Intent**: Before editing files for a substantial TanStack Query or
  TanStack Table v9 task, run `npx @tanstack/intent@latest list` from `frontend/`,
  then `npx @tanstack/intent@latest load <package>#<skill>` and follow the
  loaded `SKILL.md` guidance.

## Read first

| When | Read |
| --- | --- |
| Always, before business changes | [business-rules.md](business-rules.md) — shared rules (not repeated here) |
| Changing business behavior or navigation | the relevant section of [system-flow.md](system-flow.md) (sidebar grouping and route names: section 21) |
| Touching a module | its contract in `docs/` (e.g. [sales/delivery](sales-delivery-modules.md), [inventory stocks](inventory-stocks-module.md), [UOM/locations](uom-locations-modules.md)) |
| Endpoint, proxy/CORS, `X-Notify-*` header, Socket.IO invalidation | [api-contract.md](api-contract.md) |
| App shell, `apiRequest`, realtime provider, shared UI, test pattern | [frontend-architecture.md](frontend-architecture.md) |
| Demo accounts and sample data | [test-data.md](test-data.md) |

## Skills (`../.agents/skills/`)

| Skill | Use when |
| --- | --- |
| `kff-frontend-module` | Building/updating pages, hooks, tables, forms, bulk imports, module guides |
| `kff-backend-bridge` | Requesting/applying API changes or debugging proxy/CORS/cookie/Socket.IO issues |
| `shadcn` | Adding/customizing `base-nova` (Base UI) components |
| `animate-ui`, `gsap-*` (8) | Motion and animation |
| TanStack Intent | `npx @tanstack/intent@latest list` in `frontend/` before substantial TanStack Query/Table work |

[skills-lock.json](../skills-lock.json) tracks external skills; local `kff-*`
skills live directly in `../.agents/skills/`.

## Business rules as they appear in the UI

- Complex inventory logic and database writes stay in the backend. Obtain
  authoritative availability and production limits from the API; client
  calculations are previews only.
- Show on-hand, reserved and available stock distinctly, with the item's UOM
  and relevant lot/location.
- Packing screens show the product, target quantity, material requirements,
  reservations, source, destination and supported statuses; historical orders
  display their own material snapshot even after the BOM changes.
- Support partial PO receiving and remaining quantities; keep lot links to PO
  lines and packing orders visible; manufacture/expiry dates optional where allowed.
- The Create PO form requests `POST /api/purchase-orders/next-number`; the user
  may keep or replace it before saving.
- Show transfer dispatch, In Transit and confirmed receipt as distinct steps.
  Keep warehouse and branch stock views on the shared inventory model.
- Apply role flags to visible/disabled actions and handle backend 403s. Audit
  identities never appear as editable form fields.
- Offer workflow actions according to the record's backend state and the
  user's permissions. Await server confirmation before showing a stock change
  as successful, then refresh affected data and metrics.
- Build reports and dashboards from API data; keep placeholder or unavailable
  features visibly distinct from implemented workflows. Brands stays read-only.

## Stack

- Next.js App Router, TypeScript, React 19; Tailwind CSS v4.
- Server data: TanStack Query through the existing root `QueryProvider`.
- Client UI state: Zustand v5 via `lib/create-dialog-store.ts`. Server data
  never goes into Zustand or localStorage.
- Tables: installed TanStack Table v9 API (`useTable`, `tableFeatures`,
  `createColumnHelper`, `table.FlexRender`) as in the users table. Check
  installed APIs before copying examples from other versions.
- UI: shadcn/ui `base-nova` (Base UI) with its `render` prop and controlled
  values. Add missing primitives with `npx shadcn@latest add <component> --yes`.
- Validation: Zod for DTO parsing, pure form validation in the feature schema.
- Animation/icons: GSAP with `@gsap/react`; `lucide-react`.

## Module pattern (reference: `users`)

Read these before building or refactoring a module; adapt fields, endpoints,
actions and statistics to the feature. Other modules' placeholder pages are not
reference implementations.

| Concern | Reference file |
| --- | --- |
| Page composition, header action, loading, dialogs | [users/page.tsx](<../frontend/src/app/(protected)/(users-access)/users/page.tsx>) |
| Requests, query cache, mutations, notifications, feature state | [use-users.ts](../frontend/src/hooks/modules/users/use-users.ts) |
| Dialog store and load status | [create-dialog-store.ts](../frontend/src/lib/create-dialog-store.ts), [load-status.ts](../frontend/src/lib/load-status.ts) |
| DTOs, inputs, form values, validation | [user.schema.ts](../frontend/src/components/modules/users/user.schema.ts) |
| Statistics from page data | [user-statistics.tsx](../frontend/src/components/modules/users/user-statistics.tsx) |
| Table state, empty states, pagination | [user-table.tsx](../frontend/src/components/modules/users/user-table.tsx) |
| Columns, selection, row actions | [user-table-columns.tsx](../frontend/src/components/modules/users/user-table-columns.tsx) |
| Search, filters, bulk actions, export, column controls | [user-table-toolbar.tsx](../frontend/src/components/modules/users/user-table-toolbar.tsx) |
| Create/edit form, field errors, async submit | [user-form.tsx](../frontend/src/components/modules/users/user-form.tsx) |

File layout: page at `app/(protected)/(<section>)/<route>/page.tsx`; feature
components and `<entity>.schema.ts` in `components/modules/<module>/`; hook at
`hooks/modules/<module>/use-<module>.ts` (collection name, e.g. `items/use-items.ts`);
tests in `tests/<entity>-api.test.mjs`. Singular entity names for files
(`item.schema.ts`, `item-table.tsx`). Create only files with real content.

### Responsibilities

1. **Page composes the module.** Call the feature hook once; pass data to
   statistics and table as siblings; wire form, confirmations, loading and
   retry in `page.tsx` (`"use client"` when needed). No wrapper component just
   to connect pieces.
2. **Hook owns requests and state.** Endpoint paths, request functions, schema
   parsing (`schema.array()` for lists), query keys, `useQuery`/`useMutation`,
   CRUD handlers, dialog state and toasts live together. Use the shared
   `apiRequest` (`lib/api-request.ts`) — no per-module fetch wrapper, `*.api.ts`,
   service or repository files. HTTP 401 is handled once in `QueryProvider`.
   Create the dialog store with `createDialogStore<Record, Target>()` at the top
   of the hook file and call it once per owner; wrap actions in `useCallback`
   only when they also reset a mutation. Derive `loadStatus` with `getLoadStatus`.
   Return plain values so components never see the store.
3. **Schema owns types and validation.** Response DTOs, separate create/update
   inputs, form values and pure helpers in `<entity>.schema.ts`. Match backend
   field names and nullability; keep server IDs, audit and private fields out of
   payloads (required FK IDs allowed). Password hashes never enter DTOs or cache.
4. **Statistics and tables receive data via props** — no duplicate fetching.
   Statistics own their calculations; the table owns sorting, filtering,
   pagination, column visibility and selection.
5. **Columns and controls stay with the table.** Module-scope config and column
   helpers; memoized columns with stable callbacks; type-only table imports;
   pagination in the table; single-use CSV helper in the toolbar.
6. **Forms get values and async actions via props.** Validate/normalize, await
   saves, close only on success, keep input and errors on failure. Lazy-load
   from the page and keep mounted after first use.

## Layout and visual rules

- **Dropdowns:** always the shared `ComboboxSelect`
  (`components/shared/combobox-select.tsx`) or `Combobox`
  (`components/ui/combobox.tsx`) for every form selector, filter and pagination
  size — never native `<select>` or plain `<Select>`.
- **Mobile (mandatory, down to 320px):** no page-level horizontal overflow,
  clipped controls or tiny touch targets. Use `min-w-0`, `flex-wrap`,
  `w-full sm:w-*`; horizontal scroll only inside `@/components/ui/table`
  (`overflow-x-auto`); size dialogs/sheets with `dvh`; navigation auto-closes the
  mobile sidebar; don't `truncate` critical KPI or status text.
- **Header:** `components/shared/page-header.tsx` with title, short description
  and the primary create action in `actions`. Importable modules use
  `BulkImportActions` (header shows **Import CSV** only; **Download template**
  stays inside `BulkImportDialog`; columns in `lib/module-bulk-imports.ts`).
- **Module guides:** every active sidebar module has an entry in
  [module-guides.ts](../frontend/src/lib/module-guides.ts) (purpose, operator steps,
  connected workflows, notes), aligned with the system flow and real actions.
- **Navigation:** keep `components/layout/app-sidebar.tsx`,
  `components/layout/app-breadcrumb.tsx` and `module-guides.ts` aligned when
  adding routes; reuse active styling from `components/layout/nav-main.tsx`
  (green background, left indicator, `aria-current="page"`).
- **Order:** header → meaningful statistics cards (existing spacing, large
  values, simple green icons) → one toolbar (search, filters, reset, selection
  actions, CSV export, column visibility; `h-10` controls) → table with row menu
  actions and footer pagination.
- **Styling:** `bg-card`, rounded border, muted header, row hover and selected
  styles; `text-muted-foreground` for secondary text; `app/globals.css` tokens.
  The protected layout supplies page background and spacing — no extra shell.
- **Accessibility:** labels on icon-only buttons and fields, `aria-sort` on
  sortable headers, preserved keyboard focus, status text alongside color.
  Show optional row details only when a value exists.

## Data and interaction rules

- API prefix from `NEXT_PUBLIC_API_BASE_URL`; resource paths in the hook, never
  hardcoded in components.
- Envelopes `{ success: true, data }` / `{ success: false, error: { message } }`;
  support 204 on delete; throw readable errors for HTTP, network, JSON and
  invalid DTO failures before data reaches components.
- Pass the query `AbortSignal` to fetch and preserve cancellation errors.
- Stable query keys; update cache from successful responses and invalidate
  affected queries after mutations.
- Keep cached rows visible when a background refetch fails; distinguish initial
  loading, query errors and mutation errors.
- Disable duplicate submits and dialog dismissal while pending.
- Bulk actions handle partial success: update successful rows, keep failures for retry.
- Reset pagination and selection when filters change. Export selected filtered
  rows if any, else all filtered rows, with proper CSV quoting, formula escaping
  and null handling.
- Stable record IDs for rows. If a module uses server pagination, adapt query,
  table, statistics, counts, selection and export scope together.
- Use each module's real backend schema; don't copy user-specific fields.
  Document assumed endpoints when the backend handler doesn't exist yet.
- No demo data, client-generated database IDs or localStorage fallbacks unless requested.

## Keep it simple

- Inline small single-use loading/feedback/confirmation markup; extract
  components for clear responsibilities only.
- No feature wrappers, extra providers, barrel files or generic abstractions.
- Client page metadata: React 19 `<title>`/`<meta>` tags like the users page;
  don't export `metadata` from client components or add a layout just for it.
- Route layouts only for shared UI, providers or real layout behavior.

## Repository conventions

- Authenticated routes under `app/(protected)/`, public routes directly under
  `app/`. Group protected pages by sidebar section with route groups such as
  `(master-data)/items/`; groups don't change URLs or API paths.
- `components/ui/` is generated shadcn code — no custom components; edit only
  for necessary type or dark-mode fixes. `components/layout/` owns the app shell.
  `components/shared/`, `lib/`, `types/` only for code shared by several features.
- Features never import another feature's components, schemas or hooks.
- kebab-case filenames, PascalCase components, `@/` imports, established
  suffixes such as `user.schema.ts`.

## Module boundaries

- **Inventory Stock** (`/inventory`, [contract](inventory-stocks-module.md))
  owns on-hand/reserved/available; Items (`/items`) owns catalog fields.
  Quantities are exact decimal strings; summary totals grouped by primary UOM.
  Count adjustments need lot, location, reason and the preserved expected
  balance; only inventory managers see actions; keep failed counts; refresh
  stock after commit. No delete action on balances or ledger history.
- **UOM and Locations** (`/uom`, `/locations`, [contract](uom-locations-modules.md)):
  8-place factor strings, real classes, protected referenced conversions;
  locations manage type and active status only (stock stays in Inventory Stock);
  disable inactive adjustment locations; invalidate item unit options and
  inventory labels/options after metadata changes.

## Verification

- Request changes: mocked-fetch tests like `tests/user-api.test.mjs` checking
  URLs, payloads, responses, errors, nullability and cancellation; test the
  hook's request exports (no API layer just for tests).
- Run from `frontend/` what fits the change: affected-file lint (`npm run lint`),
  `npm test`, `npx tsc --noEmit`, and `npm run build` for runtime or routing changes.
- UI changes: check desktop and 320px layouts, header actions, filters, sorting,
  selection, row menus, export, pagination, loading, errors, empty results and
  failed submissions. Report browser/backend checks you could not complete.
- Documentation-only changes: `kff check-docs`, no build.
