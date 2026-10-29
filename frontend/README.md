# KFF frontend

Install dependencies, copy `.env.example` to `.env.local`, then run `npm run dev`.

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
```

The value is the backend API prefix, including `/api`. Restart the development
server after changing it, or rebuild the frontend for production. The default users URL is
`http://localhost:3001/api/user`, matching the existing backend route prefix.

## Users API contract

The backend implements these endpoints in `backend/src/modules/users/`.
The Items / Products module and login/session integration are documented in
[the items module contract](../docs/items-module.md).

| Method | Path relative to API base | Request | Response |
| --- | --- | --- | --- |
| GET | `/user` | None | `{ "success": true, "data": User[] }` |
| POST | `/user` | `CreateUserInput` | `{ "success": true, "data": User }` |
| PATCH | `/user/:userId` | `UpdateUserInput` | `{ "success": true, "data": User }` |
| DELETE | `/user/:userId` | None | HTTP 204, or `{ "success": true }` |

Use camelCase JSON keys, matching the Drizzle property names. Return all active
users as an array; table filtering and pagination currently run in the browser.
The backend should exclude soft-deleted records from GET and implement DELETE
by setting `deletedAt` if using the schema's soft-delete convention.

Example public user returned by GET, POST, and PATCH:

```json
{
  "userId": 1,
  "firstName": "Maria",
  "middleName": null,
  "lastName": "Santos",
  "dateOfBirth": null,
  "avatarUrl": null,
  "mobileNumber": null,
  "address": null,
  "email": "maria@example.com",
  "isEmailVerified": false,
  "roleId": 2,
  "lastLoginAt": null,
  "deletedAt": null,
  "createdBy": null,
  "createdAt": "2026-10-26T08:00:00.000Z",
  "updatedBy": null,
  "updatedAt": "2026-10-26T08:00:00.000Z"
}
```

`dateOfBirth` is `YYYY-MM-DD` or null. Timestamps are ISO strings or null where
the database allows null. The backend generates IDs and audit fields.
`passwordHash` must stay on the backend and must not appear in API responses.

Example POST body:

```json
{
  "firstName": "Maria",
  "lastName": "Santos",
  "email": "maria@example.com",
  "mobileNumber": null,
  "roleId": 2,
  "isEmailVerified": false,
  "password": "example-password"
}
```

The backend hashes `password` into `passwordHash`. The creation form currently
requires 8–128 characters. PATCH accepts partial writable profile fields and
does not send a password. Optional `middleName`, `dateOfBirth`, `avatarUrl`, and
`address` are supported by the API input types; the current form edits the core
name, email, mobile, role, and verification fields. Omitted profile fields must
remain unchanged on PATCH; nullable fields can explicitly be set to null.

Role IDs must reference existing backend roles. The dropdown uses the local
`USER_ROLES` options; align those IDs with your roles table.

Return errors in the existing backend envelope, with an appropriate HTTP status:

```json
{
  "success": false,
  "error": { "message": "A user with this email address already exists." }
}
```

Requests include browser credentials. For a separate backend origin, configure
backend CORS for the frontend origin and credentialed requests.

## Data flow and checks

`use-users.ts` contains the endpoint URLs, HTTP requests, and TanStack Query
loading, caching, mutations, and refetching. Statistics and the table share
the same query result. Successful mutations update the cache and invalidate the
users query. A partially failed bulk delete retains only failed users for retry.
There is no demo-data or localStorage fallback.

```bash
npm run test:api
npm run lint
npm run build
```

The API tests use Node's built-in test runner and TypeScript stripping, requiring
Node 22.18+ or Node 24+. They mock fetch and do not contact the backend.

Inventory Stocks: [module contract and adjustment rules](../docs/inventory-stocks-module.md).
