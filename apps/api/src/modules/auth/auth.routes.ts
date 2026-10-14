import { Router, type Router as ExpressRouter } from "express";
import rateLimit from "express-rate-limit";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { createRequireAuth } from "../../common/middlewares/auth.middleware.js";
import { validate } from "../../common/middlewares/validate.middleware.js";
import { createAuthController } from "./auth.controller.js";
import { loginBodySchema, registerBodySchema } from "./auth.schema.js";

export function createAuthRouter(env: Env, prisma: Database): ExpressRouter {
  const router: ExpressRouter = Router();
  const controller = createAuthController(env, prisma);
  const requireAuth = createRequireAuth(env, prisma);

  const authLimiter = rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: "error",
      message: "Too many authentication attempts",
      code: "TOO_MANY_REQUESTS",
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

  router.post("/logout", (req, res, next) =>
    void controller.logout(req, res, next),
  );

  router.post("/refresh", (req, res, next) =>
    void controller.refresh(req, res, next),
  );

  router.get("/me", requireAuth, (req, res, next) =>
    void controller.me(req, res, next),
  );

  return router;
}
