import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

import { AppError } from "../errors/app-error.js";
import { formatZodErrorMessage } from "../errors/zod-message.js";

type RequestSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        const parsed = schemas.body.safeParse(req.body);
        if (!parsed.success) {
          throw validationError(parsed.error);
        }
        req.body = parsed.data;
      }

      if (schemas.params) {
        const parsed = schemas.params.safeParse(req.params);
        if (!parsed.success) {
          throw validationError(parsed.error);
        }
        Object.assign(req.params, parsed.data);
      }

      if (schemas.query) {
        const parsed = schemas.query.safeParse(req.query);
        if (!parsed.success) {
          throw validationError(parsed.error);
        }
        Object.defineProperty(req, "query", {
          value: parsed.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function validationError(error: {
  issues: Array<{ path: PropertyKey[]; message: string; code: string }>;
}): AppError {
  const details = error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));

  return AppError.badRequest(
    formatZodErrorMessage(error),
    details,
    "VALIDATION_ERROR",
  );
}
