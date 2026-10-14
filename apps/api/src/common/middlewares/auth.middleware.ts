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
 * Verifies access JWT, then checks refresh_tokens + live user status/role.
 * Role for authorization always comes from PostgreSQL, not the JWT claim.
 */
export function createRequireAuth(env: Env, prisma: Database) {
  return async function requireAuth(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
      if (!token) {
        throw AppError.unauthorized("Authentication required");
      }

      const claims = await verifyAccessToken(env, token);
      const session = await assertSessionActive(prisma, claims.sid, claims.sub);

      req.user = {
        id: claims.sub,
        role: session.role,
        sessionId: claims.sid,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
