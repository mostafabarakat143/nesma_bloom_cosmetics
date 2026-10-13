import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { getCorsOrigins, type Env } from "./config/env.js";
import { createLogger, type Logger } from "./config/logger.js";
import { createErrorMiddleware } from "./common/middlewares/error.middleware.js";
import { notFoundMiddleware } from "./common/middlewares/not-found.middleware.js";
import { requestIdMiddleware } from "./common/middlewares/request-id.middleware.js";
import { validate } from "./common/middlewares/validate.middleware.js";
import { healthRouter } from "./modules/health/health.routes.js";
import {
  healthEchoBodySchema,
  type HealthEchoBody,
} from "./modules/health/health.schema.js";

export type AppDependencies = {
  env: Env;
  logger: Logger;
};

export function createApp({ env, logger }: AppDependencies): Express {
  const app: Express = express();

  app.disable("x-powered-by");

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

  // Temporary validated route to prove the shared validation pipeline.
  // Will be replaced by real feature modules.
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

  app.use(notFoundMiddleware);
  app.use(createErrorMiddleware(env, logger));

  return app;
}
