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

    logger.error({ err, requestId }, "Unhandled error");

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
