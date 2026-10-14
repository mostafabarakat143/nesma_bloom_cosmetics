import type { Request, Response, NextFunction } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { REFRESH_COOKIE } from "../../common/constants/cookies.js";
import { clearAuthCookies, setAuthCookies } from "./cookie.service.js";
import type { LoginBody, RegisterBody } from "./auth.schema.js";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshAuthSession,
  registerUser,
} from "./auth.service.js";

function requestMeta(req: Request) {
  return {
    userAgent: req.get("user-agent") ?? undefined,
    ipAddress: req.ip,
  };
}

export function createAuthController(env: Env, prisma: Database) {
  return {
    async register(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = req.body as RegisterBody;
        const result = await registerUser(prisma, env, body, requestMeta(req));
        setAuthCookies(res, env, result.tokens);
        res.status(201).json({ status: "success", data: { user: result.user } });
      } catch (error) {
        next(error);
      }
    },

    async login(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = req.body as LoginBody;
        const result = await loginUser(prisma, env, body, requestMeta(req));
        setAuthCookies(res, env, result.tokens);
        res.status(200).json({ status: "success", data: { user: result.user } });
      } catch (error) {
        next(error);
      }
    },

    async logout(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
        await logoutUser(prisma, {
          rawRefreshToken: refreshToken,
          sessionId: req.user?.sessionId,
        });
        clearAuthCookies(res, env);
        res.status(200).json({
          status: "success",
          data: { message: "Logged out" },
        });
      } catch (error) {
        next(error);
      }
    },

    async refresh(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
        const result = await refreshAuthSession(
          prisma,
          env,
          refreshToken,
          requestMeta(req),
        );
        setAuthCookies(res, env, result.tokens);
        res.status(200).json({ status: "success", data: { user: result.user } });
      } catch (error) {
        clearAuthCookies(res, env);
        next(error);
      }
    },

    async me(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const user = await getCurrentUser(prisma, req.user!.id);
        res.status(200).json({ status: "success", data: { user } });
      } catch (error) {
        next(error);
      }
    },
  };
}
