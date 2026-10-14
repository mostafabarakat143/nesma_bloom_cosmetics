import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
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

export function createOrderController(prisma: Database) {
  return {
    async create(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = req.body as CreateOrderBody;
        const result = await createOrderService(
          prisma,
          req.user!,
          body,
          req.get("Idempotency-Key"),
        );
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
        const { id } = req.params as { id: string };
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
        const { id } = req.params as { id: string };
        const order = await cancelOrderService(prisma, id, req.user!);
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
        const { id } = req.params as { id: string };
        const body = req.body as UpdateOrderStatusBody;
        const order = await updateOrderStatusService(prisma, id, body);
        res.status(200).json({ status: "success", data: { order } });
      } catch (error) {
        next(error);
      }
    },
  };
}
