import type { NextFunction, Request, Response } from "express";

import type { Env } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { AppError } from "../errors/app-error.js";

type PublicErrorBody = {
  status: "error";
  message: string;
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
      logger.warn({ requestId, code: "BAD_REQUEST" }, "Malformed JSON in request body");
      sendError(res, 400, "Malformed JSON in request body.");
      return;
    }

    if (err instanceof AppError) {
      if (!err.isOperational || err.statusCode >= 500) {
        logger.error(
          { err, requestId, code: err.code, details: err.details },
          err.message,
        );
      } else {
        logger.warn(
          { err, requestId, code: err.code, details: err.details },
          err.message,
        );
      }

      sendError(res, err.statusCode, publicMessage(err));
      return;
    }

    if (isDatabaseUnavailableError(err)) {
      logger.error({ err: sanitizeError(err), requestId, code: "SERVICE_UNAVAILABLE" }, "Database unavailable");
      sendError(res, 503, "Service temporarily unavailable.");
      return;
    }

    logger.error(
      { err: sanitizeError(err), requestId, code: "INTERNAL_SERVER_ERROR" },
      "Unhandled error",
    );

    // Never leak internals (including development Error.message) to clients.
    void env;
    sendError(res, 500, "Internal server error.");
  };
}

function sendError(res: Response, statusCode: number, message: string): void {
  const body: PublicErrorBody = {
    status: "error",
    message,
  };
  res.status(statusCode).json(body);
}

function publicMessage(err: AppError): string {
  if (!err.isOperational || err.statusCode >= 500) {
    return "Internal server error.";
  }
  const trimmed = err.message.trim();
  if (!trimmed) {
    return "Request failed.";
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
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
