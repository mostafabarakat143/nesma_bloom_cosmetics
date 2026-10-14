# Nesma Bloom Cosmetics

Full-stack cosmetics e-commerce monorepo (API first). Express.js 5 + Prisma 7 + PostgreSQL 16, managed with pnpm Workspaces and Turborepo.

## Monorepo structure

```text
apps/api          Express API (auth, catalog, orders)
infra/            Docker Compose PostgreSQL 16
```

Next.js storefront is not implemented yet.

## Technology stack

- Node.js, TypeScript, Express 5
- PostgreSQL 16, Prisma ORM 7
- Zod validation, Pino logging
- Argon2id passwords, JWT access + hashed refresh sessions
- Cookie CSRF (Origin + double-submit)
- Vitest + Supertest against `nesma_bloom_test`
- OpenAPI 3.1 + Swagger UI + generated Postman collection

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

```powershell
cd apps/api
pnpm db:migrate          # prisma migrate deploy (uses DATABASE_URL)
pnpm db:validate
pnpm db:generate
```

Apply the same migrations to the test database by pointing `DATABASE_URL` at `DATABASE_URL_TEST` for one deploy, or use your usual ops process. Integration tests expect the schema on `nesma_bloom_test`.

## Development commands

From repo root:

```powershell
pnpm install
pnpm --filter @cosmetics/api dev
pnpm --filter @cosmetics/api typecheck
pnpm --filter @cosmetics/api build
pnpm --filter @cosmetics/api test
pnpm --filter @cosmetics/api docs:postman
```

## API documentation

When docs are enabled (default outside production):

- Swagger UI: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- OpenAPI JSON: [http://localhost:4000/api/openapi.json](http://localhost:4000/api/openapi.json)

Generate Postman Collection v2.1:

```powershell
cd apps/api
pnpm docs:postman
```

Import `apps/api/docs/postman/Nesma-Bloom-API.postman_collection.json`. Set `baseUrl` and `origin`. Use Postman’s cookie jar after login; copy `nb_csrf` into `csrfToken`. Never commit real credentials.

## Authentication workflow

1. `POST /api/v1/auth/register` or `/login` with trusted `Origin`.
2. Browser stores `nb_access`, `nb_refresh`, `nb_csrf`.
3. Authenticated calls send cookies automatically.
4. Mutations also send `x-csrf-token: <nb_csrf>` and a trusted `Origin`.
5. `POST /api/v1/auth/refresh` rotates refresh tokens. Multi-tab races: one wins; the other gets 401 without logging out all devices when within a 30s grace window after rotation. Delayed reuse of an old rotated token after 30s triggers revoke-all (theft signal).
6. Disabled users lose API access immediately (DB status check on each protected request). Authorization roles are read from PostgreSQL, not trusted solely from the JWT.

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

1. Set strong secrets and `COOKIE_SECURE=true`.
2. Set `NODE_ENV=production` and explicit `CORS_ORIGIN`.
3. Leave `ENABLE_API_DOCS` unset/false unless you intentionally expose Swagger.
4. Run migrations against the target database.
5. Run `pnpm --filter @cosmetics/api build` and start `node dist/server.js` (or your process manager).
6. Point health checks at `/health`.

## License

Private project.
