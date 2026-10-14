import { Router, type Router as ExpressRouter } from "express";
import swaggerUi from "swagger-ui-express";

import type { Env } from "../config/env.js";
import { openApiDocument } from "./openapi.js";

export function createDocsRouter(env: Env): ExpressRouter {
  const router: ExpressRouter = Router();

  if (!env.ENABLE_API_DOCS) {
    return router;
  }

  router.get("/openapi.json", (_req, res) => {
    res.status(200).json(openApiDocument);
  });

  router.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "Nesma Bloom API Docs",
      swaggerOptions: {
        persistAuthorization: false,
        withCredentials: true,
      },
    }),
  );

  return router;
}
