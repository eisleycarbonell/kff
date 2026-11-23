# Module audit: trading, inventory and packing

Reviewed 14 November 2026 against all 26 sections of the
[canonical system flow](system-flow.md) and its module contracts. This is a
repository and executable API/database audit. It is not a browser acceptance
sign-off or an assessment against an external regulatory standard.

## Result

The documented buy, receive, store, reserve, pack, transfer and customer-delivery
flow passed the automated checks below after the confirmed defects were fixed.
All 31 active sidebar modules were reviewed. The application database was not
reset or used for destructive tests. Native tests used a separate local
PostgreSQL 18 instance and random schemas, which were removed after each test.

### Confirmed defects corrected

| Area | Previous behavior | Corrected behavior and evidence |
| --- | --- | --- |
| Locations | Correlated usage/activity checks could compare an inner location ID with itself. Stock or open work elsewhere could incorrectly block an empty location. | Outer IDs remain explicitly qualified. Empty locations deactivate; occupied locations and locations with open work remain protected. See [service](../backend/src/modules/locations/location.service.ts) and [native lifecycle checks](../backend/tests/uom-location-integration.test.ts). |
| Units of Measure | Class counts and base-unit names could include units from other classes, blocking valid empty-class deletion. | Counts/base names belong to the selected class. Concurrent base creation, class anchors and referenced conversions remain protected. See [service](../backend/src/modules/uoms/uom.service.ts), [SQL regression checks](../backend/tests/uom-location-correlation.test.ts) and the native lifecycle suite. |
| Reason Codes | Concurrent requests could both pass the case-insensitive duplicate check with different capitalization. | The duplicate check and write share a transaction-scoped lock for the normalized name. One spelling wins and the other receives 409. See [service](../backend/src/modules/reason-codes/reason-code.service.ts) and [native regression](../backend/tests/customer-material-plan-integration.test.ts). |
| Operational screens | Stock/master-data changes could leave packing previews, customer material plans and lot-selection options cached. Receipt history changes could leave movement views stale. | Related availability/eligibility queries are invalidated after committed changes; affected stock, report, receipt and movement views refresh. Reviewed-request details are scoped to the signed-in user. See [shared refresh helper](../frontend/src/lib/inventory-query-cache.ts) and [cache regression checks](../frontend/tests/inventory-cache.test.mjs). |
| Dashboard amounts | Converting aggregate decimal strings to floating-point numbers could lose monetary precision. Malformed decimal DTOs could enter metrics. | Currency strings round with exact integer arithmetic; malformed decimal metrics are rejected. See [dashboard schema/formatting](../frontend/src/components/modules/dashboard/dashboard.schema.ts) and [tests](../frontend/tests/dashboard-api.test.mjs). |
| Test fixtures | Some minimal native fixtures omitted the newer label/customer-PO columns, preventing meaningful execution. | Fixtures match the selected current fields; the full pre-existing native suite executes without skips. |

These fixes require application code updates, not a database reset or a new
business-schema migration.

## Module coverage

"Verified" below describes source review plus the stated automated API,
request/response or database checks. Browser layout, keyboard interaction and
visual state transitions were not observed because no browser was available.

| Active module | Verified behavior / evidence |
| --- | --- |
| Dashboard | Operational summaries, primary-UOM grouping, low-stock eligibility, open-status scope, exact monetary display and frontend response validation. |
| Inventory Stock | Item/lot/location balances, outstanding packing/delivery reservations, available quantities and frontend response validation. |
| Lots / Batches | Purchased/packed provenance, location balances, optional dates, reservation-protected metadata and frontend response validation. |
| Stock Movements | Read-only append-only ledger queries and source references; reporting reads append no transactions. |
| Stock Adjustments | Count differences, expected-balance conflicts, concurrent counts, reservation floor, and complete rollback after a failed ledger append. |
| Scrap & Disposal | Independent review, expected source snapshots, reservation/transit protection, concurrent approval and atomic removal. |
| Purchase Orders | Supplier-linked materials, generated/custom unique numbers, saved-number protection, send/cancel states and concurrent numbering. |
| Receiving | Incremental partial arrivals, exact purchase-to-primary conversion, Approved lots, PO progress, provenance and atomic ledger/balance writes. |
| Packing Orders | BOM snapshots, limiting materials, reservation allocation, start without consumption, completion, cancellation, concurrency and rollback. |
| Material Reservations | Per-order/lot/source ownership, available-stock protection, actual consumption and unused release. |
| Stock Transfers | Distinct company locations, source-to-transit dispatch, partial receiving, original transit entitlement, rollback and company-stock conservation. |
| Sales Orders | Customer PO references, active finished products, exact totals, confirmation without physical reservation and delivery-based fulfillment. |
| Delivery Orders | Sales-demand allocation, source availability, protected In Transit stock, complete Sale posting, partial sales fulfillment and repeated-action rejection. |
| Items / Products | Item types, primary UOM/reference protection, supplier links and active label-material assignments. Labels are consumed according to the released BOM. |
| Packing Formulas | Published formula inspection and frontend DTOs; unsupported direct writes redirect operators to revision release through API conflicts. |
| Formula Revisions | Independent effective-date release, item-specific conversions, retirement and preservation of historical packing snapshots. |
| Item Packaging | Item-specific conversion ratios, compatible units and immutable referenced ratios. |
| Reorder Levels | Saved primary-UOM thresholds and their use by low-stock reporting, including never-stocked items. |
| Reason Codes | Active category checks, referenced-category protection and concurrent case-insensitive name uniqueness. |
| Suppliers | Shared item links, supplier-specific counts, PO eligibility and historical agreements. |
| Customers | Contact records separated from company locations; active-customer and open-sales protections. |
| Locations | Correct per-location reference/activity checks, safe deactivation and active-location locking by inventory writers. |
| Units of Measure | Compatible classes/factors, per-class counts/base labels, one base per class and reference/anchor protection. |
| Inventory Reports | Five report calculations, eligible low-stock supply, reservations, exact per-UOM totals, dates/filters and frontend DTOs. |
| Packing Report | Output/consumption/variance based on saved requirements and movements. |
| Purchasing Report | Ordered, received and outstanding quantities/value, including partial receipt. |
| Transfer Report | Shipped, received and outstanding transit quantities, including partial receipt. |
| Lot Genealogy | Purchased origins, packing consumption/output and onward transfer/delivery references. |
| Users | Authenticated administration, public DTO privacy, role assignments and last-manager protection. |
| Roles & Permissions | Existing five flags, backend write enforcement, role usage and retained management access under concurrency. |
| Company Settings | Authenticated settings DTOs, optimistic version checks, fixed currency after pricing history and alert defaults. |

