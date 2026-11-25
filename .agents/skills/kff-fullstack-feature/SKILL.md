---
name: kff-fullstack-feature
description: >-
  Use when one KFF change spans both backend/ and frontend/ in this workspace
  (new or changed endpoint plus its UI, new module end to end, permission or
  DTO change, business-rule change). Orders the work spec -> backend ->
  contract -> frontend -> docs check -> verification so nothing drifts.
---

# KFF Full-Stack Feature Runbook

Rules live elsewhere; this skill only orders the work. Follow
[AGENTS.md](../../../AGENTS.md), [docs/backend-rules.md](../../../docs/backend-rules.md)
and [docs/frontend-rules.md](../../../docs/frontend-rules.md).

## 1. Understand

1. Read [docs/business-rules.md](../../../docs/business-rules.md), the relevant
   section of [docs/system-flow.md](../../../docs/system-flow.md) and the module
   contract from [docs/README.md](../../../docs/README.md).
2. Compare the spec with the current `backend/src/db/schema.ts`, the module's
   backend service/routes, and the frontend schema/hook. List the gaps that are
   in scope before editing.

## 2. Backend first

Follow skill `kff-backend-module`: schema/Zod -> service (transaction, locks)
-> routes/controller with permission guard -> `createApp` registration ->
`ROUTE_SYNC_SPECS` -> fake-service tests.

## 3. Contract

Update [docs/api-contract.md](../../../docs/api-contract.md) (endpoints,
permission guard, request fields, response DTO, query keys). Both apps are in
this workspace, so no copy-paste handoff block is needed — apply the frontend
side directly.

## 4. Frontend

Follow skill `kff-frontend-module`: `<entity>.schema.ts` matching the DTO ->
`use-<module>.ts` hook and query keys -> page/table/form -> permission-aware
actions -> sidebar, breadcrumb and `module-guides.ts` -> mocked-fetch tests.

## 5. Docs (required for every new feature or flow change)

Add or update the affected files in `docs/` in the same task:
- New module: create `docs/<module>-module.md` and add it to [docs/README.md](../../../docs/README.md).
- Flow/rule/contract/UI/demo changes: update `docs/system-flow.md` (keep all
  26 sections), the module contract, `docs/business-rules.md`, `docs/api-contract.md`,
  and `docs/backend-architecture.md`, `docs/frontend-architecture.md`,
  `docs/test-data.md`, or `docs/module-demo-guide.md` as applicable.

## 6. Verify

```powershell
.\kff.cmd verify      # docs link/clean check, backend typecheck + tests, frontend tsc + lint + tests
.\kff.cmd check-docs  # verifies 0 broken links and no AI/docs inside backend/ or frontend/
```

Add `npm run build` in `frontend/` for routing or runtime changes. Report any
check you could not run (for example, no test database).
