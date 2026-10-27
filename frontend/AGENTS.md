<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `npx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Project Rules - KFF Frontend

These rules apply to `frontend/`. Run frontend commands from that directory.
Source-folder shorthand such as `app/`, `components/`, and `hooks/` refers to
folders under `frontend/src/`; reference links are relative to `frontend/`.
If repository-root skill discovery finds no packages, repeat the skill check
from `frontend/` so its installed dependencies are discovered.

## Reference implementation

Use the current users module as the reference for the architecture, layout, and
interactions of new modules and module refactors. Read the relevant files below
before implementing a module. Adapt fields, endpoints, actions, and statistics
to the feature and its backend contract. Create only the files the feature needs.
The other modules' placeholder pages are not complete implementation examples.

| Concern | Reference file |
| --- | --- |
| Page composition, header action, loading, and dialogs | [users/page.tsx](src/app/(protected)/users/page.tsx) |
| Requests, query cache, mutations, notifications, and feature state | [use-users.ts](src/hooks/modules/users/use-users.ts) |
| Public DTOs, writable inputs, form values, and validation | [user.schema.ts](src/components/modules/users/user.schema.ts) |
| Statistics calculated from page data | [user-statistics.tsx](src/components/modules/users/user-statistics.tsx) |
| Table state, rendering, empty states, and pagination | [user-table.tsx](src/components/modules/users/user-table.tsx) |
| Columns, table features, selection, and row actions | [user-table-columns.tsx](src/components/modules/users/user-table-columns.tsx) |
| Unified search, filters, bulk actions, export, and column controls | [user-table-toolbar.tsx](src/components/modules/users/user-table-toolbar.tsx) |
| Create/edit form, field errors, and async submission | [user-form.tsx](src/components/modules/users/user-form.tsx) |

## Tech stack

- **Framework**: Next.js App Router with TypeScript and React 19.
- **Server data**: TanStack Query through the existing `QueryProvider` in the root layout.
- **Tables**: the installed TanStack Table v9 API: `useTable`, `tableFeatures`, `createColumnHelper`, and `table.FlexRender`, following the users table. Check installed APIs before using examples from another version.
- **Styling**: Tailwind CSS v4.
- **UI**: shadcn/ui (`base-nova`, Base UI). Follow the existing `render` prop and controlled-value APIs. Use existing shadcn primitives first; add missing components with `npx shadcn@latest add <component> --yes`.
- **Validation**: Zod for runtime DTO parsing, with pure form validation in the feature schema.
- **Animation and icons**: GSAP with `@gsap/react`; `lucide-react`.

## Module structure

The users module demonstrates the pattern:

```text
frontend/
  src/
    app/
      layout.tsx                     # Existing shared QueryProvider
      (protected)/
        layout.tsx                   # Shared authenticated app shell
        users/
          page.tsx                   # Direct page composition
    components/
      modules/
        users/
          user-statistics.tsx        # Statistics from data passed by the page
          user-table.tsx             # Table rendering and table view state
          user-table-columns.tsx     # Column definitions, table features and types
          user-table-toolbar.tsx     # Filters, selection actions and CSV helper
          user-form.tsx              # Form fields and validation feedback
          user.schema.ts             # Public DTOs, input types and pure validation
    hooks/
      modules/
        users/
          use-users.ts               # Endpoints, requests, TanStack Query and feature state
    providers/
      query-provider.tsx             # Shared query client; reuse across modules
  tests/
    user-api.test.mjs                 # Mocked request and response tests
