import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error.js";
import type { UserRole } from "../../generated/prisma/client.js";

export function requireRole(...roles: UserRole[]) {
  return function requireRoleMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    if (!req.user) {
      next(AppError.unauthorized("Authentication required"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden("Insufficient permissions"));
      return;
    }

    next();
  };
}
