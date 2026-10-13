import { createApp } from "../../src/app.js";
import { loadEnv, type Env } from "../../src/config/env.js";
import { createLogger } from "../../src/config/logger.js";

export function buildTestApp(envOverrides: Partial<NodeJS.ProcessEnv> = {}) {
  const env: Env = loadEnv({
    NODE_ENV: "test",
    PORT: "4000",
    LOG_LEVEL: "silent",
    CORS_ORIGIN: "",
    BODY_SIZE_LIMIT: "100kb",
    RATE_LIMIT_WINDOW_MS: "900000",
    RATE_LIMIT_MAX: "100",
    ...envOverrides,
  });

  const logger = createLogger(env);
  return createApp({ env, logger });
}
