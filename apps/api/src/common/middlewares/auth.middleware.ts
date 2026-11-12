import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error.js";
import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import {
  authenticateBearerForLogout,
  authenticateBearerRequest,
  extractBearerToken,
} from "../../modules/auth/token.service.js";

export function createRequireAuth(env: Env, prisma: Database) {
  return async function requireAuth(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const token = extractBearerToken(req.get("authorization"));
      if (!token) {
        throw AppError.unauthorized("Authentication required");
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

export function createRequireAuthForLogout(env: Env, prisma: Database) {
  return async function requireAuthForLogout(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const token = extractBearerToken(req.get("authorization"));
      if (!token) {
        throw AppError.unauthorized("Authentication required");
      }

      const principal = await authenticateBearerForLogout(env, prisma, token);
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
