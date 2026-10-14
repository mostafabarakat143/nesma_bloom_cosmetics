import { Router, type Router as ExpressRouter } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { createRequireAuth } from "../../common/middlewares/auth.middleware.js";
import { requireRole } from "../../common/middlewares/require-role.middleware.js";
import { validate } from "../../common/middlewares/validate.middleware.js";
import { createOrderController } from "./order.controller.js";
import {
  createOrderBodySchema,
  listMyOrdersQuerySchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  updateOrderStatusBodySchema,
} from "./order.schema.js";

export function createOrderRouter(env: Env, prisma: Database): ExpressRouter {
  const router: ExpressRouter = Router();
  const controller = createOrderController(prisma);
  const requireAuth = createRequireAuth(env, prisma);

  router.post(
    "/",
    requireAuth,
    requireRole("CUSTOMER"),
    validate({ body: createOrderBodySchema }),
    (req, res, next) => void controller.create(req, res, next),
  );

  router.get(
    "/my",
    requireAuth,
    validate({ query: listMyOrdersQuerySchema }),
    (req, res, next) => void controller.listMine(req, res, next),
  );

  router.get(
    "/",
    requireAuth,
    requireRole("ADMIN"),
    validate({ query: listOrdersQuerySchema }),
    (req, res, next) => void controller.listAll(req, res, next),
  );

  router.get(
    "/:id",
    requireAuth,
    validate({ params: orderIdParamsSchema }),
    (req, res, next) => void controller.getById(req, res, next),
  );

  router.post(
    "/:id/cancel",
    requireAuth,
    validate({ params: orderIdParamsSchema }),
    (req, res, next) => void controller.cancel(req, res, next),
  );

  router.patch(
    "/:id/status",
    requireAuth,
    requireRole("ADMIN"),
    validate({
      params: orderIdParamsSchema,
      body: updateOrderStatusBodySchema,
    }),
    (req, res, next) => void controller.updateStatus(req, res, next),
  );

  return router;
}
