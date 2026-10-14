/** Shared minimal env overrides for unit tests that call loadEnv directly. */
export const baseTestEnvVars: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
  JWT_ACCESS_SECRET: "test-secret-must-be-at-least-32-chars-long",
  JWT_ACCESS_TTL_SECONDS: "900",
  REFRESH_TOKEN_TTL_SECONDS: "604800",
  COOKIE_SECURE: "false",
  AUTH_RATE_LIMIT_WINDOW_MS: "900000",
  AUTH_RATE_LIMIT_MAX: "20",
  CORS_ORIGIN: "http://localhost:3000",
};
