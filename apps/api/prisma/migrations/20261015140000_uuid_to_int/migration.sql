-- Option A: convert all application UUID PKs/FKs to INTEGER identity columns.
--
-- Deterministic mapping: ROW_NUMBER() OVER (ORDER BY created_at ASC, id::text ASC)
-- (order_items: ORDER BY order_id::text ASC, id::text ASC).
--
-- Prerequisites:
--   1. Verified pg_dump backup of the target database.
--   2. API stopped (or in maintenance) for the duration of this transaction.
--   3. Application code updated to Int IDs and redeployed with this migration.
--
-- Post-migration auth: all refresh sessions are revoked; users must log in again.

BEGIN;

-- =============================================================================
-- 1) Add integer surrogate columns (NULL first; fill deterministically)
-- =============================================================================

ALTER TABLE "users" ADD COLUMN "new_id" INTEGER;
ALTER TABLE "user_profiles" ADD COLUMN "new_id" INTEGER;
ALTER TABLE "user_profiles" ADD COLUMN "new_user_id" INTEGER;
ALTER TABLE "refresh_tokens" ADD COLUMN "new_id" INTEGER;
ALTER TABLE "refresh_tokens" ADD COLUMN "new_user_id" INTEGER;
ALTER TABLE "refresh_tokens" ADD COLUMN "new_replaced_by_id" INTEGER;
ALTER TABLE "categories" ADD COLUMN "new_id" INTEGER;
ALTER TABLE "subcategories" ADD COLUMN "new_id" INTEGER;
ALTER TABLE "subcategories" ADD COLUMN "new_category_id" INTEGER;
ALTER TABLE "products" ADD COLUMN "new_id" INTEGER;
ALTER TABLE "products" ADD COLUMN "new_subcategory_id" INTEGER;
ALTER TABLE "product_images" ADD COLUMN "new_id" INTEGER;
ALTER TABLE "product_images" ADD COLUMN "new_product_id" INTEGER;
ALTER TABLE "orders" ADD COLUMN "new_id" INTEGER;
ALTER TABLE "orders" ADD COLUMN "new_user_id" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "new_id" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "new_order_id" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "new_product_id" INTEGER;
ALTER TABLE "order_idempotency_keys" ADD COLUMN "new_id" INTEGER;
ALTER TABLE "order_idempotency_keys" ADD COLUMN "new_user_id" INTEGER;
ALTER TABLE "order_idempotency_keys" ADD COLUMN "new_order_id" INTEGER;

-- =============================================================================
-- 2) Assign new PKs (deterministic)
-- =============================================================================

UPDATE "users" u
SET "new_id" = m.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id"::text ASC) AS rn
  FROM "users"
) m
WHERE u."id" = m."id";

UPDATE "user_profiles" p
SET "new_id" = m.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id"::text ASC) AS rn
  FROM "user_profiles"
) m
WHERE p."id" = m."id";

UPDATE "refresh_tokens" r
SET "new_id" = m.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id"::text ASC) AS rn
  FROM "refresh_tokens"
) m
WHERE r."id" = m."id";

UPDATE "categories" c
SET "new_id" = m.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id"::text ASC) AS rn
  FROM "categories"
) m
WHERE c."id" = m."id";

UPDATE "subcategories" s
SET "new_id" = m.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id"::text ASC) AS rn
  FROM "subcategories"
) m
WHERE s."id" = m."id";

UPDATE "products" p
SET "new_id" = m.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id"::text ASC) AS rn
  FROM "products"
) m
WHERE p."id" = m."id";

UPDATE "product_images" i
SET "new_id" = m.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id"::text ASC) AS rn
  FROM "product_images"
) m
WHERE i."id" = m."id";

UPDATE "orders" o
SET "new_id" = m.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id"::text ASC) AS rn
  FROM "orders"
) m
WHERE o."id" = m."id";

UPDATE "order_items" oi
SET "new_id" = m.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "order_id"::text ASC, "id"::text ASC) AS rn
  FROM "order_items"
) m
WHERE oi."id" = m."id";

UPDATE "order_idempotency_keys" k
SET "new_id" = m.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id"::text ASC) AS rn
  FROM "order_idempotency_keys"
) m
WHERE k."id" = m."id";

-- =============================================================================
-- 3) Remap foreign keys via old UUID joins
-- =============================================================================

UPDATE "user_profiles" p
SET "new_user_id" = u."new_id"
FROM "users" u
WHERE p."user_id" = u."id";

UPDATE "refresh_tokens" r
SET "new_user_id" = u."new_id"
FROM "users" u
WHERE r."user_id" = u."id";

UPDATE "refresh_tokens" r
SET "new_replaced_by_id" = n."new_id"
FROM "refresh_tokens" n
WHERE r."replaced_by_id" IS NOT NULL
  AND r."replaced_by_id" = n."id";

