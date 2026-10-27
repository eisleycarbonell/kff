# KFF Backend Rules

These rules apply to `backend/`. Run commands from this directory. Use the
users API as the reference for new modules and module refactors. Adapt its
fields and behavior to the feature and the actual database schema.

## Stack and conventions

- Node.js 24+, Express 5, TypeScript, ESM, Drizzle ORM with postgres.js, and Zod 4.
- Use explicit `.ts` extensions for relative imports and `import type` for types.
  The server runs TypeScript directly; use syntax supported by Node's type
  stripping, without runtime TypeScript enums or constructor parameter properties.
- Use the existing response helpers, status constants, Pino logger, password
  helpers, database client, and shared middleware.
- Keep module folders plural and feature filenames singular and kebab-case,
  for example `modules/items/item.schema.ts` and `item.routes.ts`.
- Follow the installed dependency APIs and the formatting in `.prettierrc`.

## Structure

```text
backend/
  src/
    index.ts                       # Environment, real services, startup/listen
    app.ts                         # HTTP middleware, module registration, final errors
    modules/
      users/
        user.schema.ts             # Zod request schemas and inferred input types
        user.routes.ts             # Router factory and validation middleware
        user.controller.ts         # Controller factory and HTTP responses
        user.service.ts            # Business rules and Drizzle queries
      auth/
        auth.controller.ts         # Existing login/logout implementation
    errors/
      app-error.ts                 # Expected failures with safe client messages
      database-error.ts            # Shared SQLSTATE extraction and translation
    middleware/
      validate-request.ts          # Parse body/params/query into response.locals
      error-handler.ts             # One API error response boundary
      auth.ts                      # Existing authentication middleware
      httpLogger.ts                # Shared HTTP logging
    db/
      index.ts                     # Shared database client
      schema.ts                    # Authoritative application database schema
      column.helpers.ts            # Shared database columns
    utils/                         # Existing response, logging, hashing, JWT helpers
    types/express.d.ts             # Shared request augmentation
  tests/                           # Node tests with fake services; no live database
  drizzle.config.ts
```

Create only the files a feature needs. Keep routes, controllers, schemas, and
services together under `src/modules/<module>/`. Shared infrastructure belongs
under `src/errors/`, `src/middleware/`, `src/db/`, or `src/utils/`. A separate
repository layer, dependency-injection framework, or generic CRUD base class
is unnecessary for the current modules.

## Reference files and responsibilities

1. **Schemas validate and normalize inputs.** Read
   [user.schema.ts](src/modules/users/user.schema.ts). Define separate create,
   partial-update, route-parameter, and query schemas as needed. Infer service
   input types with `z.output<typeof schema>` so runtime parsing and TypeScript
   agree. Validate synchronous input constraints here; perform database lookups
   and business checks in the service.

2. **Routes connect validation to controllers.** Read
   [user.routes.ts](src/modules/users/user.routes.ts). Register
   `validateRequest(requestSchema)` before each handler that consumes input.
   Router and controller factories receive the feature service explicitly.

3. **Controllers translate between HTTP and services.** Read
   [user.controller.ts](src/modules/users/user.controller.ts). Consume parsed
   data from `response.locals.validated`, typed with `ValidatedResponse`.
   Use the response helpers and status constants. Throw `AppError` for expected
   failures such as a missing record. Express 5 forwards rejected async handlers
   to the shared error middleware, so handlers can simply await and return.

4. **Services own business rules and persistence.** Read
   [user.service.ts](src/modules/users/user.service.ts). Keep Express request and
   response objects out of services. Use explicit projections and writable
   fields, parameterized Drizzle queries, and transactions for operations that
   must succeed together. Other features may call a service's intentional
   exported operations, as auth uses the users lookup; avoid importing another
   feature's controller or router.

5. **Application composition stays in the entry files.** Read
   [app.ts](src/app.ts) and [index.ts](src/index.ts). Register feature routers in
   `createApp`; supply real services and call `listen` in `index.ts`. Extend this
   pattern when adding a module. Tests import the app factory with fake services
   instead of importing the startup file or connecting to the database.

## Validation rules

