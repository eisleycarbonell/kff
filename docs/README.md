# KFF Documentation Index

`docs/` (this folder) is the **single source of truth** for all KFF
documentation and AI rules. It lives outside `backend/` and `frontend/` so
documentation and AI instructions are never pushed to either application Git
repository.

Run `.\kff.cmd check-docs` from the workspace root after documentation edits to
verify all links and confirm no AI/doc files were placed inside `backend/` or `frontend/`.

## Start here

| Read when | Document |
| --- | --- |
| Always, before any business change | [business-rules.md](business-rules.md) — compact shared rules |
| Working on `backend/` | [backend-rules.md](backend-rules.md) & [backend-architecture.md](backend-architecture.md) |
| Working on `frontend/` | [frontend-rules.md](frontend-rules.md) & [frontend-architecture.md](frontend-architecture.md) |
| Changing business behavior (search the relevant section; ~70 KB) | [system-flow.md](system-flow.md) — canonical 26-section specification |
| Changing an endpoint, DTO, permission, header, CORS/cookie or Socket.IO event | [api-contract.md](api-contract.md) — REST + realtime contract |
| Seeding, resetting or demo logins | [test-data.md](test-data.md) |
| Learning the operator flow | [module-demo-guide.md](module-demo-guide.md), [ui-setup-and-happy-path.md](ui-setup-and-happy-path.md) |
| Pushing / deploying `backend/` and `frontend/` repos | [repo-separation-guide.md](repo-separation-guide.md) |

## Module contracts

| Module | Contract |
| --- | --- |
| Items / Products | [items-module.md](items-module.md) |
| Labels and Packing Formulas (BOM) | [brands-packing-formulas-modules.md](brands-packing-formulas-modules.md) |
| Suppliers | [suppliers-module.md](suppliers-module.md) |
| Customers | [customers-module.md](customers-module.md) |
| UOM and Locations | [uom-locations-modules.md](uom-locations-modules.md) |
| Users, Roles and Permissions | [roles-users-module.md](roles-users-module.md) |
| Purchase Orders | [purchase-orders-module.md](purchase-orders-module.md) |
| Receiving and Lots | [receiving-lots-modules.md](receiving-lots-modules.md) |
| Packing Orders and Reservations | [packing-orders-module.md](packing-orders-module.md) |
| Stock Transfers and In Transit | [stock-transfers-module.md](stock-transfers-module.md) |
| Sales Orders, customer PO planning, Delivery | [sales-delivery-modules.md](sales-delivery-modules.md) |
| Inventory Stocks and adjustments | [inventory-stocks-module.md](inventory-stocks-module.md) |
| Inventory Reports | [inventory-reports-module.md](inventory-reports-module.md) |
| Inventory Controls and operational reports | [inventory-controls-and-reports.md](inventory-controls-and-reports.md) |

## History & prompts

- [archive/module-audit-2026-11-14.md](archive/module-audit-2026-11-14.md) — module audit and verification results
- [archive/documentation-compliance-audit.md](archive/documentation-compliance-audit.md) — earlier compliance audit
- [prompts/organize-workspace.md](prompts/organize-workspace.md) — reusable workspace organization prompt

## Adding a document

1. Create `docs/<name>.md` (kebab-case) and add it to the tables above.
2. Link it from [AGENTS.md](../AGENTS.md) or the relevant app rules (`docs/backend-rules.md` / `docs/frontend-rules.md`) if agents need it often.
3. Run `.\kff.cmd check-docs` to verify links.