Brands, Count Sessions, QC Decisions and Stock Dispositions are retired. Their
retained history/legacy redirects do not represent active operational modules.
Retired control requests reject new actions; Brands has no mounted active API.

## Executed verification

- Full pre-existing backend suite: **281 passed, 0 failed, 0 skipped**, with
  `TEST_DATABASE_URL` pointing to the separate local test database. This includes
  PostgreSQL purchasing, packing, transfer, sales/delivery, roles, formula,
  controls, reports and seed/reset tests.
- New UOM/location SQL and native lifecycle regressions: **9 passed**, including
  stock-count concurrency, rollback and reservation protection.
- New material-planning/reason-code and complete system-flow tests: **7 passed**.
- Updated frontend suite: **253 passed, 0 failed, 0 skipped**.
- Backend TypeScript and production build passed. Frontend TypeScript and
  production build passed, including all 41 generated pages/legacy routes.
- Affected frontend source lint and backend formatting checks passed.
- Read-only checks against the configured demo database passed: 93 ledger
  entries retained, zero ledger/balance mismatches, eight valid finished-product
  label links and no legacy sample SKUs. All five sales material plans loaded;
  the large prepared Draft correctly reports purchasing shortages.

The [complete flow integration test](../backend/tests/system-flow-integration.test.ts)
starts the real Express app against an isolated schema. It validates 40 module
read endpoints with the actual frontend Zod DTOs before and after operations,
checks unauthenticated access and prohibited Viewer writes, and executes:

1. Create raw spice, pouch, printed label, seal, finished product, supplier
   links, warehouse/branch locations and a customer.
2. Prepare, submit and independently release the four-component formula.
3. Record a customer PO for 500 finished packs and verify 50 kg raw plus
   500 pieces each of pouch, label and seal are required.
4. Create/send supplier POs; receive raw material in 30 kg and 20 kg arrivals,
   and receive packaging. Verify partial/completed purchasing states.
5. Refresh planning; reserve/start/complete 500 packs, with no consumption at
   start and a traceable finished lot at completion.
6. Dispatch 200 finished pieces to a branch and receive them in 120/80 steps.
7. Complete customer deliveries of 150, 300 and 50 pieces from branch/warehouse
   locations. Verify protected transit, repeated-completion rejection and
   Partially Delivered -> Completed sales fulfillment.
8. Reconcile all stock against the ledger. The isolated journey has **26**
   corresponding ledger rows, no finished stock remaining and no balance
   mismatches. Subsequent reports/inspection add no movements.

The [planning test](../backend/tests/customer-material-plan-integration.test.ts)
also checks aggregate shared materials, multiple supply lots, outstanding
reservations, held stock exclusion, missing/inactive formulas/components,
cancelled demand and unchanged ledger/stock/reservation fingerprints.

To repeat native tests, configure an explicitly dedicated `TEST_DATABASE_URL`
and run `npm test` in `backend/`. The cross-application flow test also requires
installed frontend dependencies for DTO validation. Run `npm test` and
`npm run build` in `frontend/`. Never substitute a business database for the
dedicated test target.

## Scope and remaining verification

The current flow buys processed ingredients/packing materials and sells packed
Finished Goods. Direct raw-material resale, invoices/payments/accounting,
customer returns, dispatched-delivery reversal, and partial receipt within one
customer delivery remain outside the documented implementation. Customer
planning is advisory for one order and does not automatically create purchasing
or packing orders. Held-location stock has no new release workflow.

No interactive browser was available. Desktop/narrow layout, keyboard navigation,
dialogs, CSV downloads and live button interactions still need browser acceptance
checks. These limits do not invalidate the executed API/database results, but
they prevent claiming every user interaction has been manually verified.

Use the [module demo guide](module-demo-guide.md) for operator demonstrations and
the [UI happy path](ui-setup-and-happy-path.md) for the original numerical example.
