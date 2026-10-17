-- Step 22: refresh rotation marker + order idempotency (additive only)

-- ---------------------------------------------------------------------------
-- Refresh token rotation marker (H2)
-- ---------------------------------------------------------------------------
ALTER TABLE "refresh_tokens"
  ADD COLUMN "replaced_by_id" UUID;

CREATE INDEX "refresh_tokens_replaced_by_id_idx"
  ON "refresh_tokens"("replaced_by_id");

-- ---------------------------------------------------------------------------
-- Order idempotency (H3)
-- ---------------------------------------------------------------------------
CREATE TYPE "idempotency_record_status" AS ENUM ('PROCESSING', 'COMPLETED');

CREATE TABLE "order_idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" "idempotency_record_status" NOT NULL DEFAULT 'PROCESSING',
    "order_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_idempotency_keys_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "order_idempotency_keys_status_order_id_check" CHECK (
      ("status" = 'PROCESSING' AND "order_id" IS NULL)
      OR
      ("status" = 'COMPLETED' AND "order_id" IS NOT NULL)
    ),

    CONSTRAINT "order_idempotency_keys_expires_after_created_check" CHECK (
      "expires_at" > "created_at"
    )
);

CREATE UNIQUE INDEX "order_idempotency_keys_order_id_key"
  ON "order_idempotency_keys"("order_id");

CREATE UNIQUE INDEX "order_idempotency_keys_user_id_key_key"
  ON "order_idempotency_keys"("user_id", "key");

CREATE INDEX "order_idempotency_keys_expires_at_idx"
  ON "order_idempotency_keys"("expires_at");

ALTER TABLE "order_idempotency_keys"
  ADD CONSTRAINT "order_idempotency_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_idempotency_keys"
  ADD CONSTRAINT "order_idempotency_keys_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
