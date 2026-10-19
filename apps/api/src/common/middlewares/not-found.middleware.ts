import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error.js";

export function notFoundMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
}
