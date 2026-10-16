import type { Request, Response, NextFunction } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import type { LoginBody, RegisterBody } from "./auth.schema.js";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from "./auth.service.js";

export function createAuthController(env: Env, prisma: Database) {
  return {
    async register(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = req.body as RegisterBody;
        const result = await registerUser(prisma, env, body);
        res.status(201).json({
          status: "success",
          data: { user: result.user, token: result.token },
        });
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
        const result = await loginUser(prisma, env, body);
        res.status(200).json({
          status: "success",
          data: { user: result.user, token: result.token },
        });
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
        const user = req.user;
        if (!user?.jti || user.exp === undefined) {
          throw AppError.unauthorized("Authentication required");
        }

        await logoutUser(prisma, {
          userId: user.id,
          jti: user.jti,
          exp: user.exp,
        });

        res.status(200).json({
          status: "success",
          data: { message: "Logged out" },
        });
      } catch (error) {
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
