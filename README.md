# kff
Kusina filipino food

## Testing sample data

See [test database setup and sample data](docs/test-data.md) for spice and pantry
samples, first-start loading, and these double-click Windows scripts:

- [Rebuild test database](rebuild-test-database.cmd) — deletes KFF application data and recreates the schema.
- [Load sample data](load-sample-data.cmd) — fills an empty database without overwriting existing data.
- [Start testing backend](start-test-backend.cmd) — builds the backend and loads samples on its first start.

## System documentation

- [UI data setup and step-by-step happy path](docs/ui-setup-and-happy-path.md)
- [Complete system flow](docs/system-flow.md)
- [Shared AI agent instructions](AGENTS.md)
- [Frontend AI instructions](frontend/AGENTS.md)
- [Backend AI instructions](backend/AGENTS.md)

- [Items / Products module contract](docs/items-module.md)
- [Brands and Packing Formulas module contract](docs/brands-packing-formulas-modules.md)
- [Suppliers module contract](docs/suppliers-module.md)
- [Customers module contract](docs/customers-module.md)
- [Users, Roles & Permissions module contract](docs/roles-users-module.md)
- [Purchase Orders module contract](docs/purchase-orders-module.md)
- [Receiving and Lots module contract](docs/receiving-lots-modules.md)
- [Packing Orders and Material Reservations module contract](docs/packing-orders-module.md)
- [Stock Transfers and In Transit module contract](docs/stock-transfers-module.md)

Inventory Stocks: [module contract and adjustment rules](docs/inventory-stocks-module.md).

## Sample login

With a working backend database connection, create a sample administrator:

```powershell
cd backend
npm run db:create-demo-user
```

Open <http://localhost:3000/> and use `demo@spice.local` as the username and
`KffDemo123!` as the password. The command verifies authentication before reporting
success. It preserves existing users and operational data and refuses to run in
production. Optional `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` environment variables
override these defaults; an existing account with a different password is left intact.
