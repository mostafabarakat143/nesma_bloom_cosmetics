import type { NextFunction, Request, Response } from "express";

import type { Database } from "../../config/database.js";
import type { DashboardQuery } from "./dashboard.schema.js";
import { getAdminDashboard } from "./dashboard.service.js";

export function createDashboardController(prisma: Database) {
  return {
    async get(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = req.query as unknown as DashboardQuery;
        const dashboard = await getAdminDashboard(prisma, query);
        res.status(200).json({ status: "success", data: { dashboard } });
      } catch (error) {
        next(error);
      }
    },
  };
}
