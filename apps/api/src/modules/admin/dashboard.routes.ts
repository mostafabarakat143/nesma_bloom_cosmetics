import { Router, type Router as ExpressRouter } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { createRequireAuth } from "../../common/middlewares/auth.middleware.js";
import { requireRole } from "../../common/middlewares/require-role.middleware.js";
import { validate } from "../../common/middlewares/validate.middleware.js";
import { createDashboardController } from "./dashboard.controller.js";
import { dashboardQuerySchema } from "./dashboard.schema.js";

export function createDashboardRouter(
  env: Env,
  prisma: Database,
): ExpressRouter {
  const router: ExpressRouter = Router();
  const controller = createDashboardController(prisma);
  const requireAuth = createRequireAuth(env, prisma);

  router.get(
    "/dashboard",
    requireAuth,
    requireRole("ADMIN"),
    validate({ query: dashboardQuerySchema }),
    (req, res, next) => void controller.get(req, res, next),
  );

  return router;
}
