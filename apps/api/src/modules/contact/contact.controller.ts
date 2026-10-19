import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
import type { CreateContactBody, ListContactQuery } from "./contact.schema.js";
import { createContactMessage, listContactMessages } from "./contact.service.js";

export function createContactController(prisma: Database) {
  return {
    async create(
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const body = req.body as CreateContactBody;
        const contact = await createContactMessage(prisma, body);
        res.status(201).json({ status: "success", data: { contact } });
      } catch (error) {
        next(error);
      }
    },

    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = req.query as unknown as ListContactQuery;
        const data = await listContactMessages(prisma, query);
        res.status(200).json({ status: "success", data });
      } catch (error) {
        next(error);
      }
    },
  };
}
