import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import {
  authenticateBearerRequest,
  extractBearerToken,
} from "../../modules/auth/token.service.js";

export function createOptionalAuth(env: Env, prisma: Database) {
  return async function optionalAuth(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const token = extractBearerToken(req.get("authorization"));
      if (!token) {
        next();
        return;
      }

      const principal = await authenticateBearerRequest(env, prisma, token);
      req.user = {
        id: principal.id,
        role: principal.role,
        jti: principal.jti,
        exp: principal.exp,
      };

      next();
    } catch (error) {

      next(error);
    }
  };
}
