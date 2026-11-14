import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { catalogCacheKey, uncachedCatalog, type CatalogCache } from "../../common/cache/catalog-cache.js";
import type {
  CreateCategoryBody,
  ListCategoriesQuery,
  UpdateCategoryBody,
} from "./category.schema.js";
import {
  archiveCategoryService,
  createCategoryService,
  getCategoryById,
  listCategories,
  updateCategoryService,
} from "./category.service.js";

export function createCategoryController(env: Env, prisma: Database, cache: CatalogCache = uncachedCatalog) {
  return {
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = req.query as unknown as ListCategoriesQuery;
        const data = await cache.read(
          catalogCacheKey("categories:list", query),
          () => listCategories(prisma, query, req.user),
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
        const category = await cache.read(
          catalogCacheKey("categories:detail", id),
          () => getCategoryById(prisma, id, req.user),
          !req.user,
        );
        res.status(200).json({ status: "success", data: { category } });
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
        const body = req.body as CreateCategoryBody;
        const category = await cache.write(() => createCategoryService(prisma, body));
        res.status(201).json({ status: "success", data: { category } });
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
        const body = req.body as UpdateCategoryBody;
        const category = await cache.write(() => updateCategoryService(prisma, id, body, env));
        res.status(200).json({ status: "success", data: { category } });
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
        const category = await cache.write(() => archiveCategoryService(prisma, id));
        res.status(200).json({ status: "success", data: { category } });
      } catch (error) {
        next(error);
      }
    },
  };
}
