import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { catalogCacheKey, uncachedCatalog, type CatalogCache } from "../../common/cache/catalog-cache.js";
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

export function createProductController(env: Env, prisma: Database, cache: CatalogCache = uncachedCatalog) {
  return {
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = req.query as unknown as ListProductsQuery;
        const data = await cache.read(
          catalogCacheKey("products:list", query),
          () => listProducts(prisma, query, req.user),
          !req.user,
        );
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
        const product = await cache.read(
          catalogCacheKey("products:detail", id),
          () => getProductById(prisma, id, req.user),
          !req.user,
        );
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
        const product = await cache.write(() => createProductService(prisma, body));
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
        const product = await cache.write(() => updateProductService(prisma, id, body));
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
        const product = await cache.write(() => archiveProductService(prisma, id));
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
        const product = await cache.write(() => addProductImageService(prisma, id, body));
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
        const product = await cache.write(() => updateProductImageService(
          prisma,
          id,
          imageId,
          body,
          env,
        ));
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
        const product = await cache.write(() => deleteProductImageService(prisma, id, imageId, env));
        res.status(200).json({ status: "success", data: { product } });
      } catch (error) {
        next(error);
      }
    },
  };
}
