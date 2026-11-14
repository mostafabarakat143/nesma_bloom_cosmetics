# Redis caching in this backend

Redis stores temporary copies of public catalog responses in memory. PostgreSQL remains the source of truth, and Prisma still performs all database operations.

## Simple request flow

1. The request passes the existing authentication and validation middleware.
2. An anonymous category, subcategory, or product read checks Redis.
3. A cache hit returns the stored public response data.
4. A cache miss runs the original service and Prisma queries, then stores the successful result for 30 seconds.
5. Catalog edits, image edits, checkout, cancellation, and order-status changes invalidate the catalog cache after the operation. The next read loads fresh data from PostgreSQL.
6. If Redis is disconnected, slow, or failing, the request uses PostgreSQL. Redis is not required for the API to start.

This is called **cache-aside**: the application checks the cache and loads the database when needed.

Only anonymous GET requests for category, subcategory, and product lists/details are cached. Every signed-in read bypasses the shared cache, including admin catalog views. Authentication, profiles, orders, checkout decisions, and error responses are not cached.

## Why keys and invalidation matter

A cache key includes the resource and a hash of the validated query or ID. Page 1, page 2, a different search, and a different sort each get their own entry. Defaults are applied by validation first, so equivalent requests can reuse the same entry. Raw search text is not part of Redis key names.

All catalog entries share a revision stored in Redis. After a write, the application assigns a new random revision. Old entries become unreachable and expire automatically. This avoids scanning or flushing Redis and also invalidates entries used by other API instances with the same prefix.

A slow request may finish after a write; it stores its result under its original revision, so newer requests cannot pick it up from the current revision. Concurrent misses for the same key within one API instance share one database lookup.

The whole catalog is invalidated because the responses are related: a category rename can affect product responses, and checkout changes stock quantities. Invalidation also runs when an operation throws, because some existing image operations can commit database changes before a later filesystem operation fails.

## Failure behavior and freshness

Redis commands have a 200 ms timeout, the connection attempt has a 1 second timeout, and offline commands are not queued. The client reconnects in the background. Invalidation failures do not turn a successful database write into an API error. Logs report cache availability without recording the Redis URL or credentials.

After reconnecting, or when this instance resumes caching after a failed invalidation, a new revision prevents reuse of old entries. Redis entries are disposable: the local container has a 128 MB memory cap with LRU eviction and does not persist cache contents to disk.

Caching provides bounded, eventual freshness rather than a transaction spanning PostgreSQL and Redis. An already-running read can still return an older value. Writes made directly in PostgreSQL or by scripts that bypass these controllers are reflected when entries expire. If a writer cannot reach Redis while another API instance still can, that instance may serve an older cached value until expiry. Checkout always rechecks PostgreSQL; cached price or stock values are never trusted to place an order.

## Run locally

From the repository root:

```powershell
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d redis
```

Set these values in `apps/api/.env`, then restart the API:

```dotenv
REDIS_URL=redis://127.0.0.1:6379/0
REDIS_KEY_PREFIX=cosmetics:api
CACHE_TTL_SECONDS=30
```

Run the API directly from its workspace:

```powershell
cd apps/api
pnpm.cmd dev
```

If `REDIS_PORT` is changed in `infra/.env`, update the port in `REDIS_URL` too. Set `REDIS_URL=` to disable caching. Use a different key prefix for deployments that must not share catalog data. The application also includes `NODE_ENV` and a cache-format version in its prefix.

The Compose port is bound to localhost for development. For a hosted Redis service, provide its connection URL through your deployment's secrets/environment settings; `rediss://` enables TLS.

Check the local server:

```powershell
docker compose --env-file infra/.env -f infra/docker-compose.yml exec redis redis-cli ping
```

It should return `PONG`. Set `LOG_LEVEL=debug` and make the same anonymous catalog request twice: the first successful read logs a cache miss, and the next read logs a cache hit. The JSON response format stays the same.

Run the Redis integration tests from `apps/api` against a local test Redis instance:

```powershell
$env:REDIS_URL_TEST = "redis://127.0.0.1:6379/1"
pnpm.cmd exec vitest run tests/integration/redis.test.ts
```

These tests use a random key prefix and clean up only their own keys. They are skipped unless `REDIS_URL_TEST` is set. Unit tests use a test-only memory store and do not need Redis or PostgreSQL running.

## Files to inspect

| File | Purpose |
| --- | --- |
| `apps/api/src/config/redis.ts` | Redis client, reconnects, command timeouts, and connection lifecycle. |
| `apps/api/src/common/cache/catalog-cache.ts` | Cache-aside reads, TTL, shared revisions, invalidation, and database fallback. |
| `apps/api/src/config/env.ts` | Validates Redis settings. |
| Catalog controllers | Cache public reads and invalidate after mutations. |
| `apps/api/src/modules/orders/order.controller.ts` | Invalidates catalog copies when order operations may change stock. |
| `apps/api/src/server.ts` | Starts the optional Redis connection and closes it during shutdown. |
| `infra/docker-compose.yml` | Runs local Redis alongside PostgreSQL. |

## Why the backend worked without Redis

Before caching, each request loaded its data from PostgreSQL. This is simpler and often enough for a small application. Redis is an optimization for repeated reads, not a requirement for Prisma or for correct business behavior. It adds another service and cache-invalidation rules, so real traffic and database measurements should guide further caching.

## Alternatives to remember

| Alternative | Simple explanation |
| --- | --- |
| Valkey | A separate in-memory data store with substantial Redis compatibility. Check the versions and commands used when switching. |
| Memcached | A dedicated memory cache for temporary key/value data. Requires a different client and adaptation of this cache layer. |
| An in-process LRU cache, such as `lru-cache` | Keeps cached data inside one Node.js process. Simple, but instances do not automatically share entries or invalidations. |

`redis` and `ioredis` are **client libraries** for talking to Redis; changing the client is different from replacing the Redis server.

References: [Redis cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/), [node-redis configuration](https://github.com/redis/node-redis/blob/master/docs/client-configuration.md), [Valkey migration guidance](https://valkey.io/topics/migration/), [Memcached](https://memcached.org/about/), and [lru-cache](https://github.com/isaacs/node-lru-cache).
