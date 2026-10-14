import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createErrorMiddleware } from "../../src/common/middlewares/error.middleware.js";
import { validate } from "../../src/common/middlewares/validate.middleware.js";
import { loadEnv } from "../../src/config/env.js";
import { createLogger } from "../../src/config/logger.js";
import { requestIdMiddleware } from "../../src/common/middlewares/request-id.middleware.js";

describe("validate middleware", () => {
  it("rejects invalid bodies with HTTP 400 and field details", async () => {
    const env = loadEnv({
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
    });
    const logger = createLogger(env);
    const app = express();

    app.use(requestIdMiddleware);
    app.use(express.json());
    app.post(
      "/demo",
      validate({
        body: z.object({ name: z.string().min(1) }).strict(),
      }),
      (_req, res) => {
        res.status(200).json({ status: "success" });
      },
    );
    app.use(createErrorMiddleware(env, logger));

    const response = await request(app).post("/demo").send({});

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "name" }),
      ]),
    );
  });
});
