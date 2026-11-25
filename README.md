# KFF — Kusina Filipino Food

Spice trading and packing system: buy processed spices, receive, store, reserve,
pack, transfer, deliver and report.

| Folder | What it is |
| --- | --- |
| [backend/](backend/README.md) | Express 5 + Drizzle + PostgreSQL/Supabase API (`http://localhost:3001`) + DB `.cmd` scripts |
| [frontend/](frontend/README.md) | Next.js 16 + React 19 UI (`http://localhost:3000`) |
| [docs/](docs/README.md) | Workspace specs, module contracts, and AI instructions (kept outside Git app repos) |

## Quick start (Windows)

Requires Node.js 24+ and a PostgreSQL/Supabase **test** database in `backend/.env`
(copy `backend/.env.example`). Then double-click **`kff.cmd`**, or:

```powershell
.\kff install      # npm ci in backend and frontend
.\kff test         # build + start testing backend; loads demo data into an empty DB
.\kff dev          # (alternative) backend + frontend dev servers
```

Open <http://localhost:3000/> and sign in as `demo@spice.local` / `KffDemo123!`.

### Double-click launchers

| Script | Action |
| --- | --- |
| [kff.cmd](kff.cmd) | Root menu for every command below |
| [backend/start-test-backend.cmd](backend/start-test-backend.cmd) | Builds the backend; loads samples on first start into an empty DB |
| [backend/load-sample-data.cmd](backend/load-sample-data.cmd) | Fills an empty database; never overwrites existing data |
| [backend/rebuild-test-database.cmd](backend/rebuild-test-database.cmd) | **Deletes** KFF application data and recreates the schema (asks for `REBUILD`) |
| [backend/fresh-start.cmd](backend/fresh-start.cmd) | **Deletes** KFF data, recreates an empty schema with **no sample data**, and starts the clean backend |

Launchers install missing dependencies on first run. Set `KFF_NO_PAUSE=1` for
unattended use. Details and safeguards: [docs/test-data.md](docs/test-data.md).

### Existing databases

From `backend/`: `npm run db:migrate:controls`, `npm run db:migrate:customer-planning`,
`npm run db:migrate:vat`; for an existing dedicated demo dataset, `npm run db:upgrade:demo`.
`npm run db:create-demo-user` creates the demo admin (refuses to run in production;
override with `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`).

## Customer PO workflow

Record the customer PO in Sales Orders, select finished products and open
Material plan. Use existing finished stock, purchase BOM material shortages,
receive, reserve and pack, then transfer or deliver. Labels are inventory-managed
label items selected on finished products; Brands is retired.
See [module demo guide](docs/module-demo-guide.md) and
[sales & delivery contract](docs/sales-delivery-modules.md).

## Documentation

- [Docs index](docs/README.md) — every spec, app rulebook, and module contract
- [Business rules](docs/business-rules.md) · [Complete system flow](docs/system-flow.md)
- [API & realtime contract](docs/api-contract.md) · [Repository separation guide](docs/repo-separation-guide.md)
- [UI setup and happy path](docs/ui-setup-and-happy-path.md)

## For AI agents and contributors

Start with [AGENTS.md](AGENTS.md) at the workspace root, then
[docs/backend-rules.md](docs/backend-rules.md) or [docs/frontend-rules.md](docs/frontend-rules.md).
All AI instructions, skills, and docs live at the root so `backend/` and `frontend/`
stay clean code-only Git repositories. Run `.\kff.cmd check-docs` after doc edits.
