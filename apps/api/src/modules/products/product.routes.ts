import { Router, type Router as ExpressRouter } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { createRequireAuth } from "../../common/middlewares/auth.middleware.js";
import { createOptionalAuth } from "../../common/middlewares/optional-auth.middleware.js";
import { requireRole } from "../../common/middlewares/require-role.middleware.js";
import { validate } from "../../common/middlewares/validate.middleware.js";
import { createProductController } from "./product.controller.js";
import {
  createProductBodySchema,
  createProductImageBodySchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  productImageParamsSchema,
  updateProductBodySchema,
  updateProductImageBodySchema,
} from "./product.schema.js";

export function createProductRouter(
  env: Env,
  prisma: Database,
): ExpressRouter {
  const router: ExpressRouter = Router();
  const controller = createProductController(env, prisma);
  const optionalAuth = createOptionalAuth(env, prisma);
  const requireAuth = createRequireAuth(env, prisma);

  router.get(
    "/",
    optionalAuth,
    validate({ query: listProductsQuerySchema }),
    (req, res, next) => void controller.list(req, res, next),
  );

  router.get(
    "/:id",
    optionalAuth,
    validate({ params: productIdParamsSchema }),
    (req, res, next) => void controller.getById(req, res, next),
  );

  router.post(
    "/",
    requireAuth,
    requireRole("ADMIN"),
    validate({ body: createProductBodySchema }),
    (req, res, next) => void controller.create(req, res, next),
  );

  router.patch(
    "/:id",
    requireAuth,
    requireRole("ADMIN"),
    validate({
      params: productIdParamsSchema,
      body: updateProductBodySchema,
    }),
    (req, res, next) => void controller.update(req, res, next),
  );

  router.delete(
    "/:id",
    requireAuth,
    requireRole("ADMIN"),
    validate({ params: productIdParamsSchema }),
    (req, res, next) => void controller.archive(req, res, next),
  );

  router.post(
    "/:id/images",
    requireAuth,
    requireRole("ADMIN"),
    validate({
      params: productIdParamsSchema,
      body: createProductImageBodySchema,
    }),
    (req, res, next) => void controller.addImage(req, res, next),
  );

  router.patch(
    "/:id/images/:imageId",
    requireAuth,
    requireRole("ADMIN"),
    validate({
      params: productImageParamsSchema,
      body: updateProductImageBodySchema,
    }),
    (req, res, next) => void controller.updateImage(req, res, next),
  );

  router.delete(
    "/:id/images/:imageId",
    requireAuth,
    requireRole("ADMIN"),
    validate({ params: productImageParamsSchema }),
    (req, res, next) => void controller.deleteImage(req, res, next),
  );

  return router;
}
