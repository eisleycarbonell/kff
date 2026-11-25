# KFF Backend — Kusina Filipino Food

Express 5 + TypeScript (ESM) API for the KFF spice trading and packing system:
Drizzle ORM on PostgreSQL/Supabase, Zod 4 validation, cookie/JWT auth, and
Socket.IO realtime sync.

## Quick start

Requires Node.js 24+ and a PostgreSQL/Supabase database.

```bash
npm ci
cp .env.example .env        # set DATABASE_URL, CORS_ORIGIN, PORT=3001, ...
npm run dev                 # tsx watch on http://localhost:3001
```

Health check: `GET http://localhost:3001/api/health`.

## Windows test launchers (inside `backend/`)

| Script | Action |
| --- | --- |
| [start-test-backend.cmd](start-test-backend.cmd) | Builds the backend and starts the testing server (loads sample data only if the DB is empty) |
| [load-sample-data.cmd](load-sample-data.cmd) | Loads demo data into an empty test DB without overwriting existing records |
| [rebuild-test-database.cmd](rebuild-test-database.cmd) | **Deletes** KFF application data and recreates the schema (asks for `REBUILD`) |
| [fresh-start.cmd](fresh-start.cmd) | **Deletes** KFF data, recreates an empty schema with **no sample data**, optionally creates one admin, and starts the clean backend |

Pass `--help` for usage or set `KFF_NO_PAUSE=1` for non-interactive runs.
Never point a testing launcher at an operational database.

## npm scripts

Test/demo npm scripts enable test-data mode automatically — leave `KFF_ALLOW_TEST_DATA` and `KFF_SAMPLE_DATA_ON_START` unset in `.env`.

| Script | Purpose |
| --- | --- |
| `npm run dev` / `npm run dev:test` | Watch mode (`dev:test` seeds an empty DB on start) |
| `npm run build` / `npm start` / `npm run start:test` | Compile to `dist/` and start (`start:test` seeds an empty DB) |
| `npm run fresh-start` / `npm run fresh-start:dev` | Rebuild empty DB (**no sample data**), optionally create one admin, then build & start (or dev watch) |
| `npm run typecheck` · `npm test` · `npm run format` | Verification and formatting |
| `npm run db:fresh-start` | Rebuild empty DB (**no sample data**) and create one optional admin without starting server |
| `npm run db:seed` | Load demo data into an empty DB |
| `npm run db:rebuild` | **Delete** KFF data and recreate schema (test DB only; confirms interactively) |
| `npm run db:create-demo-user` | Create `demo@spice.local` / `KffDemo123!` (refuses production) |
| `npm run db:upgrade:demo` | Update known old demo metadata in an existing demo dataset |
| `npm run db:push` · `npm run db:studio` | Drizzle Kit |
| `npm run db:migrate:controls` · `db:migrate:customer-planning` · `db:migrate:vat` · `db:migrate:indexes` | Additive migrations for existing databases |
