---
name: kff-frontend-module
description: >-
  Use when building or updating KFF Next.js 16 App Router pages, feature hooks,
  Zod DTO schemas, TanStack Table v9 tables, forms, ComboboxSelect dropdowns,
  bulk CSV import dialogs, mobile-responsive layouts, or module guides.
---

# KFF Frontend Module Runbook

Step order only — the rules themselves are in
[docs/frontend-rules.md](../../../docs/frontend-rules.md) (module pattern,
layout, data rules) and [docs/frontend-architecture.md](../../../docs/frontend-architecture.md).

## Before editing

1. Read [docs/business-rules.md](../../../docs/business-rules.md), the relevant
   section of [docs/system-flow.md](../../../docs/system-flow.md), and the
   module contract under `docs/`.
2. Open the `users` reference module:
   [users/page.tsx](<../../../frontend/src/app/(protected)/(users-access)/users/page.tsx>),
   [use-users.ts](../../../frontend/src/hooks/modules/users/use-users.ts),
   [user.schema.ts](../../../frontend/src/components/modules/users/user.schema.ts), and
   `frontend/src/components/modules/users/user-{statistics,table,table-columns,table-toolbar,form}.tsx`.
3. Load companion skills when needed: `npx @tanstack/intent@latest list` from
   `frontend/` before substantial TanStack Query/Table work;
   `frontend/node_modules/next/dist/docs/` before Next.js routing, metadata or
   config changes; `shadcn`, `animate-ui`, `gsap-*`; `kff-backend-bridge` when
   the backend contract is involved.

## Steps

1. **Schema** `frontend/src/components/modules/<module>/<entity>.schema.ts` —
   DTOs matching the backend contract, create/update inputs, form validation.
2. **Hook** `frontend/src/hooks/modules/<module>/use-<module>.ts` — endpoints,
   `apiRequest`, `schema.array()` parsing, query keys, mutations,
   `createDialogStore()`, `getLoadStatus()`.
3. **Page** `frontend/src/app/(protected)/(<section>)/<route>/page.tsx` —
   `PageHeader` (+ `BulkImportActions` if importable), statistics, table, lazy
   form, dialogs.
4. **Table/toolbar/form** — `ComboboxSelect` for every dropdown; mobile-first to 320px.
5. **Navigation** — align [app-sidebar.tsx](../../../frontend/src/components/layout/app-sidebar.tsx),
   [app-breadcrumb.tsx](../../../frontend/src/components/layout/app-breadcrumb.tsx) and
   [module-guides.ts](../../../frontend/src/lib/module-guides.ts); CSV columns in
   [module-bulk-imports.ts](../../../frontend/src/lib/module-bulk-imports.ts).
6. **Tests** — mocked-fetch `frontend/tests/<entity>-api.test.mjs`.
7. **Docs** — for any added feature or flow change, add `docs/<module>-module.md`
   (and index it in [docs/README.md](../../../docs/README.md)) or update the
   affected files in `docs/`, then run `.\kff.cmd check-docs`.

## Verify (from `frontend/`)

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```
