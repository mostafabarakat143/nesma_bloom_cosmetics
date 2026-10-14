import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
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

export function createSubcategoryController(prisma: Database) {
  return {
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = req.query as unknown as ListSubcategoriesQuery;
        const data = await listSubcategories(prisma, query, req.user);
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
        const subcategory = await getSubcategoryById(prisma, id, req.user);
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
        const subcategory = await createSubcategoryService(prisma, body);
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
        const { id } = req.params as { id: string };
        const body = req.body as UpdateSubcategoryBody;
        const subcategory = await updateSubcategoryService(prisma, id, body);
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
        const { id } = req.params as { id: string };
        const subcategory = await archiveSubcategoryService(prisma, id);
        res.status(200).json({ status: "success", data: { subcategory } });
      } catch (error) {
        next(error);
      }
    },
  };
}
