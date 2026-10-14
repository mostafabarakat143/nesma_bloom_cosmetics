import type { NextFunction, Request, Response } from "express";

import type { Env } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { AppError } from "../errors/app-error.js";

type ErrorBody = {
  status: "error";
  message: string;
  code: string;
  details?: Array<{ path: string; message: string }>;
  requestId?: string;
};

export function createErrorMiddleware(env: Env, logger: Logger) {
  return function errorMiddleware(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    const requestId = req.requestId;

    if (isJsonSyntaxError(err)) {
      const body: ErrorBody = {
        status: "error",
        message: "Malformed JSON in request body",
        code: "BAD_REQUEST",
        requestId,
      };
      res.status(400).json(body);
      return;
    }

    if (err instanceof AppError) {
      if (!err.isOperational || err.statusCode >= 500) {
        logger.error({ err, requestId }, err.message);
      } else {
        logger.warn({ err, requestId, code: err.code }, err.message);
      }

      const body: ErrorBody = {
        status: "error",
        message: err.message,
        code: err.code,
        requestId,
      };

      if (err.details && err.details.length > 0) {
        body.details = err.details;
      }

      res.status(err.statusCode).json(body);
      return;
    }

    if (isDatabaseUnavailableError(err)) {
      logger.error({ err: sanitizeError(err), requestId }, "Database unavailable");
      const body: ErrorBody = {
        status: "error",
        message: "Service temporarily unavailable",
        code: "SERVICE_UNAVAILABLE",
        requestId,
      };
      res.status(503).json(body);
      return;
    }

    logger.error({ err: sanitizeError(err), requestId }, "Unhandled error");

    const body: ErrorBody = {
      status: "error",
      message:
        env.NODE_ENV === "production"
          ? "Internal server error"
          : err instanceof Error
            ? err.message
            : "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      requestId,
    };

    res.status(500).json(body);
  };
}

function isJsonSyntaxError(err: unknown): boolean {
  if (!(err instanceof SyntaxError)) {
    return false;
  }

  return "body" in err || "status" in err || "statusCode" in err;
}

export function isDatabaseUnavailableError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }

  const code =
    "code" in err && typeof (err as { code: unknown }).code === "string"
      ? (err as { code: string }).code
      : undefined;

  if (
    code === "P1001" ||
    code === "P1017" ||
    code === "P1000" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "57P01" ||
    code === "57P03"
  ) {
    return true;
  }

  const message =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

  return (
    message.includes("can't reach database") ||
    message.includes("connection refused") ||
    message.includes("connection terminated") ||
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("the database system is starting up") ||
    message.includes("server closed the connection")
  );
}

function sanitizeError(error: unknown): { name?: string; message: string } {
  if (!(error instanceof Error)) {
    return { message: "Unknown error" };
  }

  const message = error.message
    .replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://***:***@")
    .replace(/postgres:\/\/[^@\s]+@/gi, "postgresql://***:***@")
    .replace(/password=[^&\s]+/gi, "password=***");

  return { name: error.name, message };
}
