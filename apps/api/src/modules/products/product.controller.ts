import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
import type {
  CreateProductBody,
  CreateProductImageBody,
  ListProductsQuery,
  UpdateProductBody,
  UpdateProductImageBody,
} from "./product.schema.js";
import {
  addProductImageService,
  archiveProductService,
  createProductService,
  deleteProductImageService,
  getProductById,
  listProducts,
  updateProductImageService,
  updateProductService,
} from "./product.service.js";

export function createProductController(prisma: Database) {
  return {
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = req.query as unknown as ListProductsQuery;
        const data = await listProducts(prisma, query, req.user);
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
        const product = await getProductById(prisma, id, req.user);
        res.status(200).json({ status: "success", data: { product } });
      } catch (error) {
        next(error);
      }
    },

    async create(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = req.body as CreateProductBody;
        const product = await createProductService(prisma, body);
        res.status(201).json({ status: "success", data: { product } });
      } catch (error) {
        next(error);
      }
    },

    async update(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const { id } = req.params as unknown as { id: number };
        const body = req.body as UpdateProductBody;
        const product = await updateProductService(prisma, id, body);
        res.status(200).json({ status: "success", data: { product } });
      } catch (error) {
        next(error);
      }
    },

    async archive(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const { id } = req.params as unknown as { id: number };
        const product = await archiveProductService(prisma, id);
        res.status(200).json({ status: "success", data: { product } });
      } catch (error) {
        next(error);
      }
    },

    async addImage(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const { id } = req.params as unknown as { id: number };
        const body = req.body as CreateProductImageBody;
        const product = await addProductImageService(prisma, id, body);
        res.status(201).json({ status: "success", data: { product } });
      } catch (error) {
        next(error);
      }
    },

    async updateImage(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const { id, imageId } = req.params as unknown as { id: number; imageId: number };
        const body = req.body as UpdateProductImageBody;
        const product = await updateProductImageService(
          prisma,
          id,
          imageId,
          body,
        );
        res.status(200).json({ status: "success", data: { product } });
      } catch (error) {
        next(error);
      }
    },

    async deleteImage(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const { id, imageId } = req.params as unknown as { id: number; imageId: number };
        const product = await deleteProductImageService(prisma, id, imageId);
        res.status(200).json({ status: "success", data: { product } });
      } catch (error) {
        next(error);
      }
    },
  };
}