```

Use `components/modules/<module>/` for feature components and schemas, and
`hooks/modules/<module>/use-<module>.ts` for the feature hook. Use the collection
name consistently, for example `users/use-users.ts` or `items/use-items.ts`.
Use the singular entity name for files such as `item.schema.ts` and
`item-table.tsx`. Columns and toolbar files are useful when their code is
substantial; do not create empty files to match this tree.

## Responsibilities

1. **The page composes the module directly.** Call the feature hook once and pass
   its data to statistics and table components as siblings. Wire the form,
   confirmation dialogs, loading, and retry controls in `page.tsx`. Use
   `"use client"` when hooks or event handlers are needed. Keep fetching and
   mutation logic in the hook. Do not add a `Users`-style wrapper solely to
   connect these pieces.

2. **The feature hook owns requests and state.** Put endpoint constants, fetch
   functions, response parsing, query keys, `useQuery`, `useMutation`, CRUD
   handlers, modal state, and success/error notifications together, as in
   `use-users.ts`. Do not introduce separate `*.api.ts`, service, or repository
   files by default.

3. **The schema owns types and validation.** Define public response DTOs, separate
   create/update inputs, form values, and pure validation/helpers in
   `<entity>.schema.ts`. Match backend field names and nullability. Keep
   server-managed record IDs, audit fields, and private fields out of form
   payloads; allow required foreign-key IDs.
   For users, password hashing stays on the backend and password hashes never
   enter public DTOs or the query cache.

4. **Statistics and tables receive data through props.** They share the page's
   query result rather than fetching the same records independently. Statistics
   own their calculations and cards. The table owns sorting, filtering,
   pagination, column visibility, and row selection.

5. **Columns and controls stay with the table.** Keep feature configuration and
   column helpers at module scope, and memoize columns using stable action
   callbacks. Use type-only imports for table instance types. Keep pagination in
   the table and a single-use CSV helper in its toolbar.

6. **Forms receive values and async actions through props.** Validate and
   normalize form input, await saves, and close only after success. Preserve
   input and display errors after failure. Lazy-load forms from the client page;
   keep a requested form mounted after first use so closing and focus handling
   can complete.

## Page layout and visual rules

- Use `components/shared/page-header.tsx` for the title and short description.
  Put the primary create action, such as "Add item", in its `actions` prop,
  beside the title on desktop. Keep the empty table's create shortcut where
  useful.
- Place meaningful statistics below the header, followed by the table. Follow
  the current statistics cards' spacing, large values, and simple green icons.
  Choose useful metrics for the feature; the number of cards can vary.
- Keep search, filters, reset, selection actions, CSV export, and column
  visibility controls in one toolbar above the table header. Use the existing
  responsive wrapping and consistent `h-10` control heights; select triggers
  use `data-[size=default]:h-10` to override their default height.
- Keep row actions in the row menu and pagination in the table footer. Give
  icon-only controls accessible labels and sortable headers an `aria-sort` state.
- Use readable primary text and the shared `text-muted-foreground` token for
  secondary text. Show optional row details only when a value exists, as with
  the users table's mobile number. Reserve explicit empty-state wording for
  meaningful states, such as "Never signed in".
- Follow the existing `bg-card`, rounded border, muted table header, row hover,
  and selected-row styles. The protected layout supplies the subtle page
  background and spacing; reuse it without adding another page shell.
- Reuse `app/globals.css` theme tokens for color and contrast. Reuse the active
  navigation styling in `components/layout/nav-main.tsx`, including the green
  background, left indicator, and `aria-current="page"`. Keep sidebar links in
  `components/layout/app-sidebar.tsx` and breadcrumb labels in
  `components/layout/app-breadcrumb.tsx` aligned when adding routes.
- Preserve keyboard focus, labeled form fields, status text alongside color,
  responsive toolbar wrapping, and horizontal table scrolling on small screens.

## Data and interaction rules

- Reuse the existing root `QueryProvider`; do not create a query client or
  provider for each module.
- Configure API prefixes with `NEXT_PUBLIC_API_BASE_URL`. Define resource paths
  in the feature hook, following the backend contract rather than hardcoding
  URLs in components.
- Follow the existing `{ success: true, data }` and
  `{ success: false, error: { message } }` response envelopes. Support HTTP 204
  for deletes. Throw readable errors for HTTP, network, JSON, and invalid DTO
  failures before malformed data reaches components.
- Pass the query's `AbortSignal` to fetch and preserve cancellation errors.
- Use stable resource query keys. Update cached data from successful responses
  and invalidate the affected query after mutations.
- Keep cached rows visible when a background refetch fails. Distinguish initial
  loading, query errors, and mutation errors.
- Disable duplicate submissions and dialog dismissal while a mutation is
  pending. Await server confirmation before showing success.
- For bulk actions, account for partial success: update successful rows and
  retain failed items for retry.
- Reset pagination and row selection when filters change. Export selected
  filtered rows when present, otherwise all filtered rows. Preserve proper CSV
  quoting, formula escaping, and nullable-field handling.
- Use stable record IDs for table rows. The users reference filters, sorts, and
  paginates a complete API result in the browser. If a module uses server
  pagination, adapt the query and table together; statistics, counts, selection,
  and exports must describe their actual data scope.
- Use the actual backend schema for each module. Do not copy user-specific
  roles, passwords, or statistics into unrelated features. Document assumed
  endpoints when backend handlers are not yet available.
- Do not add demo data, client-generated database IDs, or localStorage fallbacks
  unless the user requests them.

## Keep the implementation simple

- Inline small, single-use loading, feedback, and confirmation markup in the
  page. Extract components for clear responsibilities, not for every JSX block.
- Do not add feature wrappers, extra providers, barrel files, or generic
  abstractions solely to connect existing pieces.
- For simple metadata on a client page, use React 19 `<title>` and `<meta>`
  tags directly as the users page does. Do not export Next.js `metadata` from
  a client component or add a layout solely for title/description. Existing
  server pages can keep their metadata exports; avoid duplicate head tags.
- Use route layouts for shared UI, providers, or actual layout behavior.

## Repository conventions

- Authenticated routes belong under `app/(protected)/`; public routes belong
  directly under `app/`.
- `components/ui/` is generated shadcn code. Do not place custom components
  there or edit primitives except for necessary type or dark-mode fixes.
- `components/layout/` owns the shared app shell.
- `components/shared/` is for feature-independent reusable UI. Promote code
  there, to `lib/`, or to `types/` only when multiple features actually share it.
- Features must not import another feature's internal components, schemas, or
  hooks. Read the users files as examples and implement the new module with its
  own types and behavior; share only feature-independent components or helpers.
- Use kebab-case filenames, PascalCase component exports, and `@/` imports.
  Keep established suffixes such as `user.schema.ts`.

## Verification

- For request changes, use mocked fetch tests like `tests/user-api.test.mjs`
  to check URLs, payloads, responses, errors, nullability, and cancellation.
  Test the request exports in the feature hook; do not add an API layer just
  to make tests import it.
- Run checks appropriate to the change: affected-file lint, relevant tests,
  TypeScript, and a production build for runtime or routing changes.
  Documentation-only changes need a consistency review, not an application build.
- For UI changes, check desktop and narrow layouts, header actions, filters,
  sorting, selection, row menus, export, and pagination when available. Check
  loading, errors, empty results, and failed submissions. Report any browser or
  backend verification that could not be completed.
