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
 * Verifies access JWT, then checks refresh_tokens row by sid.
 * Extra cost per protected request: 1 indexed PK lookup (immediate logout).
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
      await assertSessionActive(prisma, claims.sid, claims.sub);

      req.user = {
        id: claims.sub,
        role: claims.role,
        sessionId: claims.sid,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
