import { Router, type Router as ExpressRouter } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { createRequireAuth } from "../../common/middlewares/auth.middleware.js";
import { requireRole } from "../../common/middlewares/require-role.middleware.js";
import { createUploadController } from "./upload.controller.js";

export function createUploadRouter(env: Env, prisma: Database): ExpressRouter {
  const router: ExpressRouter = Router();
  const controller = createUploadController(env);
  const requireAuth = createRequireAuth(env, prisma);

  router.post("/images", requireAuth, requireRole("ADMIN"), (req, res, next) =>
    void controller.uploadCatalog(req, res, next),
  );

  return router;
}
