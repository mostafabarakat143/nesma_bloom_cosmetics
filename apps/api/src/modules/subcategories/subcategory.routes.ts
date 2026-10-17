import { Router, type Router as ExpressRouter } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { createRequireAuth } from "../../common/middlewares/auth.middleware.js";
import { createOptionalAuth } from "../../common/middlewares/optional-auth.middleware.js";
import { requireRole } from "../../common/middlewares/require-role.middleware.js";
import { validate } from "../../common/middlewares/validate.middleware.js";
import { createSubcategoryController } from "./subcategory.controller.js";
import {
  createSubcategoryBodySchema,
  listSubcategoriesQuerySchema,
  subcategoryIdParamsSchema,
  updateSubcategoryBodySchema,
} from "./subcategory.schema.js";

export function createSubcategoryRouter(
  env: Env,
  prisma: Database,
): ExpressRouter {
  const router: ExpressRouter = Router();
  const controller = createSubcategoryController(prisma);
  const optionalAuth = createOptionalAuth(env, prisma);
  const requireAuth = createRequireAuth(env, prisma);

  router.get(
    "/",
    optionalAuth,
    validate({ query: listSubcategoriesQuerySchema }),
    (req, res, next) => void controller.list(req, res, next),
  );

  router.get(
    "/:id",
    optionalAuth,
    validate({ params: subcategoryIdParamsSchema }),
    (req, res, next) => void controller.getById(req, res, next),
  );

  router.post(
    "/",
    requireAuth,
    requireRole("ADMIN"),
    validate({ body: createSubcategoryBodySchema }),
    (req, res, next) => void controller.create(req, res, next),
  );

  router.patch(
    "/:id",
    requireAuth,
    requireRole("ADMIN"),
    validate({
      params: subcategoryIdParamsSchema,
      body: updateSubcategoryBodySchema,
    }),
    (req, res, next) => void controller.update(req, res, next),
  );

  router.delete(
    "/:id",
    requireAuth,
    requireRole("ADMIN"),
    validate({ params: subcategoryIdParamsSchema }),
    (req, res, next) => void controller.archive(req, res, next),
  );

  return router;
}
