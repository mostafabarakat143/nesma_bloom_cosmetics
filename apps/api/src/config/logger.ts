import pino from "pino";

import type { Env } from "./env.js";

export function createLogger(env: Env) {
  return pino({
    level: env.LOG_LEVEL,
    base: {
      service: "@cosmetics/api",
      env: env.NODE_ENV,
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "password",
        "passwordHash",
        "pass",
        "SMTP_PASS",
        "token",
        "accessToken",
      ],
      remove: true,
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
