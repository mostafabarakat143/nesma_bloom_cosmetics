import type { Server } from "node:http";

import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./config/logger.js";

const env = loadEnv();
const logger = createLogger(env);
const app = createApp({ env, logger });

const server: Server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT },
    `Nesma Bloom Cosmetics API listening on http://localhost:${env.PORT}`,
  );
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down gracefully");

  server.close((closeError) => {
    if (closeError) {
      logger.error({ err: closeError }, "Error during server close");
      process.exit(1);
    }

    logger.info("HTTP server closed");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled rejection");
  process.exit(1);
});
