# Receiving and Lots modules

Receiving and Lots implement the purchasing-to-inventory handoff described in
the [complete system flow](system-flow.md). The frontend routes are `/receiving`
and `/lots`; the APIs are `/api/receiving` and `/api/lots`. They use the existing
purchase order, lot, stock-balance, reservation, and inventory-ledger tables.

## Receiving purchase orders

Authenticated users can view receiving history and eligible purchase orders.
Posting a receipt requires the Inventory Management permission. Only `Sent` or
`Partially Received` purchase orders can be received, and every submitted line
must still belong to the selected order. A batch contains 1 to 100 new lots and
may split one purchase-order line across several lots.

Each entry records a positive purchase-UOM quantity, the line's previously
observed received quantity, a unique internal lot number, an optional supplier
lot number, an active Warehouse or Quarantine destination, and optional
manufacture and expiration dates. Internal lot numbers are trimmed, uppercased,
and globally unique. When both dates are supplied, expiration must be later than
manufacture. Dates remain optional for raw materials, packaging, and labels.

The expected received quantity is an optimistic-concurrency guard. If another
receipt changed the line after the form loaded, the whole batch fails and the
user must refresh the order balances. The backend also aggregates split entries
before checking the outstanding quantity, so a batch cannot over-receive a
line. Repeating the same request cannot silently duplicate stock because the
stale quantity and unique lot number checks reject it.

Purchase quantities are converted to each item's primary UOM using exact integer
decimal arithmetic. A quantity that cannot be represented exactly with four
decimal places, converts to zero, or exceeds `numeric(14,4)` is rejected rather
than rounded. The lot cost per primary UOM is derived from the saved PO unit
price and conversion factors, rounded half-up to four decimal places.

Items requiring QC create Quarantine lots; other items create Approved lots.
The service creates every lot, its stock balance, and a positive `Receive`
inventory transaction linked to the PO line. It then advances the PO-line
received quantities and sets the order to `Partially Received` or `Completed`.
All of those writes occur in one PostgreSQL transaction under deterministic
locks. Any error rolls back the complete batch, and ledger rows are never
updated or deleted as corrections.

### Receiving endpoints

- `GET /api/receiving` lists receipt-ledger history with PO, supplier, item,
  UOM, location, lot, cost, QC, actor, and timestamp details.
- `GET /api/receiving/options` lists outstanding sent orders and Warehouse or
  Quarantine locations for the receiving form.
- `POST /api/receiving` atomically posts a receipt batch.

Historical receipt quantities are shown in their purchase UOM when the inverse
conversion is exact. Imported history that cannot be represented exactly leaves
that display quantity null; the authoritative primary-UOM ledger quantity is
still shown.

## Lot traceability

Authenticated users can search and inspect all purchased, packed, and opening-
balance lots. The list derives on-hand, actively reserved, and available
quantities from current stock and reservation records. The detail view shows
balances by location plus the append-only transaction history and source links.

Lot source is reported as `Purchased`, `Packed`, or `Opening Balance`. Internal
lot number, item, calculated unit cost, and PO or packing provenance are
immutable. There is no manual lot-create, delete, stock-edit, or ledger-edit
endpoint.

Users with the Inventory Management permission may correct the supplier lot
reference and update optional manufacture date, optional expiration date, or QC
status (`Quarantine`, `Approved`, `Rejected`, or `Expired`). The backend merges
partial updates before validating the date relationship. While a lot has an
active outstanding reservation, date and QC changes are blocked so planning
assumptions cannot change underneath a packing order; supplier-reference
corrections remain allowed. These metadata edits never change stock or append a
stock transaction.

### Lots endpoints

- `GET /api/lots` lists lot balances, source, cost, QC, and audit metadata.
- `GET /api/lots/:id` adds location balances and ledger history.
- `PATCH /api/lots/:id` updates only the permitted metadata fields.

## Verification

Backend schema/rule and HTTP tests cover authentication, permissions, strict
payloads, exact conversion arithmetic, stale balances, over-receiving, status
transitions, date rules, reservation guards, and safe failures. Frontend tests
cover response validation and request construction. Type checks, linting, and a
production build verify the combined applications.

Transaction rollback and concurrent receipt behavior should additionally be run
against an isolated PostgreSQL test database by setting `TEST_DATABASE_URL`.
Tests must never fall back to an operational `DATABASE_URL`. Browser interaction
checks require a connected browser session and a database reachable by the local
backend.
