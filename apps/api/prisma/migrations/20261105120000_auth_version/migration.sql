-- Reject old JWTs by account version instead of comparing second/millisecond clocks.
-- Existing JWTs without an authVersion claim require a new login after deployment.
ALTER TABLE "users"
  ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "users"
  ADD CONSTRAINT "users_auth_version_nonnegative_check"
  CHECK ("auth_version" >= 0);
