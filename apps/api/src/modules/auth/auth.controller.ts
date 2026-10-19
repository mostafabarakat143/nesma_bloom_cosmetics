import type { Request, Response, NextFunction } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import type { Logger } from "../../config/logger.js";
import type { LoginBody, RegisterBody, ChangePasswordBody, ForgotPasswordBody, ResetPasswordBody } from "./auth.schema.js";
import type { PasswordResetMailer } from "./password-reset.mailer.js";
import {
  changePassword,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "./auth.service.js";

export function createAuthController(
  env: Env,
  prisma: Database,
  logger: Logger,
  mailer: PasswordResetMailer,
) {
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

    async changePassword(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = req.body as ChangePasswordBody;
        await changePassword(prisma, req.user!.id, body);
        res.status(200).json({
          status: "success",
          data: { message: "Password changed. Please log in again." },
        });
      } catch (error) {
        next(error);
      }
    },

    async forgotPassword(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = req.body as ForgotPasswordBody;
        const message = await requestPasswordReset(
          prisma,
          env,
          logger,
          mailer,
          body,
        );
        res.status(200).json({ status: "success", data: { message } });
      } catch (error) {
        next(error);
      }
    },

    async resetPassword(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = req.body as ResetPasswordBody;
        await resetPassword(prisma, body);
        res.status(200).json({
          status: "success",
          data: { message: "Password has been reset. Please log in." },
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
