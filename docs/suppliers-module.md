# Suppliers module

Suppliers follows the [shared system flow](system-flow.md). The page is
`/suppliers` under Master Data; its API is `/api/suppliers`. The existing
`suppliers` and `supplier_items` tables support this module without a migration.

## Supplier records

Supplier records contain a required name (up to 100 characters), an optional
email (up to 100 characters), and active status. Names are trimmed; emails are
trimmed and lowercased, and clearing an email sends null. Database uniqueness
protects supplier names. No phone, address, or other unimplemented database
fields are presented as writable fields.

The list includes active and inactive suppliers, actual item-offer counts, and
whether a supplier has open purchase orders. Users can search, filter, sort,
select rows, control columns, export filtered or selected CSV rows, and paginate.
Statistics are derived from the loaded supplier records.

There is no permanent-delete operation. Deactivation preserves purchasing and
item relationships. Suppliers with Draft, Sent, or Partially Received purchase
orders cannot be deactivated. A successful deactivation also disables their item
offers and clears their preferred flags in the same database transaction.
Reactivating a supplier does not automatically reactivate its offers.

## Supplier item offers

An item can have multiple suppliers, with one offer per supplier/item pair. An
offer stores the supplier's item code, default purchase UOM, default price,
non-negative lead time in days, preferred flag, and active status.

- Prices remain exact decimal strings matching `numeric(14,4)`: up to 10 whole
  digits and 4 decimal places. A null price is unspecified; zero is a real price.
  No currency is assumed.
- A null default UOM means the item's primary UOM. An explicit default UOM must
  belong to the same UOM class as the item's primary unit. Price is per that unit.
- New offers require an active supplier and an active raw material,
  packaging material, or label. Finished goods are produced through packing.
- The linked item cannot change after creating an offer. Edit its quote details
  or deactivate it instead. Existing inactive offers remain visible.
- Only one active preferred supplier is allowed per item. A conflicting change
  returns 409; it does not silently replace another supplier's preference.
- Deactivating an offer clears its preferred flag. An inactive offer cannot be
  explicitly made preferred. Reactivating an offer revalidates the supplier,
  item, and UOM relationships.

Writes lock the supplier and relevant item, validate UOMs under held locks, and
commit related changes together. Existing unique indexes protect supplier/item
pairs and active preferred suppliers under concurrent requests. Quote changes
do not modify inventory quantities, historical purchase prices, or the ledger.
[Purchase Orders](purchase-orders-module.md) validates active suppliers under a
held supplier row lock when creating, editing, or marking an order as sent.
This coordinates purchasing work with supplier deactivation. Purchase-order
workflows use their own module.

## Access and API

All reads require an authenticated session. Creating, editing, activating, and
deactivating suppliers or offers require `canManagePurchasing` on the backend.
The frontend reflects the same permission. Audit identities come from the
authenticated user; clients cannot submit IDs or audit fields as writable data.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/suppliers` | Complete supplier collection and operational counts |
| POST | `/api/suppliers` | Create supplier; returns 201 |
| GET | `/api/suppliers/options` | Actual item and compatible-unit lookup data |
| GET | `/api/suppliers/:id` | Supplier or 404 |
| PATCH | `/api/suppliers/:id` | Partial profile/status update |
| GET | `/api/suppliers/:id/items` | All offers, including inactive records |
| POST | `/api/suppliers/:id/items` | Create offer; returns 201 |
| PATCH | `/api/suppliers/:id/items/:supplierItemId` | Partial quote/status update |

Requests use strict Zod schemas and shared success/error envelopes. PATCH
preserves omitted, null, false, and zero values and rejects empty updates.
Validation returns 400, authentication/authorization 401/403, missing resources
404, and conflicts 409. Driver details and private query data are not exposed.

## Verification

Run backend TypeScript, tests, and affected-file formatting checks. Frontend
checks include request tests, affected-file lint, TypeScript, and a production
build. HTTP tests use fake services and request tests use mocked fetch; they do
not modify the configured database. Verify real persistence and concurrency
separately when a database test environment is available, and inspect desktop
and narrow layouts, form errors, permissions, export, and status transitions.
