import { Router, type Router as ExpressRouter } from "express";
import rateLimit from "express-rate-limit";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import {
  createRequireAuth,
  createRequireAuthForLogout,
} from "../../common/middlewares/auth.middleware.js";
import { validate } from "../../common/middlewares/validate.middleware.js";
import { createAuthController } from "./auth.controller.js";
import {
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from "./auth.schema.js";
import type { PasswordResetMailer } from "./password-reset.mailer.js";

export function createAuthRouter(
  env: Env,
  prisma: Database,
  logger: Logger,
  mailer: PasswordResetMailer,
): ExpressRouter {
  const router: ExpressRouter = Router();
  const controller = createAuthController(env, prisma, logger, mailer);
  const requireAuth = createRequireAuth(env, prisma);
  const requireAuthForLogout = createRequireAuthForLogout(env, prisma);

  const authLimiter = rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: "error",
      message: "Too many authentication attempts.",
    },
    skip: () => env.NODE_ENV === "test",
  });

  router.post(
    "/register",
    authLimiter,
    validate({ body: registerBodySchema }),
    (req, res, next) => void controller.register(req, res, next),
  );

  router.post(
    "/login",
    authLimiter,
    validate({ body: loginBodySchema }),
    (req, res, next) => void controller.login(req, res, next),
  );

  router.post(
    "/change-password",
    requireAuth,
    validate({ body: changePasswordBodySchema }),
    (req, res, next) => void controller.changePassword(req, res, next),
  );

  router.post(
    "/forgot-password",
    authLimiter,
    validate({ body: forgotPasswordBodySchema }),
    (req, res, next) => void controller.forgotPassword(req, res, next),
  );

  router.post(
    "/reset-password",
    authLimiter,
    validate({ body: resetPasswordBodySchema }),
    (req, res, next) => void controller.resetPassword(req, res, next),
  );

  router.post("/logout", requireAuthForLogout, (req, res, next) =>
    void controller.logout(req, res, next),
  );

  router.get("/me", requireAuth, (req, res, next) =>
    void controller.me(req, res, next),
  );

  return router;
}
