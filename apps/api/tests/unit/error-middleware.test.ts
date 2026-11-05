import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createErrorMiddleware, isDatabaseUnavailableError } from "../../src/common/middlewares/error.middleware.js";
import { requestIdMiddleware } from "../../src/common/middlewares/request-id.middleware.js";
import { loadEnv } from "../../src/config/env.js";
import { createLogger } from "../../src/config/logger.js";
import { baseTestEnvVars } from "../helpers/test-env.js";

function buildBodyParserApp() {
  const env = loadEnv({ ...baseTestEnvVars, LOG_LEVEL: "silent" });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "64b" }));
  app.post("/body", (_req, res) => res.json({ status: "success" }));
  app.get("/unexpected", () => { throw new Error("Private internal details"); });
  app.use(createErrorMiddleware(env, createLogger(env)));
  return app;
}

describe("request parser error responses", () => {
  it("returns a safe 413 for oversized JSON and keeps the request ID header", async () => {
    const response = await request(buildBodyParserApp())
      .post("/body")
      .send({ privateValue: "x".repeat(100) });
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ status: "error", message: "Request body is too large." });
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("continues returning 400 for malformed JSON", async () => {
    const response = await request(buildBodyParserApp())
      .post("/body").set("Content-Type", "application/json").send('{"broken":');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ status: "error", message: "Malformed JSON in request body." });
  });

  it("allows JSON within the configured limit", async () => {
    expect((await request(buildBodyParserApp()).post("/body").send({ value: 1 })).status).toBe(200);
  });

  it("keeps unexpected failures as safe 500 responses", async () => {
    const response = await request(buildBodyParserApp()).get("/unexpected");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ status: "error", message: "Internal server error." });
  });
});

describe("isDatabaseUnavailableError", () => {
  it("detects Prisma connection codes", () => {
    expect(isDatabaseUnavailableError({ code: "P1001" })).toBe(true);
    expect(isDatabaseUnavailableError({ code: "P1017" })).toBe(true);
  });

  it("detects common connection messages", () => {
    expect(
      isDatabaseUnavailableError(new Error("Can't reach database server")),
    ).toBe(true);
  });

  it("ignores ordinary errors", () => {
    expect(isDatabaseUnavailableError(new Error("Validation failed"))).toBe(
      false,
    );
  });
});
