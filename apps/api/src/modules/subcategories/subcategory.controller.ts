import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
import { catalogCacheKey, uncachedCatalog, type CatalogCache } from "../../common/cache/catalog-cache.js";
import type {
  CreateSubcategoryBody,
  ListSubcategoriesQuery,
  UpdateSubcategoryBody,
} from "./subcategory.schema.js";
import {
  archiveSubcategoryService,
  createSubcategoryService,
  getSubcategoryById,
  listSubcategories,
  updateSubcategoryService,
} from "./subcategory.service.js";

export function createSubcategoryController(prisma: Database, cache: CatalogCache = uncachedCatalog) {
  return {
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = req.query as unknown as ListSubcategoriesQuery;
        const data = await cache.read(
          catalogCacheKey("subcategories:list", query),
          () => listSubcategories(prisma, query, req.user),
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
        const subcategory = await cache.read(
          catalogCacheKey("subcategories:detail", id),
          () => getSubcategoryById(prisma, id, req.user),
          !req.user,
        );
        res.status(200).json({ status: "success", data: { subcategory } });
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
        const body = req.body as CreateSubcategoryBody;
        const subcategory = await cache.write(() => createSubcategoryService(prisma, body));
        res.status(201).json({ status: "success", data: { subcategory } });
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
        const body = req.body as UpdateSubcategoryBody;
        const subcategory = await cache.write(() => updateSubcategoryService(prisma, id, body));
        res.status(200).json({ status: "success", data: { subcategory } });
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
        const subcategory = await cache.write(() => archiveSubcategoryService(prisma, id));
        res.status(200).json({ status: "success", data: { subcategory } });
      } catch (error) {
        next(error);
      }
    },
  };
}
