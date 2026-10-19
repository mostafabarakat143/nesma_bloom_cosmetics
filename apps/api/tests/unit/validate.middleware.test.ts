import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createErrorMiddleware } from "../../src/common/middlewares/error.middleware.js";
import { validate } from "../../src/common/middlewares/validate.middleware.js";
import { loadEnv } from "../../src/config/env.js";
import { createLogger } from "../../src/config/logger.js";
import { requestIdMiddleware } from "../../src/common/middlewares/request-id.middleware.js";
import { baseTestEnvVars } from "../helpers/test-env.js";

describe("validate middleware", () => {
  it("rejects invalid bodies with HTTP 400 and a clear two-field error", async () => {
    const env = loadEnv({
      ...baseTestEnvVars,
      LOG_LEVEL: "silent",
    });
    const logger = createLogger(env);
    const app = express();

    app.use(requestIdMiddleware);
    app.use(express.json());
    app.post(
      "/demo",
      validate({
        body: z
          .object({
            name: z.string({ error: () => "Name is required." }).min(1),
          })
          .strict(),
      }),
      (_req, res) => {
        res.status(200).json({ status: "success" });
      },
    );
    app.use(createErrorMiddleware(env, logger));

    const response = await request(app).post("/demo").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: "error",
      message: "Name is required.",
    });
    expect(response.body).not.toHaveProperty("code");
    expect(response.body).not.toHaveProperty("details");
    expect(response.body).not.toHaveProperty("requestId");
  });
});