- Validate bodies, route parameters, and query parameters that a handler uses.
  Use [validate-request.ts](src/middleware/validate-request.ts) to obtain parsed
  output. Keep Express's original request properties intact, including its
  read-only query getter.
- Use strict objects for writable bodies. Reject unknown fields, client-supplied
  primary IDs, password hashes, and server-managed audit fields. Include actual
  writable foreign keys required by the feature.
- Normalize names and email as the users schema does. Preserve passwords
  exactly. Match lengths, enum values, numeric bounds, date formats, and
  nullability to the feature's API and database contract.
- Keep omitted, null, empty, false, and zero values distinct where the domain
  requires it. In PATCH requests, update supplied fields only. Reject empty
  updates and keep create-only defaults out of partial-update schemas.
- Parse IDs into valid positive integers within the database column's range.
  Validate decimal, date, and timestamp values according to their actual types;
  avoid silent lossy conversions for money or inventory quantities.
- A validation failure returns HTTP 400 with a readable `error.message` and
  `error.details` containing `path`, `message`, and `code`. Include no input
  values or passwords in the error response.

## Shared error handling

- Use [AppError](src/errors/app-error.ts) for expected failures with messages
  safe for clients. Keep resource-specific business errors in the feature.
- Use [database-error.ts](src/errors/database-error.ts) for PostgreSQL errors.
  It reads SQLSTATE codes through Drizzle's nested `cause` chain and guards
  against cycles. Extend this shared mapping when another module needs a new
  database error category; keep generic database handling out of controllers.
- The shared mapping handles duplicate/exclusion conflicts as 409; foreign-key,
  missing-value, check, format, length, and range failures as 400; restricted
  deletes as 409; and recognized connection/capacity failures as 503.
- Keep messages independent of users, roles, or other specific resources.
  Return no raw SQL, driver messages, constraint details, or query parameters.
  Unknown failures produce a generic HTTP 500 and are logged server-side.
- [error-handler.ts](src/middleware/error-handler.ts) also handles Zod errors,
  malformed JSON, and oversized bodies. Register it after routes and the JSON
  404 handler. If headers were already sent, delegate with `next(error)`.
- Return `{ success: true, data }` for successful reads/writes and
  `{ success: false, error: { message, details? } }` for errors. Use 201 for
  creation, 404 for missing records, and 204 without a body for successful deletes.

## Database and compatibility rules

- Reuse `src/db/index.ts` and `src/db/schema.ts`; generated migration snapshots
  are not application source. Include database changes explicitly in the task
  scope rather than changing tables as a side effect of an API refactor.
- Preserve the users API's `/api/user` URLs, camelCase fields, nullable values,
  and soft-delete filtering. Keep hashes in authentication lookups only;
  public users responses use an explicit projection that excludes passwords.
- Hash new passwords with the existing Argon2 helper. The current user PATCH
  contract updates profile fields and does not accept a password.
- The current users list returns a complete collection for frontend filtering
  and pagination. Coordinate any future server pagination contract with the
  frontend, including statistics and export scope.
- Preserve existing authentication and CORS behavior during structural changes.
  The existing auth controller is retained under its module; login/logout
  endpoints are not currently registered by the app factory.

## Verification

Run `npm run typecheck` and `npm test` after changes to requests, routing,
services, validation, or errors. Check formatting on affected files using the
installed Prettier CLI. Type checking covers application source, tests, and
the Drizzle config; historical generated migration files are excluded.

Use [user-schema.test.ts](tests/user-schema.test.ts),
[database-error.test.ts](tests/database-error.test.ts), and
[user-api.test.ts](tests/user-api.test.ts) as examples. Test required and invalid
inputs, normalization, unknown fields, PATCH omission/null behavior, ID parsing,
response envelopes/statuses, nested database failures, and private-data leakage.
Use fake services for HTTP tests; verify real persistence separately when a
database test environment is part of the task. Report checks that could not run.
Documentation-only changes need a consistency review rather than runtime tests.

API references: [Zod schemas](https://zod.dev/api),
[Express 5 error handling](https://expressjs.com/en/5x/guide/error-handling/), and
[PostgreSQL SQLSTATE codes](https://www.postgresql.org/docs/current/errcodes-appendix.html).
