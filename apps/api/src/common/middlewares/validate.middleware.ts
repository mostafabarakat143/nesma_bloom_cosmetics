import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

import { AppError } from "../errors/app-error.js";

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
          throw AppError.badRequest("Validation failed", formatIssues(parsed.error), "VALIDATION_ERROR");
        }
        req.body = parsed.data;
      }

      if (schemas.params) {
        const parsed = schemas.params.safeParse(req.params);
        if (!parsed.success) {
          throw AppError.badRequest("Validation failed", formatIssues(parsed.error), "VALIDATION_ERROR");
        }
        Object.assign(req.params, parsed.data);
      }

      if (schemas.query) {
        const parsed = schemas.query.safeParse(req.query);
        if (!parsed.success) {
          throw AppError.badRequest("Validation failed", formatIssues(parsed.error), "VALIDATION_ERROR");
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

function formatIssues(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));
}
