# Local PostgreSQL (Docker Compose)

This folder runs PostgreSQL 16 for Nesma Bloom Cosmetics local development.

## Prerequisites

- Docker Desktop installed and running (`docker info` succeeds)

## Setup

```powershell
cd infra
copy .env.example .env
# Edit infra/.env and set a real local password for POSTGRES_PASSWORD
```

Then mirror the same credentials in `apps/api/.env` as `DATABASE_URL`:

```text
DATABASE_URL=postgresql://nesma:change_me@127.0.0.1:5432/nesma_bloom?schema=public
```

## Start

```powershell
cd infra
docker compose up -d
docker compose ps
```

## Stop (keep data)

```powershell
cd infra
docker compose down
```

## Inspect

```powershell
cd infra
docker compose logs -f postgres
docker compose exec postgres psql -U nesma -d nesma_bloom
```

## Reset (delete all database data)

```powershell
cd infra
docker compose down -v
docker compose up -d
```

`-v` removes the named volume `nesma_bloom_pgdata`.

## Persistence check

```powershell
cd infra
docker compose down
docker compose up -d
docker volume inspect nesma_bloom_pgdata
```

The volume should still exist after restart, so data survives container recreation.

## Database backups and recovery

Before a structural migration:

1. Confirm the database selected by `DATABASE_URL` and Prisma's reported datasource. A shell-level `DATABASE_URL` can take precedence over `apps/api/.env`.
2. Create a custom-format archive with `pg_dump --format=custom --file=<archive>`. Keep a copy outside the container, such as under the Git-ignored root `backups/` directory. Back up uploaded image files separately.
3. Check the archive with `pg_restore --list <archive>`, then rehearse restoration into a separate, clean database and verify record counts and relationships. Listing the archive alone does not prove a full restore will succeed.
4. Plan the maintenance window and application revision needed for recovery before applying the migration. Pause application writes when the migration or recovery procedure requires it.

For Docker backups on Windows, write the archive to a file inside the container and copy it out with `docker compose cp`; avoid passing a binary dump through a PowerShell text pipeline. A single-database `pg_dump` does not back up PostgreSQL roles; manage those separately when restoring to another server.

Recovery from a destructive migration can require restoring the verified backup into a clean database and running the matching application revision. Do not assume every migration has an automatic reverse operation. Validate login, catalog reads, and database relationships before reconnecting the application to the restored database.

The UUID-to-integer conversion is historical. Its official SQL remains in `apps/api/prisma/migrations/20261015140000_uuid_to_int/migration.sql`; it is not pending work. Recovering the earlier UUID-based state requires a compatible pre-conversion backup and application revision, and clients must refresh IDs and authenticate again when switching ID formats.

References: [PostgreSQL 16 pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html) and [pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html).
