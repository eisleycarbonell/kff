# KFF Shared Business Rules

The single, deduplicated list of business rules shared by the backend and the
frontend. App-specific guides ([backend-rules.md](backend-rules.md) and
[frontend-rules.md](frontend-rules.md)) explain **how** each app implements
these rules and must not restate them.

- Full detail, examples, formulas, routes and statuses: [system-flow.md](system-flow.md)
  (the canonical 26-section business specification). If this summary and the
  system flow disagree, the system flow wins — fix this file.
- Implemented vs planned modules: system-flow "Current Implementation Coverage".
  A documented route or workflow may still be planned rather than implemented.
- Module details: the module contracts listed in the [docs index](README.md).

## 1. Scope

- The business buys **already processed** spices and packs finished products.
  Keep workflows focused on buy, receive, store, reserve, pack, transfer, track
  and report, with the minimal complexity the real process needs.
- Example codes, prices, dates, quantities and warehouse names illustrate the
  flow; real operations use configured master data.

## 2. End-to-end sequence

```text
Customer PO (Sales Order) -> advisory Material plan
Supplier + Purchase Order -> Receiving into raw/packaging storage
  -> Packing Order + material reservations -> Packing into finished-goods storage
  -> Transfer via In Transit to branch/store   or   Delivery Order to customer
```

## 3. Customer demand and planning

- Record the customer PO on a Sales Order, select finished products and inspect
  the advisory **Material plan**: use eligible finished stock first, aggregate
  BOM requirements for the packing gap, and buy material shortages through
  supplier POs. **Planning creates no reservation.**

## 4. Master data

- Labels are `Packaging - Label` items assigned to Finished Goods through
  `labelItemId`. **Brands are retired**: retain legacy schema/data read-only.
  The published BOM determines actual label consumption, independently of the
  catalog label assignment.
- Use the documented item types, compatible UOM classes and each item's
  **primary UOM** for inventory quantities. Quantities and money are exact
  decimal strings (4 places; UOM factors 8 places) — no lossy float conversion.
- Suppliers and Items maintain one supplier-item relationship; one material may
  have multiple suppliers.

## 5. Purchasing and receiving

- The Create Purchase Order form opens with a backend-generated PO number
  (`POST /api/purchase-orders/next-number`). Users may keep it or replace it
  with a unique custom number before saving. Allocating a number creates no
  order; **saved numbers are immutable**.
- PO lines require an **active** link between the material and the selected supplier.
- Receiving creates an Approved lot linked to its PO line, a Receive ledger
  entry and the stock update, atomically. Partial receipt leaves the remaining
  quantity outstanding.
- Lot manufacture/expiry dates stay optional where allowed, including packaging and labels.

## 6. Stock, ledger and availability

- Track stock by **item + lot + location**. Warehouses, branches, stores and
  In Transit share the same inventory model. Customer contacts are separate
  from company inventory locations.
- `inventory_transactions` is an **append-only ledger**. Every stock change
  writes its ledger entry and updates the balance in the same database
  transaction. Corrections are new transactions, never edits.
- **Available = on hand − active reservations** (packing and delivery). Enforce
  availability under concurrency so separate orders cannot reserve or consume
  the same stock.
- Purchased lots trace to PO lines; finished-product lots trace to packing orders.

## 7. Packing

- Packing planning requires a valid published BOM. Copy material requirements
  into the packing order as a **historical snapshot**; historical orders always
  use their own snapshot.
- Maximum producible quantity comes from the limiting component, after other
  active reservations.
- Consume reserved materials and release unused reservations per the packing
  flow. Completion records consumption, creates a traceable Approved finished
  lot, records production and updates inventory **atomically**.

## 8. Transfers

- Source and destination must differ. Dispatch moves stock into In Transit;
  confirmed receipt moves it to the destination. Goods remain company inventory
  during transit.

## 9. Sales and delivery

- Sales confirmation does **not** reserve warehouse stock.
- Draft deliveries allocate sales demand. Dispatch checks availability and
  moves selected lots into protected In Transit inventory.
- Completed delivery posts negative `Sale` ledger entries, consumes/releases its
  reservation and updates sales fulfillment atomically.

## 10. Retired workflows

- Count Sessions, QC Decisions and Stock Dispositions are retired: preserve
  their read history and reject new requests/actions.
- Use direct **Stock Adjustments** for count corrections and **Scrap & Disposal**
  for permanent removal.
- New received/packed lots start Approved; legacy held statuses remain readable.

## 11. Permissions and audit

- Role flags: `canManageInventory`, `canManagePurchasing`, `canManagePacking`,
  `canManageTransfers`, `canManageUsers`, `canManageAccounting`.
- Sales writes require `canManageInventory`; delivery writes require
  `canManageTransfers`. Formula/Scrap review also needs `canManageUsers` and a
  different person from the creator/submitter.
- The **backend enforces** authorization; the frontend only reflects it.
- `createdBy` / `updatedBy` come from the authenticated identity, never from
  request payloads or editable form fields.

## 12. Reports and dashboards

- Derive reports and dashboard metrics from operational records. Keep
  placeholder or unavailable features distinguishable from implemented ones.

## 13. Where logic lives

```text
Next.js page/components
  -> frontend feature hook (TanStack Query)
  -> Express route + Zod request validation
  -> controller
  -> backend business service
  -> PostgreSQL transaction / Drizzle ORM -> PostgreSQL / Supabase
```

Complex inventory rules and authoritative stock writes belong in backend
services. Frontend calculations are previews; the backend validates and commits.

## 14. Adding features or changing business flows

Every added feature or flow change must add or update `docs/` in the same task:

1. For a new module, add `docs/<module>-module.md` and list it in [docs/README.md](README.md).
2. Update [system-flow.md](system-flow.md) (preserve all 26 sections and their
   original examples; extend the relevant section and mark implementation limits),
   the affected module contract, this file, and [api-contract.md](api-contract.md)
   if HTTP/realtime shapes change.
3. Update [backend-architecture.md](backend-architecture.md),
   [frontend-architecture.md](frontend-architecture.md), [test-data.md](test-data.md),
   or [module-demo-guide.md](module-demo-guide.md) when architecture, demo
   records, or operator steps change.
4. Run `.\kff.cmd check-docs` from the workspace root to verify all links and
   confirm `backend/` and `frontend/` contain no AI/doc files.
