import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
import { uncachedCatalog, type CatalogCache } from "../../common/cache/catalog-cache.js";
import type {
  CreateOrderBody,
  ListMyOrdersQuery,
  ListOrdersQuery,
  UpdateOrderStatusBody,
} from "./order.schema.js";
import {
  cancelOrderService,
  createOrderService,
  getOrderById,
  listAllOrders,
  listMyOrders,
  updateOrderStatusService,
} from "./order.service.js";

export function createOrderController(prisma: Database, cache: CatalogCache = uncachedCatalog) {
  return {
    async create(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = req.body as CreateOrderBody;
        const result = await cache.write(() => createOrderService(
          prisma,
          req.user!,
          body,
          req.get("Idempotency-Key"),
        ));
        res
          .status(result.created ? 201 : 200)
          .json({ status: "success", data: { order: result.order } });
      } catch (error) {
        next(error);
      }
    },

    async listMine(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const query = req.query as unknown as ListMyOrdersQuery;
        const data = await listMyOrders(prisma, req.user!, query);
        res.status(200).json({ status: "success", data });
      } catch (error) {
        next(error);
      }
    },

    async listAll(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const query = req.query as unknown as ListOrdersQuery;
        const data = await listAllOrders(prisma, query);
        res.status(200).json({ status: "success", data });
      } catch (error) {
        next(error);
      }
    },

    async getById(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const { id } = req.params as unknown as { id: number };
        const order = await getOrderById(prisma, id, req.user!);
        res.status(200).json({ status: "success", data: { order } });
      } catch (error) {
        next(error);
      }
    },

    async cancel(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const { id } = req.params as unknown as { id: number };
        const order = await cache.write(() => cancelOrderService(prisma, id, req.user!));
        res.status(200).json({ status: "success", data: { order } });
      } catch (error) {
        next(error);
      }
    },

    async updateStatus(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const { id } = req.params as unknown as { id: number };
        const body = req.body as UpdateOrderStatusBody;
        const order = await cache.write(() => updateOrderStatusService(prisma, id, body));
        res.status(200).json({ status: "success", data: { order } });
      } catch (error) {
        next(error);
      }
    },
  };
}
