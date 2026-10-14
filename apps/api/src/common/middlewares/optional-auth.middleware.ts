import type { NextFunction, Request, Response } from "express";

import { ACCESS_COOKIE } from "../constants/cookies.js";
import { AppError } from "../errors/app-error.js";
import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import {
  assertSessionActive,
  verifyAccessToken,
} from "../../modules/auth/token.service.js";

/**
 * If an access cookie is present, fully verify JWT + session.
 * If absent, continue as anonymous. Never trusts unverified cookie claims.
 */
export function createOptionalAuth(env: Env, prisma: Database) {
  return async function optionalAuth(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
      if (!token) {
        next();
        return;
      }

      const claims = await verifyAccessToken(env, token);
      await assertSessionActive(prisma, claims.sid, claims.sub);

      req.user = {
        id: claims.sub,
        role: claims.role,
        sessionId: claims.sid,
      };

      next();
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 401) {
        next(error);
        return;
      }
      next(AppError.unauthorized("Authentication required"));
    }
  };
}