UPDATE "subcategories" s
SET "new_category_id" = c."new_id"
FROM "categories" c
WHERE s."category_id" = c."id";

UPDATE "products" p
SET "new_subcategory_id" = s."new_id"
FROM "subcategories" s
WHERE p."subcategory_id" = s."id";

UPDATE "product_images" i
SET "new_product_id" = p."new_id"
FROM "products" p
WHERE i."product_id" = p."id";

UPDATE "orders" o
SET "new_user_id" = u."new_id"
FROM "users" u
WHERE o."user_id" = u."id";

UPDATE "order_items" oi
SET "new_order_id" = o."new_id",
    "new_product_id" = p."new_id"
FROM "orders" o, "products" p
WHERE oi."order_id" = o."id"
  AND oi."product_id" = p."id";

UPDATE "order_idempotency_keys" k
SET "new_user_id" = u."new_id"
FROM "users" u
WHERE k."user_id" = u."id";

UPDATE "order_idempotency_keys" k
SET "new_order_id" = o."new_id"
FROM "orders" o
WHERE k."order_id" IS NOT NULL
  AND k."order_id" = o."id";

-- Integrity checks (abort transaction if any NULL where required)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "new_id" IS NULL) THEN
    RAISE EXCEPTION 'users.new_id backfill incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM "user_profiles" WHERE "new_id" IS NULL OR "new_user_id" IS NULL) THEN
    RAISE EXCEPTION 'user_profiles backfill incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM "refresh_tokens" WHERE "new_id" IS NULL OR "new_user_id" IS NULL) THEN
    RAISE EXCEPTION 'refresh_tokens backfill incomplete';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "refresh_tokens"
    WHERE "replaced_by_id" IS NOT NULL AND "new_replaced_by_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'refresh_tokens.replaced_by_id remap incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM "categories" WHERE "new_id" IS NULL) THEN
    RAISE EXCEPTION 'categories.new_id backfill incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM "subcategories" WHERE "new_id" IS NULL OR "new_category_id" IS NULL) THEN
    RAISE EXCEPTION 'subcategories backfill incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM "products" WHERE "new_id" IS NULL OR "new_subcategory_id" IS NULL) THEN
    RAISE EXCEPTION 'products backfill incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM "product_images" WHERE "new_id" IS NULL OR "new_product_id" IS NULL) THEN
    RAISE EXCEPTION 'product_images backfill incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM "orders" WHERE "new_id" IS NULL OR "new_user_id" IS NULL) THEN
    RAISE EXCEPTION 'orders backfill incomplete';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "order_items"
    WHERE "new_id" IS NULL OR "new_order_id" IS NULL OR "new_product_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'order_items backfill incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM "order_idempotency_keys" WHERE "new_id" IS NULL OR "new_user_id" IS NULL) THEN
    RAISE EXCEPTION 'order_idempotency_keys backfill incomplete';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "order_idempotency_keys"
    WHERE "order_id" IS NOT NULL AND "new_order_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'order_idempotency_keys.order_id remap incomplete';
  END IF;
END $$;

-- =============================================================================
-- 4) Drop dependent FKs / unique indexes that reference UUID columns
-- =============================================================================

ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_user_id_fkey";
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_user_id_fkey";
ALTER TABLE "subcategories" DROP CONSTRAINT "subcategories_category_id_fkey";
ALTER TABLE "products" DROP CONSTRAINT "products_subcategory_id_fkey";
ALTER TABLE "product_images" DROP CONSTRAINT "product_images_product_id_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_fkey";
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_fkey";
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_fkey";
ALTER TABLE "order_idempotency_keys" DROP CONSTRAINT "order_idempotency_keys_user_id_fkey";
ALTER TABLE "order_idempotency_keys" DROP CONSTRAINT "order_idempotency_keys_order_id_fkey";

DROP INDEX IF EXISTS "user_profiles_user_id_key";
DROP INDEX IF EXISTS "subcategories_category_id_idx";
DROP INDEX IF EXISTS "subcategories_category_id_slug_key";
DROP INDEX IF EXISTS "products_subcategory_id_idx";
DROP INDEX IF EXISTS "product_images_product_id_sort_order_idx";
DROP INDEX IF EXISTS "product_images_product_id_sort_order_key";
DROP INDEX IF EXISTS "product_images_one_primary_per_product_key";
DROP INDEX IF EXISTS "orders_user_id_created_at_idx";
DROP INDEX IF EXISTS "order_items_order_id_idx";
DROP INDEX IF EXISTS "order_items_product_id_idx";
DROP INDEX IF EXISTS "order_idempotency_keys_order_id_key";
DROP INDEX IF EXISTS "order_idempotency_keys_user_id_key_key";
DROP INDEX IF EXISTS "refresh_tokens_user_id_idx";
DROP INDEX IF EXISTS "refresh_tokens_replaced_by_id_idx";

