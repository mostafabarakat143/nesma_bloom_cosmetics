import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
import type { UpdateProfileBody } from "./user.schema.js";
import { getOwnProfile, updateOwnProfile } from "./user.service.js";

export function createUserController(prisma: Database) {
  return {
    async getMyProfile(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const profile = await getOwnProfile(prisma, req.user!.id);
        res.status(200).json({ status: "success", data: { profile } });
      } catch (error) {
        next(error);
      }
    },

    async updateMyProfile(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = req.body as UpdateProfileBody;
        const profile = await updateOwnProfile(prisma, req.user!.id, body);
        res.status(200).json({ status: "success", data: { profile } });
      } catch (error) {
        next(error);
      }
    },
  };
}
