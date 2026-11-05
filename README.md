# Nesma Bloom Cosmetics

Full-stack cosmetics e-commerce monorepo (API first). Express.js 5 + Prisma 7 + PostgreSQL 16, managed with pnpm Workspaces and Turborepo.

## Monorepo structure

```text
apps/api          Express API (auth, catalog, orders)
apps/web          Next.js storefront with feature services and custom hooks
infra/            Docker Compose PostgreSQL 16
```

See [the frontend guide](apps/web/README.md) for its feature architecture,
environment setup, and checks.

## Technology stack

- Node.js, TypeScript, Express 5
- PostgreSQL 16, Prisma ORM 7
- Zod validation, Pino logging
- Argon2id passwords, 7-day Bearer JWT, server-side jti revocation
- Vitest + Supertest against `nesma_bloom_test`
- OpenAPI 3.1 + Swagger UI

## API conventions

- **IDs:** positive integers (`1`, `2`, …), one PostgreSQL `IDENTITY` sequence per table. Path/query/body IDs reject non-integers and unsafe values.
- **Errors:** client JSON is only `{ "status": "error", "message": "..." }` (no `code`, `details`, or `requestId`).
- **Money:** integer EGP piastres (`priceMinor`, `totalMinor`, etc.).
- **Request size:** JSON bodies exceeding `BODY_SIZE_LIMIT` return HTTP 413.

## Prerequisites

- Node.js 22+ recommended
- pnpm 10 (`corepack enable`)
- Docker Desktop

## Docker PostgreSQL

```powershell
cd infra
copy .env.example .env
docker compose up -d
```

See [infra/README.md](infra/README.md).

Create the test database once:

```powershell
docker exec -it <postgres-container> psql -U nesma -c "CREATE DATABASE nesma_bloom_test;"
```

## API environment

```powershell
cd apps/api
copy .env.example .env
```

Important variables:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Dev DB `nesma_bloom` |
| `DATABASE_URL_TEST` | Isolated test DB |
| `JWT_ACCESS_SECRET` | ≥ 32 characters |
| `CORS_ORIGIN` | Trusted frontend origin(s) |
| `COOKIE_SECURE` | **Must be `true` in production** |
| `ENABLE_API_DOCS` | Production default off; set `true` to expose docs |

## Migrations

Prisma reads `DATABASE_URL` from the process environment **before** `apps/api/.env`. A leftover shell variable (for example from a rehearsal DB) will override `.env` and can migrate the wrong database.

**Before every `migrate deploy`:**

```powershell
# 1) See what the shell will force (should be empty for normal local work)
echo $env:DATABASE_URL

# 2) Clear accidental overrides, then use .env
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

# 3) Confirm the target Prisma will use
cd apps/api
pnpm exec prisma migrate status
# Expect: Datasource "db": PostgreSQL database "nesma_bloom" ... (or nesma_bloom_test when deploying tests)
```

Only then:

```powershell
cd apps/api
pnpm db:migrate          # prisma migrate deploy (uses DATABASE_URL)
pnpm db:validate
pnpm db:generate
```

Apply the same migrations to the **test** database by setting `DATABASE_URL` explicitly to the `DATABASE_URL_TEST` value for one deploy (never point either URL at production). Integration tests expect the schema on `nesma_bloom_test`.

Test setup refuses database names other than `nesma_bloom_test`, URL query
parameters that override connection routing, and `NODE_ENV` values other than
`test`. This validation also applies to per-test URL overrides and runs before a
test database client is created. Keep the dedicated test database separate from
application data; integration fixtures delete test records.

## Development commands

From repo root:

```powershell
pnpm install
pnpm --filter @cosmetics/api dev
pnpm --filter @cosmetics/api typecheck
pnpm --filter @cosmetics/api build
pnpm --filter @cosmetics/api test
```

## API documentation

When docs are enabled (default outside production):

- Swagger UI: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- OpenAPI JSON: [http://localhost:4000/api/openapi.json](http://localhost:4000/api/openapi.json)

## Authentication workflow

1. `POST /api/v1/auth/register` or `/login` returns `{ user, token }`.
2. The token is a 7-day JWT (`JWT_TTL_SECONDS=604800`) with `sub`, `jti`, `iat`, `exp`, `iss`, `aud`, and `authVersion`.
3. Protected calls send `Authorization: Bearer <token>`.
4. `POST /api/v1/auth/logout` revokes that `jti`. Repeating logout with the same token returns 200. Every other protected route rejects it with 401.
5. Disabled users lose API access immediately. Authorization roles are read from PostgreSQL on each request, not from the JWT.
6. `POST /api/v1/auth/change-password` requires the current password. Password changes and resets increment the account's `auth_version` atomically with the password update. Tokens must carry the matching version, so existing JWTs are rejected and immediate login works without a timestamp delay. `password_changed_at` remains an audit timestamp.
7. `POST /api/v1/auth/forgot-password` always returns the same message. The reset token is stored only as a SHA-256 hash and is not returned in the response. When `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` are set, the link is emailed. Without SMTP, development prints the link in the API log. `POST /api/v1/auth/reset-password` uses that token once and also invalidates existing JWTs.

## Orders lifecycle

```text
PENDING → CONFIRMED → FULFILLED   (ADMIN)
PENDING → CANCELLED               (CUSTOMER or ADMIN)
CONFIRMED → CANCELLED             (ADMIN)
```

`POST /api/v1/orders` (CUSTOMER only):

- Requires `Idempotency-Key`.
- Prices/stock from the database inside a transaction.
- Concurrent checkouts cannot oversell.
- Same key + same body → HTTP **200** with the original order (no second stock deduction).
- First success → HTTP **201**.
- Same key + different body → HTTP **409**.

## Deployment preparation

Apply migration `20261105120000_auth_version` before starting the updated API.
JWTs issued before this release lack the required version claim; users must log
in again after the update. The response format and frontend cookie flow are
unchanged.

1. Set strong secrets and `COOKIE_SECURE=true`.
2. Set `NODE_ENV=production` and explicit `CORS_ORIGIN`.
3. Leave `ENABLE_API_DOCS` unset/false unless you intentionally expose Swagger.
4. Run migrations against the target database.
5. Run `pnpm --filter @cosmetics/api build` and start `node dist/server.js` (or your process manager).

Keep tests in the repository and run them before deployment. The API TypeScript
configuration compiles `src/` into `dist/` and excludes `tests/` and
`vitest.config.ts`. Package the built `dist/` directory and production dependencies
for the running API; omit tests and test configuration from the runtime artifact.
This is a packaging choice: copying the entire repository to a server would still
copy the test source files. Keep the Prisma schema, configuration, migrations, and
CLI available in the deployment step that applies database migrations.

## License

Private project.
