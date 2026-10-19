import { Router, type Router as ExpressRouter } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { createRequireAuth } from "../../common/middlewares/auth.middleware.js";
import { requireRole } from "../../common/middlewares/require-role.middleware.js";
import { validate } from "../../common/middlewares/validate.middleware.js";
import { createContactController } from "./contact.controller.js";
import {
  createContactBodySchema,
  listContactQuerySchema,
} from "./contact.schema.js";

export function createContactRouter(env: Env, prisma: Database): ExpressRouter {
  const router: ExpressRouter = Router();
  const controller = createContactController(prisma);
  const requireAuth = createRequireAuth(env, prisma);

  router.post(
    "/",
    validate({ body: createContactBodySchema }),
    (req, res, next) => void controller.create(req, res, next),
  );

  router.get(
    "/",
    requireAuth,
    requireRole("ADMIN"),
    validate({ query: listContactQuerySchema }),
    (req, res, next) => void controller.list(req, res, next),
  );

  return router;
}
