# Customers module

Customers are contact master data at `/customers`, following the customer and
fulfillment rules in the [system flow](system-flow.md). The
[Sales and Delivery API contract](sales-delivery-modules.md) describes customer
order fulfillment; invoices, payments, and customer balances remain outside its
scope. Customer master-data changes do not write inventory or change operational
transactions.

## API and permissions

All endpoints require an authenticated session. Creating, editing, deactivating,
and reactivating customers require the existing `canManageInventory` permission.
The frontend uses the same permission for management actions.

| Method | Route                | Result                                                                    |
| ------ | -------------------- | ------------------------------------------------------------------------- |
| GET    | `/api/customers`     | Complete collection, including inactive customers, ordered by name and ID |
| GET    | `/api/customers/:id` | One customer, or 404                                                      |
| POST   | `/api/customers`     | Create a customer and return 201                                          |
| PATCH  | `/api/customers/:id` | Update supplied fields and return the customer, or 404                    |

Success responses use `{ success: true, data }`. There is no hard-delete endpoint;
use `PATCH` with `{ "isActive": false }` or `{ "isActive": true }`.

Deactivation returns 409 while the customer has a Draft, Confirmed or Partially
Delivered sales order. Complete or cancel those open orders first. Historical
sales and delivery records remain linked to the customer; reactivation is supported.

## Customer fields

| Field                    | Contract                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `customerId`             | Server-generated positive PostgreSQL integer                                           |
| `name`                   | Required trimmed text, 1–120 characters                                                |
| `contactName`            | Nullable trimmed text, up to 100 characters                                            |
| `email`                  | Nullable valid email, trimmed and lowercased, up to 254 characters                     |
| `phone`                  | Nullable trimmed text, up to 40 characters                                             |
| `address`                | Nullable trimmed text; API input limit of 500 characters                               |
| `notes`                  | Nullable trimmed text; API input limit of 2,000 characters                             |
| `isActive`               | Boolean; defaults to true on creation only                                             |
| `createdBy`, `updatedBy` | Nullable user IDs in stored records; writes derive them from the authenticated session |
| `createdAt`, `updatedAt` | Server-managed timestamps, serialized as ISO timestamp strings                         |

Optional text fields accept `null`; blank strings normalize to `null`. Omitted
PATCH fields remain unchanged. Empty PATCH objects, unknown fields, IDs, and audit
fields are rejected with HTTP 400 and structured validation details. Customer
names and email addresses are not unique constraints.

## Database deployment

The authoritative [schema](../backend/src/db/schema.ts) adds a `customers` table
with the existing shared audit columns. Apply the additive
[customer migration](../backend/supabase/migrations/20261031220419_add_customers/migration.sql)
to the intended database before using the module. It creates only the new table
and its identity sequence; it does not alter existing data or tables.

The accompanying migration snapshot preserves the previous snapshot and adds
only the generated customer definition. Existing schema drift is outside this
module's migration. No database migration is applied automatically by startup.

## Verification

Backend schema and HTTP tests use fake services without a live database. They
cover normalization, null and omission semantics, limits, IDs, authentication,
authorization, audit identity, status changes, missing records, response
contracts, and safe database-error responses. Backend type checking and tests,
plus the affected frontend checks, are required when changing this contract.
