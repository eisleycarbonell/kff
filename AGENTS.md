# KFF Shared Agent Instructions

## Required reading

Read [the full system flow](docs/system-flow.md) before implementing or changing
business features in either application. It is the shared business specification
for this spice trading and packing system, including all 26 sections, examples,
formulas, routes, statuses, and operational rules supplied by the project owner.
Keep that complete document as the single source for the system flow.

Also read the guide for each application being changed:

- [Frontend instructions](frontend/AGENTS.md): Next.js pages, hooks, tables,
  forms, UI conventions, and the users reference module.
- [Backend instructions](backend/AGENTS.md): Express modules, Zod validation,
  services, database access, shared errors, and the users reference API.

The system flow defines business behavior; the application guides define its
implementation. The current user request defines which part to implement.
Apply the shared business rules to that scope and describe any remaining gaps
accurately. A documented route or workflow may still be planned rather than
implemented in the current code.

## Business rules shared by both applications

- The business buys already processed spices and packs finished products. Keep
  workflows focused on buy, receive, store, reserve, pack, transfer, track, and
  report, with the minimal complexity needed for the actual business process.
- Follow the operational sequence: supplier and purchase order, receiving into
  raw/packaging storage, packing order and material reservations, packing into
  finished-goods storage, then transfer through In Transit to a branch or store.
- Use the documented item types, compatible UOM classes, and each item's primary
  UOM for inventory quantities. Example codes, prices, dates, quantities, and
  warehouse names illustrate the flow; real operations use configured master data.
- Track stock by item, lot, and location. Warehouses, branches, stores, and
  In Transit use the same inventory model. Purchased lots trace to purchase-order
  lines; finished-product lots trace to packing orders. Lot dates remain optional
  where the document allows it, including packaging and labels.
- Treat `inventory_transactions` as an append-only ledger. Every stock change
  creates the corresponding ledger entry and updates the current balance in the
  same database transaction. Corrections use new transactions.
- Calculate availability as on-hand stock minus active reservations. Enforce
  availability across concurrent requests so separate orders cannot reserve or
  consume the same available stock.
- Require a valid BOM for packing planning. Copy material requirements into the
  packing order as a historical snapshot. Calculate maximum producible quantity
  from the limiting component. Historical orders use their own material snapshot.
- Consume reserved materials and release unused reservations according to the
  packing flow. Completing packing records consumption, creates a traceable
  finished-product lot, records production, and updates inventory atomically.
- Transfers have distinct source and destination locations. Dispatch moves stock
  into In Transit; confirmed receiving moves it to the destination. Goods remain
  part of company inventory during transit.
- Derive reports and dashboard metrics from operational records. Maintain audit
  fields using authenticated user identity. The frontend reflects role settings;
  the backend enforces authorization for protected operations.

These are the essential implementation reminders. Read the complete system-flow
document for the full requirements and the sidebar organization in section 21.

## Architecture and contracts

Map the system-flow document's general architecture to the existing repository:

```text
Next.js page/components
  -> frontend feature hook using TanStack Query
  -> Express API route with Zod request validation
  -> controller
  -> backend business service
  -> PostgreSQL transaction / Drizzle ORM
  -> PostgreSQL / Supabase
```

Complex inventory rules and authoritative stock writes belong in backend
services. Frontend calculations can preview requirements, while the backend
validates and commits each operation. The document's service names are business
responsibilities that can be implemented with the existing module functions.

Compare the business specification with the current database schema and API
before changing a feature. Coordinate required schema, service, response-type,
form, permission, navigation, and report changes within the requested scope.
Preserve existing implementation conventions unless the requested feature
requires a coordinated change.

## Verification

Follow the affected application's verification rules. For operational features,
cover transaction rollback, availability under concurrency, lot traceability,
state transitions, authorization, and ledger/balance consistency as applicable.
Check both frontend behavior and backend enforcement for changes that span them.

For documentation-only work, verify source fidelity, links, shared-document
references, and agent-file imports. Runtime checks are needed when application
code changes.
