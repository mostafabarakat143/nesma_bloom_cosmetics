import { Router, type Router as ExpressRouter } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { createRequireAuth } from "../../common/middlewares/auth.middleware.js";
import { createOptionalAuth } from "../../common/middlewares/optional-auth.middleware.js";
import { requireRole } from "../../common/middlewares/require-role.middleware.js";
import { validate } from "../../common/middlewares/validate.middleware.js";
import { createCategoryController } from "./category.controller.js";
import {
  categoryIdParamsSchema,
  createCategoryBodySchema,
  listCategoriesQuerySchema,
  updateCategoryBodySchema,
} from "./category.schema.js";

export function createCategoryRouter(
  env: Env,
  prisma: Database,
): ExpressRouter {
  const router: ExpressRouter = Router();
  const controller = createCategoryController(prisma);
  const optionalAuth = createOptionalAuth(env, prisma);
  const requireAuth = createRequireAuth(env, prisma);

  router.get(
    "/",
    optionalAuth,
    validate({ query: listCategoriesQuerySchema }),
    (req, res, next) => void controller.list(req, res, next),
  );

  router.get(
    "/:id",
    optionalAuth,
    validate({ params: categoryIdParamsSchema }),
    (req, res, next) => void controller.getById(req, res, next),
  );

  router.post(
    "/",
    requireAuth,
    requireRole("ADMIN"),
    validate({ body: createCategoryBodySchema }),
    (req, res, next) => void controller.create(req, res, next),
  );

  router.patch(
    "/:id",
    requireAuth,
    requireRole("ADMIN"),
    validate({
      params: categoryIdParamsSchema,
      body: updateCategoryBodySchema,
    }),
    (req, res, next) => void controller.update(req, res, next),
  );

  router.delete(
    "/:id",
    requireAuth,
    requireRole("ADMIN"),
    validate({ params: categoryIdParamsSchema }),
    (req, res, next) => void controller.archive(req, res, next),
  );

  return router;
}
