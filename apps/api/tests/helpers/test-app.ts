import { createApp } from "../../src/app.js";
import type { PasswordResetMailer } from "../../src/modules/auth/password-reset.mailer.js";
import {
  createPrismaClient,
  type Database,
} from "../../src/config/database.js";
import { loadEnv, type Env } from "../../src/config/env.js";
import { createLogger } from "../../src/config/logger.js";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  "postgresql://nesma:change_me@127.0.0.1:5432/nesma_bloom_test?schema=public";

export function buildTestEnv(
  envOverrides: Partial<NodeJS.ProcessEnv> = {},
): Env {
  return loadEnv({
    NODE_ENV: "test",
    PORT: "4000",
    LOG_LEVEL: "silent",
    CORS_ORIGIN: "http://localhost:3000",
    BODY_SIZE_LIMIT: "100kb",
    RATE_LIMIT_WINDOW_MS: "900000",
    RATE_LIMIT_MAX: "100",
    DATABASE_URL: TEST_DATABASE_URL,
    JWT_ACCESS_SECRET: "test-secret-must-be-at-least-32-chars-long",
    JWT_TTL_SECONDS: "604800",
    JWT_ISSUER: "nesma-bloom-api",
    JWT_AUDIENCE: "nesma-bloom-clients",
    AUTH_RATE_LIMIT_WINDOW_MS: "900000",
    AUTH_RATE_LIMIT_MAX: "20",
    ...envOverrides,
  });
}

export function buildTestApp(
  envOverrides: Partial<NodeJS.ProcessEnv> = {},
  prisma?: Database,
  mailer?: PasswordResetMailer,
) {
  const env = buildTestEnv(envOverrides);
  const logger = createLogger(env);
  const db = prisma ?? createPrismaClient(env);
  return {
    app: createApp({ env, logger, prisma: db, mailer }),
    env,
    prisma: db,
    logger,
  };
}

export { TEST_DATABASE_URL };
