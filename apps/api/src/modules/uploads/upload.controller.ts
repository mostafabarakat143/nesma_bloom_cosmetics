import type { NextFunction, Request, Response } from "express";

import type { Env } from "../../config/env.js";
import { readImageUpload } from "./read-image-upload.js";
import { storeCatalogImage } from "./image-storage.js";

export function createUploadController(env: Env) {
  return {
    async uploadCatalog(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const bytes = await readImageUpload(req);
        const url = await storeCatalogImage(env, bytes);
        res.status(201).json({ status: "success", data: { url } });
      } catch (error) {
        next(error);
      }
    },
  };
}
