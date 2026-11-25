# KFF Frontend — Kusina Filipino Food

Next.js 16 (App Router) + React 19 + TypeScript UI for the Kusina Filipino Food
(KFF) spice trading and packing system.

## Tech Stack

- **Framework**: Next.js 16 (`next`, App Router, Turbopack), React 19, TypeScript 5
- **Styling & Fonts**: Tailwind CSS v4, shadcn/ui (`base-nova` / Base UI `@base-ui/react`), self-hosted Inter variable font (`next/font/local`)
- **State & Server Data**: TanStack Query v5 (`@tanstack/react-query`), Zustand v5 (`zustand`), Zod 4 (`zod`)
- **Tables & Charts**: TanStack Table v9 (`@tanstack/react-table`), Recharts (`recharts`)
- **Realtime & Motion**: Socket.IO client (`socket.io-client`), GSAP (`gsap`, `@gsap/react`), `lucide-react`

## Quickstart

```bash
npm ci
cp .env.example .env.local
```

Ensure `NEXT_PUBLIC_API_BASE_URL` points to your running KFF backend `/api`
base URL (default: `http://localhost:3001/api`).

```bash
# Development server on http://localhost:3000
npm run dev

# Production build and server
npm run build
npm run start
```

## Connecting to the Backend

1. **Local Development (`http://localhost:3000` -> `http://localhost:3001`)**:
   - Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api` in `.env.local`.
   - Ensure the backend sets `CORS_ORIGIN=http://localhost:3000`.
2. **Production Same-Origin Proxy (Recommended)**:
   - Set `BACKEND_URL=https://api.example.com` (or `API_PROXY_TARGET`).
   - In production builds (`NODE_ENV=production`), [next.config.ts](next.config.ts) enables `NEXT_PUBLIC_API_PROXY=true` and rewrites `/api/:path*` to `${BACKEND_URL}/api/:path*`.
   - Set `NEXT_PUBLIC_SOCKET_URL=https://api.example.com` so Socket.IO fetches `/api/auth/socket-token` and connects to the backend WebSocket server.
3. **Production Direct CORS**:
   - Set `NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api` without `BACKEND_URL`.
   - Backend must configure `CORS_ORIGIN=https://app.example.com` and `COOKIE_SAME_SITE=none` over HTTPS.
4. **Serverless Backend Fallback**:
   - If `GET /api/health` returns `realtime: false`, [RealtimeProvider](src/providers/realtime-provider.tsx) disables WebSocket retries and polls active TanStack queries every 30 seconds.

## Application Route Map (45 App Pages)

- **Public**: `/` (login page)
- **Dashboard**: `/dashboard`
- **Inventory**: `/inventory`, `/inventory/lots`, `/lots`, `/inventory/transactions`, `/inventory/adjustments`, `/inventory/scrap`, `/formula-revisions`, `/inventory/count-sessions`, `/inventory/counts`, `/inventory/qc-decisions`, `/inventory/dispositions` (last four are retired history views)
- **Purchasing**: `/purchase-orders`, `/receiving`
- **Packing**: `/packing-orders`, `/packing-orders/reservations`
- **Transfers**: `/transfers`, `/transfers/in-transit`
- **Sales & Delivery**: `/sales-orders`, `/delivery-orders`
- **Master Data**: `/items`, `/bom`, `/item-packaging`, `/reorder-policies`, `/reason-codes`, `/suppliers`, `/customers`, `/locations`, `/uom`, `/brands` (legacy read-only)
- **Reports**: `/reports/inventory`, `/reports/packing`, `/reports/purchasing`, `/reports/transfers`, `/reports/genealogy`
- **Accounting**: `/accounting`, `/accounting/general-ledger`, `/accounting/valuation`, `/accounting/production-costing`, `/accounting/receivables-margins`, `/accounting/payables`
- **Users & Settings**: `/users`, `/roles`, `/settings`

## Core UI Standards

- **Selectors**: Always use shared `ComboboxSelect` ([combobox-select.tsx](src/components/shared/combobox-select.tsx)) or `Combobox` ([combobox.tsx](src/components/ui/combobox.tsx)) — never native `<select>` or plain `<Select>`.
- **Responsiveness**: Responsive down to `320px` width without horizontal page overflow or truncated KPI details.
- **CSV Import & Templates**: 21 writable modules use `BulkImportActions` ([bulk-import-actions.tsx](src/components/shared/bulk-import-actions.tsx)) + lazy `BulkImportDialog` ([bulk-import-dialog.tsx](src/components/shared/bulk-import-dialog.tsx)). Only **Import CSV** renders in the page header; **Download template** stays inside the modal.
- **Self-Hosted Font**: Root layout loads Inter locally via `next/font/local` (`src/app/fonts/inter-variable.woff2`) mapped in [globals.css](src/app/globals.css).

## Verification

```bash
npm test
npm run test:api
npx tsc --noEmit
npm run lint
npm run build
```
