import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import type {
  ListUsersQuery,
  UpdateProfileBody,
  UpdateUserBody,
} from "./user.schema.js";
import { readImageUpload } from "../uploads/read-image-upload.js";
import {
  getOwnProfile,
  getUserById,
  listUsers,
  replaceOwnAvatar,
  updateOwnProfile,
  updateUser,
} from "./user.service.js";

export function createUserController(env: Env, prisma: Database) {
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
        const profile = await updateOwnProfile(prisma, req.user!.id, body, env);
        res.status(200).json({ status: "success", data: { profile } });
      } catch (error) {
        next(error);
      }
    },

    async replaceMyAvatar(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const bytes = await readImageUpload(req);
        const profile = await replaceOwnAvatar(
          env,
          prisma,
          req.user!.id,
          bytes,
        );
        res.status(200).json({ status: "success", data: { profile } });
      } catch (error) {
        next(error);
      }
    },

    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = req.query as unknown as ListUsersQuery;
        const data = await listUsers(prisma, query);
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
        const user = await getUserById(prisma, id);
        res.status(200).json({ status: "success", data: { user } });
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
        const body = req.body as UpdateUserBody;
        const user = await updateUser(prisma, id, body);
        res.status(200).json({ status: "success", data: { user } });
      } catch (error) {
        next(error);
      }
    },
  };
}
