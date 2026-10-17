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