-- =============================================================================
-- 5) Swap primary keys: drop old UUID PK/columns, promote new_id
-- =============================================================================

ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_pkey";
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_pkey";
ALTER TABLE "subcategories" DROP CONSTRAINT "subcategories_pkey";
ALTER TABLE "products" DROP CONSTRAINT "products_pkey";
ALTER TABLE "product_images" DROP CONSTRAINT "product_images_pkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_pkey";
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_pkey";
ALTER TABLE "order_idempotency_keys" DROP CONSTRAINT "order_idempotency_keys_pkey";
ALTER TABLE "categories" DROP CONSTRAINT "categories_pkey";
ALTER TABLE "users" DROP CONSTRAINT "users_pkey";

-- Drop old UUID columns (PK + FK)
ALTER TABLE "user_profiles" DROP COLUMN "id", DROP COLUMN "user_id";
ALTER TABLE "refresh_tokens" DROP COLUMN "id", DROP COLUMN "user_id", DROP COLUMN "replaced_by_id";
ALTER TABLE "subcategories" DROP COLUMN "id", DROP COLUMN "category_id";
ALTER TABLE "products" DROP COLUMN "id", DROP COLUMN "subcategory_id";
ALTER TABLE "product_images" DROP COLUMN "id", DROP COLUMN "product_id";
ALTER TABLE "orders" DROP COLUMN "id", DROP COLUMN "user_id";
ALTER TABLE "order_items" DROP COLUMN "id", DROP COLUMN "order_id", DROP COLUMN "product_id";
ALTER TABLE "order_idempotency_keys" DROP COLUMN "id", DROP COLUMN "user_id", DROP COLUMN "order_id";
ALTER TABLE "categories" DROP COLUMN "id";
ALTER TABLE "users" DROP COLUMN "id";

-- Rename promoted columns
ALTER TABLE "users" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "user_profiles" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "user_profiles" RENAME COLUMN "new_user_id" TO "user_id";
ALTER TABLE "refresh_tokens" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "refresh_tokens" RENAME COLUMN "new_user_id" TO "user_id";
ALTER TABLE "refresh_tokens" RENAME COLUMN "new_replaced_by_id" TO "replaced_by_id";
ALTER TABLE "categories" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "subcategories" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "subcategories" RENAME COLUMN "new_category_id" TO "category_id";
ALTER TABLE "products" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "products" RENAME COLUMN "new_subcategory_id" TO "subcategory_id";
ALTER TABLE "product_images" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "product_images" RENAME COLUMN "new_product_id" TO "product_id";
ALTER TABLE "orders" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "orders" RENAME COLUMN "new_user_id" TO "user_id";
ALTER TABLE "order_items" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "order_items" RENAME COLUMN "new_order_id" TO "order_id";
ALTER TABLE "order_items" RENAME COLUMN "new_product_id" TO "product_id";
ALTER TABLE "order_idempotency_keys" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "order_idempotency_keys" RENAME COLUMN "new_user_id" TO "user_id";
ALTER TABLE "order_idempotency_keys" RENAME COLUMN "new_order_id" TO "order_id";

-- NOT NULL on required columns
ALTER TABLE "users" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "user_profiles" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "user_profiles" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "refresh_tokens" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "refresh_tokens" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "categories" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "subcategories" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "subcategories" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "subcategory_id" SET NOT NULL;
ALTER TABLE "product_images" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "product_images" ALTER COLUMN "product_id" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "order_id" SET NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "product_id" SET NOT NULL;
ALTER TABLE "order_idempotency_keys" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "order_idempotency_keys" ALTER COLUMN "user_id" SET NOT NULL;

-- Primary keys
ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");
ALTER TABLE "categories" ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id");
ALTER TABLE "products" ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_pkey" PRIMARY KEY ("id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");
ALTER TABLE "order_idempotency_keys" ADD CONSTRAINT "order_idempotency_keys_pkey" PRIMARY KEY ("id");

-- =============================================================================
-- 6) Identity columns (matches Prisma @default(autoincrement()) on PostgreSQL)
-- =============================================================================

ALTER TABLE "users" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "user_profiles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "refresh_tokens" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "categories" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "subcategories" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "products" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "product_images" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "orders" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "order_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE "order_idempotency_keys" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY;

