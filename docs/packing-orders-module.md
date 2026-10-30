# Packing Orders and Material Reservations

These modules implement the packing workflow in the
[complete system flow](system-flow.md). The frontend routes are
`/packing-orders` and `/packing-orders/reservations`; the API is
`/api/packing-orders`. They use the existing packing-order, material,
reservation, lot, inventory-balance, and append-only ledger tables.

## Setup and access

Configure an active Finished Good with a valid BOM, compatible component UOMs,
distinct active Warehouse or Packing source and destination locations, and approved, unexpired material lots
with available stock. The Packing Orders module reads configured BOM records;
the Packing Formulas editor is a separate feature.

Authenticated users can inspect orders, availability previews, and reservations.
Creating, editing, planning, starting, completing, and cancelling orders require
`canManagePacking`, enforced by the backend. Audit IDs come from the authenticated
session. The frontend exposes actions according to the same permission and the
order's current state.

## Workflow

| State | Supported actions |
| --- | --- |
| Draft | Edit metadata, plan and reserve, cancel |
| Planned | Start packing, cancel and release reservations |
| In Progress | Complete packing, cancel and release reservations |
| Completed | Inspect the immutable snapshot, material consumption, and output lot |
| Cancelled | Inspect the historical order and released reservations |

Creation validates the finished product and BOM, converts component requirements
to each component's primary UOM, and saves the resulting material requirements
with the order. Item, target quantity, and source location remain fixed so those
requirements retain their original meaning. Draft edits may correct the order
number, destination, schedule, and notes. Cancel an incorrect draft and create a
replacement when its product, source, or quantity needs to change.

The availability preview reports eligible on-hand, reserved, and available stock
per component and the maximum producible quantity from the limiting component.
The maximum respects the common output increment that keeps every component
quantity exactly representable in its primary UOM. Negative availability from
inconsistent existing reservations remains visible; such stock cannot be promised.
It is a planning aid; planning rechecks stock inside a database transaction.
Every historical order uses its saved material requirements, including when the
master BOM changes later.

Planning allocates eligible material lots by earliest expiration first, with
undated lots last and deterministic tie breaks. Only Approved, unexpired lots
at the source location can be used. Outstanding active reservations from all
orders reduce availability. A shortage fails the entire plan without leaving
partial reservations. Reservations link the order material, item, lot, location,
reserved quantity, and consumed quantity.

Starting validates the allocations again and changes the order to In Progress.
Materials remain reserved until completion. Completion accepts a positive actual
output no greater than the target and calculates consumption proportionally from
the order's own snapshot. It rejects unrepresentable quantities rather than
rounding inventory. This keeps consumption, output, and their rollback in one
transaction.

Completion atomically:

- Rechecks the order, locations, allocated lots, and protected stock.
- Deducts consumed materials and appends linked Consume ledger entries.
- Updates material and reservation consumption and releases unused allocations.
- Creates the finished-product lot linked to the packing order.
- Adds destination stock and a linked Produce ledger entry.
- Records actual output, completion time, actor, and Completed status.

The finished lot has optional manufacture and expiration dates, the product's
required QC status, and a unit cost derived from consumed lots. Unknown input
costs remain unknown. Lot numbers are unique and normalized. When both dates are
present, expiration must be later than manufacture. Repeated or stale workflow
actions fail safely and cannot duplicate inventory.

Cancellation releases outstanding reservations and closes the order without
posting stock changes. In Progress orders can be cancelled because starting
alone does not consume stock. Completed and Cancelled orders cannot transition
again. No order, reservation, lot, stock, or ledger delete endpoint is provided.

## API

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/packing-orders` | Complete order collection |
| GET | `/api/packing-orders/options` | Finished products, BOM availability, active locations |
| POST | `/api/packing-orders/preview` | Authoritative component requirements and production limit |
| GET | `/api/packing-orders/reservations` | Reservation history with order, material, lot, and location details |
| GET | `/api/packing-orders/:id` | Order, material snapshot, reservations, and output lots |
| POST | `/api/packing-orders` | Create a Draft and its material snapshot; 201 |
| PATCH | `/api/packing-orders/:id` | Edit permitted Draft metadata |
| POST | `/api/packing-orders/:id/plan` | Reserve materials and mark Planned |
| POST | `/api/packing-orders/:id/start` | Mark In Progress |
| POST | `/api/packing-orders/:id/complete` | Consume materials and produce the output lot |
| POST | `/api/packing-orders/:id/cancel` | Release allocations and mark Cancelled |

Create accepts `packingOrderNumber`, `itemId`, `targetQty`, `sourceLocationId`,
`destinationLocationId`, optional `scheduledDate`, and optional `notes`.
Preview accepts `itemId`, `sourceLocationId`, and `targetQty`. Completion accepts
`actualQty`, `lotNumber`, and optional `manufactureDate` and `expirationDate`.
Plan, start, and cancel accept an empty object. Bodies reject unknown fields,
client actors, stock changes, arbitrary material rows, and reservation edits.

Quantities use exact decimal strings compatible with `numeric(14,4)`; UOM
conversion uses exact integer arithmetic. IDs are positive PostgreSQL integers.
Responses follow the shared success/error envelope. Missing records return 404;
validation errors return 400; permission failures return 401/403; workflow and
stock conflicts return 409. Database failures use the shared safe error boundary.

## Inventory consistency and verification

Inventory-changing operations hold database locks through transaction commit.
They coordinate with inventory counts, lot QC updates, and location deactivation;
availability includes every active outstanding reservation. Ledger entries are
append-only. A failed reservation, consumption, lot creation, or production write
must roll back the complete operation.

Run backend `npm run typecheck` and `npm test`; frontend `npm run test:api`,
affected-file lint, TypeScript, and `npm run build`. Tests cover strict inputs,
permissions, exact conversions, state transitions, shortages, historical
snapshots, reservation release, and safe errors. Live PostgreSQL rollback and
concurrency verification requires an isolated `TEST_DATABASE_URL`; never fall
back to an operational `DATABASE_URL`. Browser verification requires a connected
browser runtime.
