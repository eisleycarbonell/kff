---
name: kff-backend-bridge
description: >-
  Use whenever consuming backend API changes, requesting new backend endpoints or DTO
  fields, troubleshooting CORS/cookies/proxy mode (BACKEND_URL / NEXT_PUBLIC_API_BASE_URL),
  or syncing Socket.IO `data:sync` and `notification:new` events with TanStack Query keys.
---

# KFF Backend Bridge

Keep the **KFF Frontend** synchronized with the **KFF Backend** API and realtime contracts.

## Procedure

1. **Read the canonical contract and specs first**:
   - Read [docs/api-contract.md](../../../docs/api-contract.md).
   - Read [docs/business-rules.md](../../../docs/business-rules.md) and the affected module contract under `docs/` (starting from [docs/system-flow.md](../../../docs/system-flow.md)).
2. **Apply backend contract changes to the frontend**:
   - Update DTO schemas, create/update inputs, and exact decimal/date validation in `frontend/src/components/modules/<module>/<entity>.schema.ts`.
   - Update `apiRequest(...)` endpoints, Zod list/item parsers, `useQuery`/`useMutation` handlers, and query invalidation keys in `frontend/src/hooks/modules/<module>/use-<module>.ts`.
   - Enforce matching role permission checks (`session.data?.permissions?.canManage...`) in UI buttons/dialogs/navigation while letting the backend enforce authorization authoritatively.
   - If CSV import columns changed, update [module-bulk-imports.ts](../../../frontend/src/lib/module-bulk-imports.ts).
   - Update mocked-fetch tests in `frontend/tests/<entity>-api.test.mjs` and update [docs/api-contract.md](../../../docs/api-contract.md).
3. **Requesting new/updated Backend functionality**:
   - Never fake missing backend data or store server data in Zustand/localStorage.
   - In this workspace, implement the backend side directly (follow `kff-fullstack-feature`). If handing off to a separate session, output a `KFF Contract Request (Frontend -> Backend)` block using the template in [docs/api-contract.md](../../../docs/api-contract.md#7-cross-repo-contract-handoff-protocol).
4. **Check Proxy, CORS & Socket.IO connectivity**:
   - Review [api-request.ts](../../../frontend/src/lib/api-request.ts), [next.config.ts](../../../frontend/next.config.ts), and [realtime-provider.tsx](../../../frontend/src/providers/realtime-provider.tsx).
   - Local dev uses `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api`; production separated hosting prefers `BACKEND_URL` (rewrite proxy + `NEXT_PUBLIC_API_PROXY=true`) with `NEXT_PUBLIC_SOCKET_URL` and `/api/auth/socket-token`.
   - From `frontend/`, verify `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
