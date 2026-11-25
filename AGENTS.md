# KFF Workspace — AI Agent Guide

KFF (Kusina Filipino Food) is a spice trading and packing system. `backend/` and
`frontend/` are **independent Git repositories containing application code only**;
all AI instructions, skills, and documentation live outside them at the workspace
root so none of those files are committed or pushed to either app repository.

| Folder / Files | Contents | Rules / Guide |
| --- | --- | --- |
| `backend/` | Express 5 + Drizzle + PostgreSQL/Supabase API (port 3001) + DB `.cmd` scripts | [docs/backend-rules.md](docs/backend-rules.md) |
| `frontend/` | Next.js 16 + React 19 UI (port 3000) | [docs/frontend-rules.md](docs/frontend-rules.md) |
| `docs/` | All shared specs, module contracts, and app architecture/rule guides | [docs/README.md](docs/README.md) |
| `.agents/skills/` | All KFF + external skills (tracked in `skills-lock.json`) | — |
| `kff.cmd`, `scripts/` | Root launcher menu and `check-docs.ps1` (see Commands) | — |
| `tools/`, `database-backups/` | Local binaries (`caddy`) and backup storage — do not edit | — |

There is no root `package.json`: run npm commands inside `backend/` or `frontend/`.

## Read order

Stop as soon as you have what the task needs.

1. [docs/business-rules.md](docs/business-rules.md) — shared business rules (auto-loaded by `CLAUDE.md`).
2. The guide for each app you will change: [docs/backend-rules.md](docs/backend-rules.md) and/or [docs/frontend-rules.md](docs/frontend-rules.md).
3. The task-specific document from the routing table below.
4. For business-behavior changes, the relevant section of [docs/system-flow.md](docs/system-flow.md)
   (large — search its headings instead of reading it all).

The current user request defines the scope. The system flow defines business
behavior; the app guides define implementation. Report any remaining gaps.

## Task routing

| Task | Read / use |
| --- | --- |
| Backend module, endpoint, service, migration | [docs/backend-rules.md](docs/backend-rules.md) · [docs/backend-architecture.md](docs/backend-architecture.md) · skill `kff-backend-module` |
| Frontend page, hook, table, form | [docs/frontend-rules.md](docs/frontend-rules.md) · [docs/frontend-architecture.md](docs/frontend-architecture.md) · skill `kff-frontend-module` |
| Feature touching **both** apps | skill `kff-fullstack-feature` |
| API route, DTO, permission flag, header, CORS/cookie, Socket.IO | [docs/api-contract.md](docs/api-contract.md) · skills `kff-frontend-bridge` (backend), `kff-backend-bridge` (frontend) |
| A specific module's rules | its contract, listed in [docs/README.md](docs/README.md) |
| Sales orders, customer PO planning, deliveries | [docs/sales-delivery-modules.md](docs/sales-delivery-modules.md) |
| Seed data, test accounts, DB reset | [docs/test-data.md](docs/test-data.md) |
| PostgreSQL indexing, locking, Supabase | skills `supabase-postgres-best-practices`, `supabase` |
| shadcn/Base UI, animation | skills `shadcn`, `animate-ui`, `gsap-*` |
| Pushing / deploying the two repos | [docs/repo-separation-guide.md](docs/repo-separation-guide.md) |

## Golden rules

1. **Backend is authoritative** for stock writes, availability, permissions and
   audit identity. The frontend previews and reflects; it never fakes server data.
2. **Stock changes are atomic**: append-only ledger entry + balance update in one
   PostgreSQL transaction. Corrections are new transactions.
3. **Keep AI instructions and docs outside app repos.** Never place `AGENTS.md`,
   `CLAUDE.md`, `GEMINI.md`, `.agents/`, `skills-lock.json`, or `docs/` inside
   `backend/` or `frontend/` — their `.gitignore` files also block them.
4. **Never duplicate rules.** Shared business rules live only in
   `docs/business-rules.md`; app-specific rules only in `docs/backend-rules.md`
   or `docs/frontend-rules.md`; step-by-step procedures only in `.agents/skills/`.
5. **Keep `docs/` updated on every flow change or added feature.** In the same
   task, create `docs/<module>-module.md` and index it in
   [docs/README.md](docs/README.md) for new modules, or update the affected files
   (`docs/system-flow.md` preserving all 26 sections and examples,
   `docs/business-rules.md`, `docs/api-contract.md`, module contract,
   `docs/backend-architecture.md` / `docs/frontend-architecture.md`,
   `docs/test-data.md` / `docs/module-demo-guide.md`), then run
   `.\kff.cmd check-docs`.
6. **Coordinate cross-app changes** inside the requested scope: schema, service,
   DTO, form, permission, navigation, report and `docs/` together.
7. **Test data only on test databases.** Never point a launcher at an operational database.

## Commands

Double-click `kff.cmd` for a menu, or run `kff <command>` from this folder
(the DB/test scripts themselves live in `backend/`):

| Command | Action |
| --- | --- |
| `kff install` | Install dependencies (`npm ci` on clean setup, `npm install` when `node_modules` exists) in both apps |
| `kff dev` | Start backend and frontend dev servers in two windows |
| `kff test` | Build and start the testing backend — calls `backend\start-test-backend.cmd` |
| `kff seed` | Load demo data into an empty DB — calls `backend\load-sample-data.cmd` |
| `kff rebuild` | **Delete** all KFF records and recreate the schema — calls `backend\rebuild-test-database.cmd` |
| `kff fresh-start` | **Delete** all KFF records, recreate an empty schema (no sample data), and start backend — calls `backend\fresh-start.cmd` |
| `kff demo-user` | Create the demo administrator login |
| `kff verify` | Run `check-docs`, backend typecheck/tests, and frontend tsc/lint/tests |
| `kff check-docs` | Verify Markdown links and confirm no AI/doc files live inside `backend/` or `frontend/` |

## Verification

- Code changes: `kff verify` (or each app's checks in `docs/backend-rules.md` /
  `docs/frontend-rules.md`); add `npm run build` in `frontend/` for routing/runtime changes.
- Operational features: cover transaction rollback, availability under
  concurrency, lot traceability, state transitions, authorization and
  ledger/balance consistency. Check frontend behavior **and** backend enforcement.
- Docs-only changes: `kff check-docs` must report 0 errors; review source
  fidelity. Runtime checks are not required.