-- Advance each identity sequence so the next insert is MAX(id)+1 (or 1 if empty).
SELECT setval(pg_get_serial_sequence('public.users', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "users"), 1), (SELECT COUNT(*) > 0 FROM "users"));
SELECT setval(pg_get_serial_sequence('public.user_profiles', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "user_profiles"), 1), (SELECT COUNT(*) > 0 FROM "user_profiles"));
SELECT setval(pg_get_serial_sequence('public.refresh_tokens', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "refresh_tokens"), 1), (SELECT COUNT(*) > 0 FROM "refresh_tokens"));
SELECT setval(pg_get_serial_sequence('public.categories', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "categories"), 1), (SELECT COUNT(*) > 0 FROM "categories"));
SELECT setval(pg_get_serial_sequence('public.subcategories', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "subcategories"), 1), (SELECT COUNT(*) > 0 FROM "subcategories"));
SELECT setval(pg_get_serial_sequence('public.products', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "products"), 1), (SELECT COUNT(*) > 0 FROM "products"));
SELECT setval(pg_get_serial_sequence('public.product_images', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "product_images"), 1), (SELECT COUNT(*) > 0 FROM "product_images"));
SELECT setval(pg_get_serial_sequence('public.orders', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "orders"), 1), (SELECT COUNT(*) > 0 FROM "orders"));
SELECT setval(pg_get_serial_sequence('public.order_items', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "order_items"), 1), (SELECT COUNT(*) > 0 FROM "order_items"));
SELECT setval(pg_get_serial_sequence('public.order_idempotency_keys', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "order_idempotency_keys"), 1), (SELECT COUNT(*) > 0 FROM "order_idempotency_keys"));

-- =============================================================================
-- 7) Recreate FKs (same ON DELETE / ON UPDATE as before) + indexes
-- =============================================================================

ALTER TABLE "user_profiles"
  ADD CONSTRAINT "user_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subcategories"
  ADD CONSTRAINT "subcategories_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
  ADD CONSTRAINT "products_subcategory_id_fkey"
  FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_images"
  ADD CONSTRAINT "product_images_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_idempotency_keys"
  ADD CONSTRAINT "order_idempotency_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_idempotency_keys"
  ADD CONSTRAINT "order_idempotency_keys_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_replaced_by_id_idx" ON "refresh_tokens"("replaced_by_id");
CREATE INDEX "subcategories_category_id_idx" ON "subcategories"("category_id");
CREATE UNIQUE INDEX "subcategories_category_id_slug_key" ON "subcategories"("category_id", "slug");
CREATE INDEX "products_subcategory_id_idx" ON "products"("subcategory_id");
CREATE INDEX "product_images_product_id_sort_order_idx" ON "product_images"("product_id", "sort_order");
CREATE UNIQUE INDEX "product_images_product_id_sort_order_key" ON "product_images"("product_id", "sort_order");
CREATE UNIQUE INDEX "product_images_one_primary_per_product_key"
  ON "product_images"("product_id") WHERE "is_primary" = true;
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");
CREATE UNIQUE INDEX "order_idempotency_keys_order_id_key" ON "order_idempotency_keys"("order_id");
CREATE UNIQUE INDEX "order_idempotency_keys_user_id_key_key" ON "order_idempotency_keys"("user_id", "key");

-- Recreate CHECK that referenced order_id (dropped automatically with the UUID column).
-- Money/stock/currency/sort_order CHECKs and expires_after_created survive the column swap.
ALTER TABLE "order_idempotency_keys"
  ADD CONSTRAINT "order_idempotency_keys_status_order_id_check" CHECK (
    ("status" = 'PROCESSING' AND "order_id" IS NULL)
    OR
    ("status" = 'COMPLETED' AND "order_id" IS NOT NULL)
  );

-- Preserved without change (not involving UUID id columns):
--   users_email_key, users_email_lower_key, categories_slug_key,
--   products_slug_key, products_sku_key, products_status_is_available_idx,
--   refresh_tokens_token_hash_key, refresh_tokens_expires_at_idx,
--   order_idempotency_keys_expires_at_idx,
--   products_*_check, orders_*_check, order_items_*_check,
--   product_images_sort_order_nonnegative_check,
--   order_idempotency_keys_expires_after_created_check

-- =============================================================================
-- 8) Force re-login: revoke all refresh sessions (JWT sid/sub were UUID strings)
-- =============================================================================

UPDATE "refresh_tokens"
SET "revoked_at" = COALESCE("revoked_at", CURRENT_TIMESTAMP),
    "replaced_by_id" = NULL
WHERE "revoked_at" IS NULL;

COMMIT;

-- =============================================================================
-- Post-migration verification (run manually after deploy)
-- =============================================================================
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND column_name IN ('id','user_id','product_id')
-- ORDER BY 1,2;
--
-- SELECT last_value, is_called FROM users_id_seq;
-- SELECT COUNT(*) FILTER (WHERE revoked_at IS NULL) AS active_sessions FROM refresh_tokens;
-- Expect active_sessions = 0.
