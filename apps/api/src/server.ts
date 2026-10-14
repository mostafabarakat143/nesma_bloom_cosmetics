import "dotenv/config";

import type { Server } from "node:http";

import { createApp } from "./app.js";
import {
  connectDatabase,
  createPrismaClient,
  disconnectDatabase,
} from "./config/database.js";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./config/logger.js";

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const prisma = createPrismaClient(env);

  await connectDatabase(prisma, logger);

  const app = createApp({ env, logger, prisma });

  const server: Server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT },
      `Nesma Bloom Cosmetics API listening on http://localhost:${env.PORT}`,
    );
  });

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    logger.info({ signal }, "Shutting down gracefully");

    server.close(async (closeError) => {
      if (closeError) {
        logger.error({ err: closeError }, "Error during server close");
        await disconnectDatabase(prisma, logger);
        process.exit(1);
      }

      logger.info("HTTP server closed");
      await disconnectDatabase(prisma, logger);
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  // Windows consoles may deliver Ctrl+Break as SIGBREAK.
  process.on("SIGBREAK", () => {
    void shutdown("SIGBREAK");
  });

  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
    void disconnectDatabase(prisma, logger).finally(() => process.exit(1));
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Unhandled rejection");
    void disconnectDatabase(prisma, logger).finally(() => process.exit(1));
  });
}

bootstrap().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Failed to start API server",
  );
  process.exit(1);
});
