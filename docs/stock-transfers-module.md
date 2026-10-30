# Stock Transfers module

This module implements `/transfers` and `/transfers/in-transit` from the shared
[system flow](system-flow.md), using the existing stock-transfer tables and the
shared item/lot/location balances and append-only ledger. No migration is needed.

## API contract

Authenticated sessions can read `/api/transfers`, `/api/transfers/options`, and
`/api/transfers/:id`. Every write requires `canManageTransfers`. All responses use
the shared success/error envelopes; creation returns 201, other operations 200.
Missing transfers return 404; invalid input returns 400; state, availability, and
quantity conflicts return 409. Server identity supplies all audit actors.

The list returns complete header DTOs with `transferId`, `transferNumber`,
`sourceLocationId`, `sourceLocationCode`, `sourceLocationName`,
`destinationLocationId`, `destinationLocationCode`, `destinationLocationName`,
`status`, `requestedAt`, nullable `dispatchedAt`/`receivedAt`, nullable `notes`,
`createdBy`, `createdAt`, `updatedBy`, `updatedAt`, `lineCount`, and nullable
`transitLocationId`. Status is Draft, In Transit, Completed, or Cancelled.
Timestamps are ISO strings; audit actor IDs are nullable on historical records.

Detail and successful writes return the header plus `lines`, each containing
`transferLineId`, `itemId`, `itemSku`, `itemName`, `lotId`, `lotNumber`,
`packingOrderId`, `primaryUomId`, `primaryUomName`, `qtyRequested`, `qtyShipped`,
`qtyReceived`, `qtyOutstanding`, nullable `expirationDate`, and `qcStatus`.
`packingOrderId` is nullable for historical data. Quantities are exact decimal
strings with four places in each item's primary UOM.

Options return `{ locations, stock }`. Active locations have `locationId`,
`code`, `name`, and `locationType` (Warehouse, Branch, Store, or In Transit).
Stock options have `itemId`, `itemSku`, `itemName`, `lotId`, `lotNumber`,
`packingOrderId`, `locationId`, `primaryUomId`, `primaryUomName`, `qtyOnHand`,
`qtyReserved`, `qtyAvailable`, nullable `expirationDate`, and `qcStatus`.
Only active finished goods with approved, unexpired lots traceable to a packing
order and positive available warehouse stock are offered.

POST `/api/transfers` creates a Draft:

```json
{
  "transferNumber": "TR-2026-0001",
  "sourceLocationId": 1,
  "destinationLocationId": 2,
  "notes": null,
  "lines": [{ "itemId": 3, "lotId": 4, "qtyRequested": "200.0000" }]
}
```

PATCH `/api/transfers/:id` accepts any supplied subset of these fields, rejects
an empty update, and is Draft-only. Supplied lines replace the entire Draft line
collection; there must be 1–100 unique lots. Source must be a Warehouse;
destination must be a different Warehouse, Branch, or Store. Notes are nullable
and limited to 5,000 characters; transfer numbers normalize to uppercase and
have at most 30 characters. Draft creation and editing require selected lots
to be approved, unexpired finished goods with packing-order provenance and
positive on-hand stock at the source. Drafts do not reserve inventory; requested
quantities may exceed current availability, which dispatch checks again.

POST `/api/transfers/:id/dispatch` accepts:

```json
{
  "transitLocationId": 5,
  "lines": [{ "transferLineId": 6, "qtyShipped": "200.0000" }]
}
```

Dispatch includes every transfer line exactly once with a positive shipped
quantity no greater than requested. It runs once from Draft and changes status
to In Transit. Each line posts a negative source and positive In Transit ledger
entry and updates the same lot's balances atomically. Availability is rechecked
under locks as on-hand minus active outstanding reservations.

POST `/api/transfers/:id/receive` accepts:

```json
{ "lines": [{ "transferLineId": 6, "qtyReceived": "100.0000" }] }
```

Receipt quantities are increments for this confirmation, not cumulative totals.
One or more unique lines may be received partially, up to each line's shipped
outstanding quantity. Each posts negative In Transit and positive destination
ledger entries. The original transit location is recovered from the dispatch
ledger; a receipt cannot substitute a different location or use another
transfer's entitlement. Status remains In Transit until all shipped quantities
are received, then becomes Completed with `receivedAt` set.

POST `/api/transfers/:id/cancel` accepts `{}` and cancels Drafts only. Dispatched
transfers cannot be cancelled or edited. Repeated dispatch or completed receipt
is rejected. Receipt requests should not be retried blindly after an uncertain
network result; reload the transfer's confirmed outstanding quantities first.

## Transaction safety

Stock-changing operations and Draft edits lock the existing transfer header,
then its lines in ascending line-ID order. They next lock items and lots in
ascending ID order, active locations in ascending ID order, balances by lot and
location, then reservations in ascending reservation-ID order. Draft creation
validates and locks the same inventory context before inserting its header and
lines; cancellation locks only the existing header. This shares the parent-lot
locks used by packing and stock counts.

Ledger pairs, balances, line quantities, status, timestamps, and audits commit
or roll back together. Dispatch and receipt protect active outstanding
reservations and reject destination balance overflow. Receipt still works when
a shipped lot subsequently expires or changes QC status, or its item becomes
inactive; its physical movement and traceability must be recorded.

No ledger records are edited or removed. Branch/store inventory uses the same
tables as warehouse inventory. The dispatch ledger preserves transit identity
without adding a redundant header column.

## Verification

Run backend `npm run typecheck` and `npm test`, plus frontend API tests,
affected-file lint, type checking, and a production build. HTTP tests use fake
services. The [PostgreSQL integration suite](../backend/tests/transfer-integration.test.ts)
checks concurrent dispatch, reservation races, rollback, lot provenance,
multi-line partial receipts, and balance/ledger conservation with real locks.

To run that suite, set `TEST_DATABASE_URL` to a dedicated PostgreSQL test
database, then run this command from `backend/`:

```text
node --experimental-strip-types --test tests/transfer-integration.test.ts
```

The suite creates and removes its own random schema and skips when
`TEST_DATABASE_URL` is absent. It never falls back to the application's database
URL. Browser checks cover desktop/narrow layouts, filters, tables, forms, and
partial receipts.
