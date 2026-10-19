import { Router, type Router as ExpressRouter } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { createRequireAuth } from "../../common/middlewares/auth.middleware.js";
import { requireRole } from "../../common/middlewares/require-role.middleware.js";
import { validate } from "../../common/middlewares/validate.middleware.js";
import { createUserController } from "./user.controller.js";
import {
  listUsersQuerySchema,
  updateProfileBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from "./user.schema.js";

export function createUserRouter(env: Env, prisma: Database): ExpressRouter {
  const router: ExpressRouter = Router();
  const controller = createUserController(prisma);
  const requireAuth = createRequireAuth(env, prisma);

  router.get("/me/profile", requireAuth, (req, res, next) =>
    void controller.getMyProfile(req, res, next),
  );

  router.patch(
    "/me/profile",
    requireAuth,
    validate({ body: updateProfileBodySchema }),
    (req, res, next) => void controller.updateMyProfile(req, res, next),
  );

  // Stub ADMIN-only route for authorization tests / future admin tools.
  router.get(
    "/admin/ping",
    requireAuth,
    requireRole("ADMIN"),
    (_req, res) => {
      res.status(200).json({
        status: "success",
        data: { message: "admin ok" },
      });
    },
  );

  router.get(
    "/",
    requireAuth,
    requireRole("ADMIN"),
    validate({ query: listUsersQuerySchema }),
    (req, res, next) => void controller.list(req, res, next),
  );

  router.get(
    "/:id",
    requireAuth,
    requireRole("ADMIN"),
    validate({ params: userIdParamsSchema }),
    (req, res, next) => void controller.getById(req, res, next),
  );

  router.patch(
    "/:id",
    requireAuth,
    requireRole("ADMIN"),
    validate({ params: userIdParamsSchema, body: updateUserBodySchema }),
    (req, res, next) => void controller.update(req, res, next),
  );

  return router;
}
