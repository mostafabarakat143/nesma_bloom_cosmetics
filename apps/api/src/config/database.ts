import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";
import type { Env } from "./env.js";
import type { Logger } from "./logger.js";

export type Database = PrismaClient;

export function createPrismaClient(env: Env): Database {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export async function connectDatabase(
  prisma: Database,
  logger: Logger,
): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info("Database connection established");
  } catch (error) {
    logger.fatal(
      { err: sanitizeDbError(error) },
      "Database connection failed during startup",
    );
    throw new Error(
      "Failed to connect to PostgreSQL. Ensure Docker Postgres is running and DATABASE_URL is correct.",
      { cause: sanitizeDbError(error) },
    );
  }
}

export async function disconnectDatabase(
  prisma: Database,
  logger: Logger,
): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info("Database connection closed");
  } catch (error) {
    logger.error(
      { err: sanitizeDbError(error) },
      "Error while closing database connection",
    );
  }
}

/**
 * Avoid leaking credentials from driver/Prisma error messages into logs.
 */
function sanitizeDbError(error: unknown): { name?: string; message: string } {
  if (!(error instanceof Error)) {
    return { message: "Unknown database error" };
  }

  const message = error.message
    .replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://***:***@")
    .replace(/postgres:\/\/[^@\s]+@/gi, "postgres://***:***@")
    .replace(/password=[^&\s]+/gi, "password=***");

  return {
    name: error.name,
    message,
  };
}
