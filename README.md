# KFF ? Kusina Filipino Food

## Realistic demo data

See [test database setup and realistic demo data](docs/test-data.md) for spice and pantry
demo records, first-start loading, and these double-click Windows scripts:

- [Rebuild test database](rebuild-test-database.cmd) — deletes KFF application data and recreates the schema.
- [Load demo data](load-sample-data.cmd) — fills an empty database without overwriting existing data.
- [Start testing backend](start-test-backend.cmd) — builds the backend and loads samples on its first start.

## Customer PO workflow

Record the customer PO in Sales Orders, select finished products and open Material
plan. Use existing finished stock, purchase BOM material shortages, receive,
reserve and pack, then transfer or deliver. Labels are inventory-managed label
items selected on finished products; Brands is retired.

- [Module descriptions and demo walkthroughs](docs/module-demo-guide.md)
- [Sales, customer PO planning and delivery contract](docs/sales-delivery-modules.md)

Existing databases: run `npm run db:migrate:customer-planning` from `backend/`.
For an existing dedicated demo dataset, `npm run db:upgrade:demo` updates known
old demo metadata without replacing operational records or immutable references.
See [database setup](docs/test-data.md) for exact safeguards.

## System documentation

- [Module audit and verification results (14 November 2026)](docs/module-audit-2026-11-14.md)

- [UI data setup and step-by-step happy path](docs/ui-setup-and-happy-path.md)
- [Complete system flow](docs/system-flow.md)
- [Shared AI agent instructions](AGENTS.md)
- [Frontend AI instructions](frontend/AGENTS.md)
- [Backend AI instructions](backend/AGENTS.md)

- [Items / Products module contract](docs/items-module.md)
- [Labels and Packing Formulas module contract](docs/brands-packing-formulas-modules.md)
- [Suppliers module contract](docs/suppliers-module.md)
- [Customers module contract](docs/customers-module.md)
- [Users, Roles & Permissions module contract](docs/roles-users-module.md)
- [Purchase Orders module contract](docs/purchase-orders-module.md)
- [Receiving and Lots module contract](docs/receiving-lots-modules.md)
- [Packing Orders and Material Reservations module contract](docs/packing-orders-module.md)
- [Stock Transfers and In Transit module contract](docs/stock-transfers-module.md)

Inventory Stocks: [module contract and adjustment rules](docs/inventory-stocks-module.md).
Inventory Reports: [five reports, filters, exports and sample exercises](docs/inventory-reports-module.md).

## Demo login

With a working backend database connection, create a demo administrator:

```powershell
cd backend
npm run db:create-demo-user
```

Open <http://localhost:3000/> and use `demo@spice.local` as the username and
`KffDemo123!` as the password. The command verifies authentication before reporting
success. It preserves existing users and operational data and refuses to run in
production. Optional `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` environment variables
override these defaults; an existing account with a different password is left intact.

Inventory controls and the additional operational reports are documented in
[Controls and Reports](docs/inventory-controls-and-reports.md). Existing databases
can apply the additive extension with `npm run db:migrate:controls` from `backend/`.
