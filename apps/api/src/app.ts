import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import type { Database } from "./config/database.js";
import { getCorsOrigins, type Env } from "./config/env.js";
import type { Logger } from "./config/logger.js";
import { createCsrfMiddleware } from "./common/middlewares/csrf.middleware.js";
import { createErrorMiddleware } from "./common/middlewares/error.middleware.js";
import { notFoundMiddleware } from "./common/middlewares/not-found.middleware.js";
import { requestIdMiddleware } from "./common/middlewares/request-id.middleware.js";
import { validate } from "./common/middlewares/validate.middleware.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createCategoryRouter } from "./modules/categories/category.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import {
  healthEchoBodySchema,
  type HealthEchoBody,
} from "./modules/health/health.schema.js";
import { createOrderRouter } from "./modules/orders/order.routes.js";
import { createProductRouter } from "./modules/products/product.routes.js";
import { createSubcategoryRouter } from "./modules/subcategories/subcategory.routes.js";
import { createUserRouter } from "./modules/users/user.routes.js";

export type AppDependencies = {
  env: Env;
  logger: Logger;
  prisma: Database;
};

export function createApp({ env, logger, prisma }: AppDependencies): Express {
  const app: Express = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestIdMiddleware);
  app.use(helmet());

  const corsOrigins = getCorsOrigins(env.CORS_ORIGIN);
  if (corsOrigins !== false) {
    app.use(
      cors({
        origin: corsOrigins,
        credentials: true,
      }),
    );
  }

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        status: "error",
        message: "Too many requests",
        code: "TOO_MANY_REQUESTS",
      },
      skip: () => env.NODE_ENV === "test",
    }),
  );

  app.use(express.json({ limit: env.BODY_SIZE_LIMIT }));
  app.use(cookieParser());
  app.use(createCsrfMiddleware(env));

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => {
        const request = req as express.Request;
        return request.requestId;
      },
      customProps: (req) => {
        const request = req as express.Request;
        return { requestId: request.requestId };
      },
      autoLogging: env.NODE_ENV !== "test",
    }),
  );

  app.use("/health", healthRouter);
  app.use("/api/v1/health", healthRouter);

  app.post(
    "/api/v1/health/echo",
    validate({ body: healthEchoBodySchema }),
    (req, res) => {
      const body = req.body as HealthEchoBody;
      res.status(200).json({
        status: "success",
        data: { message: body.message },
      });
    },
  );

  app.use("/api/v1/auth", createAuthRouter(env, prisma));
  app.use("/api/v1/users", createUserRouter(env, prisma));
  app.use("/api/v1/categories", createCategoryRouter(env, prisma));
  app.use("/api/v1/subcategories", createSubcategoryRouter(env, prisma));
  app.use("/api/v1/products", createProductRouter(env, prisma));
  app.use("/api/v1/orders", createOrderRouter(env, prisma));

  app.use(notFoundMiddleware);
  app.use(createErrorMiddleware(env, logger));

  return app;
}
