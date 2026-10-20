import { Router, type Router as ExpressRouter } from "express";

import type { Env } from "../../config/env.js";
import { createMediaController } from "./media.controller.js";

export function createMediaRouter(env: Env): ExpressRouter {
  const router: ExpressRouter = Router();
  const controller = createMediaController(env);

  router.get("/:scope/:filename", (req, res, next) =>
    void controller.get(req, res, next),
  );

  return router;
}
