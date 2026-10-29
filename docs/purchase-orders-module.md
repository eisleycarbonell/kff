# Purchase Orders module

Purchase Orders follows the [shared system flow](system-flow.md). The frontend
is `/purchase-orders` under Purchasing; the API is `/api/purchase-orders`. It
uses the existing `purchase_orders` and `purchase_order_lines` tables without a
schema migration. Suppliers and supplier offers are managed in the
[Suppliers module](suppliers-module.md).

## Order creation and editing

An order belongs to one supplier and contains 1 to 100 lines. Creating an order
saves its header and lines atomically with Draft status. Only a draft without
receiving history can be edited. There is no permanent-delete endpoint.

The header contains the PO number, supplier, order date, optional expected
delivery date, and optional notes. PO numbers are entered by the user, trimmed,
uppercased, limited to 30 characters, and protected by database uniqueness.
Notes are trimmed and limited to 5,000 characters; empty notes become null.

The order date is an ISO timestamp. The date form sends the selected calendar
date at UTC midnight, preserving that calendar date when it is edited again.
The expected delivery date is an optional ISO calendar date and cannot precede
the order timestamp's UTC date. Clearing an optional value sends null; omitted
PATCH fields remain unchanged.

Each line contains an item, purchase UOM, ordered quantity, and unit price.
The same item/UOM pair can appear only once in an order. Ordered quantities must
be positive; unit prices may be zero. Both use exact decimal strings matching
`numeric(14,4)`, with at most 10 whole digits and 4 decimal places.

New and edited orders require an active supplier and active raw materials,
packaging materials, or labels. Each purchase unit must belong to its item's
primary UOM class. A supplier's active item offer can prefill the purchase unit
and price, but an offer is not required to buy a catalog material. Changing a
purchase unit clears the proposed price so a price for another unit is not
silently reused. Changing the form's supplier resets its line inputs.

Draft line replacement uses writable line fields only. Clients never submit
line primary IDs, received quantities, derived amounts, statuses, or audit
fields. Referenced lines and receiving history are protected against deletion.

## Status transitions and receiving boundary

| Current state | Supported purchasing actions |
| --- | --- |
| Draft, without receipts | Edit, mark as sent, cancel |
| Sent, without receipts | View, cancel |
| Partially Received | View saved receipt progress |
| Completed | View historical order and receipt progress |
| Cancelled | View historical order |

Mark as sent records that the order was sent to the supplier; this action does
not send an email. The backend rechecks the supplier, material status, and unit
relationships before changing Draft to Sent. Only unreceived Draft or Sent
orders can be cancelled. Existing receipt quantities, lot references, or linked
inventory transactions block editing and purchasing status actions.

Received quantities, remaining quantities, and receipt progress are read from
operational data. Partially Received and Completed are controlled by receiving,
not editable status fields. The implemented [Receiving and Lots modules](receiving-lots-modules.md)
lock purchasing records, create traceable lots, append inventory-ledger entries,
update stock balances, and advance received totals and PO status atomically.

## Exact totals and history

The backend derives line totals and order totals from saved quantities and
prices. Multiplication uses integer arithmetic with 8 decimal places; no
floating-point conversion is used. Responses include total, received, and
unreceived amounts, and each line includes its received and remaining quantity.
The frontend can preview these calculations and displays server-confirmed
totals after saving. No currency is assumed and unlike UOM quantities are not
added together in summary statistics.

Saved PO quantities, purchase units, and prices belong to the order. Later
supplier-offer edits do not reprice existing orders. Sent and historical orders
retain their line records and purchase values. Purchasing operations do not
change inventory balances, lot costs, or the append-only inventory ledger.

## Transactions and access

Header and line changes run in one database transaction. Supplier row locks
coordinate new purchasing work with supplier deactivation. Existing orders are
locked and rechecked before edits or actions; changed supplier observations
produce a conflict rather than using stale relationships. Multiple supplier,
item, and UOM locks are acquired in ascending ID order within their respective
groups, with suppliers before the order, followed by item and UOM validation.

All reads require authentication. Writes require `canManagePurchasing` on the
backend; the frontend reflects that permission. Authenticated user IDs populate
audit fields. Requests use strict Zod validation and the existing success/error
envelopes; unknown fields and client audit identities are rejected. Validation
returns 400, authorization 401/403, missing records 404, and state conflicts 409.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/purchase-orders` | Complete order summary collection |
| GET | `/api/purchase-orders/options` | Actual suppliers, items, UOMs, and supplier terms |
| GET | `/api/purchase-orders/:id` | Header, saved lines, and receipt progress |
| POST | `/api/purchase-orders` | Create Draft with lines; returns 201 |
| PATCH | `/api/purchase-orders/:id` | Partial Draft update, with optional line replacement |
| POST | `/api/purchase-orders/:id/send` | Strict empty object body; Draft to Sent |
| POST | `/api/purchase-orders/:id/cancel` | Strict empty object body; unreceived order to Cancelled |

## User interface and verification

The page follows the Users module: server-data statistics, search and filters,
sorting, selection, column visibility, CSV export, and pagination. Forms and
confirmation dialogs preserve errors and input after failures and prevent
duplicate requests or dismissal during saves. Detail views expose saved order
lines and receiving progress to authenticated readers.

Backend checks cover strict schemas, exact arithmetic, state and relationship
rules, authorization, HTTP contracts, and safe failures. Frontend tests cover
requests, response validation, cancellation, form rules, and exact previews.
Run TypeScript, affected-file lint/formatting, relevant tests, and a production
build. Mocked tests do not establish live database rollback or concurrency;
verify those separately when a database test environment is available, together
with browser interactions on desktop and narrow layouts.
