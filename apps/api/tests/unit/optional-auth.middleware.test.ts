import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createErrorMiddleware } from "../../src/common/middlewares/error.middleware.js";
import { createOptionalAuth } from "../../src/common/middlewares/optional-auth.middleware.js";
import { requestIdMiddleware } from "../../src/common/middlewares/request-id.middleware.js";
import type { Database } from "../../src/config/database.js";
import { loadEnv } from "../../src/config/env.js";
import { createLogger } from "../../src/config/logger.js";
import { signBearerToken } from "../../src/modules/auth/token.service.js";
import { baseTestEnvVars } from "../helpers/test-env.js";

function buildApp() {
  const env = loadEnv({ ...baseTestEnvVars, LOG_LEVEL: "silent" });
  const database = {
    revokedAccessToken: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        role: "ADMIN",
        status: "ACTIVE",
        authVersion: 0,
      }),
    },
  };
  const app = express();
  app.use(requestIdMiddleware);
  app.get(
    "/catalog",
    createOptionalAuth(env, database as unknown as Database),
    (req, res) => {
      res.json({ user: req.user ?? null });
    },
  );
  app.use(createErrorMiddleware(env, createLogger(env)));
  return { app, database, env };
}

describe("optional authentication", () => {
  it("allows anonymous requests without querying the database", async () => {
    const { app, database } = buildApp();
    const response = await request(app).get("/catalog");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: null });
    expect(database.revokedAccessToken.findUnique).not.toHaveBeenCalled();
    expect(database.user.findUnique).not.toHaveBeenCalled();
  });

  it("attaches a verified user with the live database role", async () => {
    const { app, env } = buildApp();
    const token = await signBearerToken(env, 7, 0);
    const response = await request(app)
      .get("/catalog")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: 7, role: "ADMIN" });
  });

  it("keeps invalid token failures as 401", async () => {
    const { app, database } = buildApp();
    const response = await request(app)
      .get("/catalog")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: "error",
      message: "Authentication required.",
    });
    expect(database.revokedAccessToken.findUnique).not.toHaveBeenCalled();
  });

  it("keeps revoked token failures as 401", async () => {
    const { app, database, env } = buildApp();
    database.revokedAccessToken.findUnique.mockResolvedValue({ id: 1 });
    const token = await signBearerToken(env, 7, 0);
    const response = await request(app)
      .get("/catalog")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(database.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(["P1001", "ECONNREFUSED"])(
    "returns 503 when the revocation lookup fails with %s",
    async (code) => {
      const { app, database, env } = buildApp();
      database.revokedAccessToken.findUnique.mockRejectedValue(
        Object.assign(new Error("Database connection failed"), { code }),
      );
      const token = await signBearerToken(env, 7, 0);
      const response = await request(app)
        .get("/catalog")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: "error",
        message: "Service temporarily unavailable.",
      });
    },
  );

  it("returns 503 when the live user lookup loses its database connection", async () => {
    const { app, database, env } = buildApp();
    database.user.findUnique.mockRejectedValue(
      Object.assign(new Error("Database connection closed"), { code: "P1017" }),
    );
    const token = await signBearerToken(env, 7, 0);
    const response = await request(app)
      .get("/catalog")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: "error",
      message: "Service temporarily unavailable.",
    });
  });

  it("returns a safe 500 for unexpected failures", async () => {
    const { app, database, env } = buildApp();
    database.user.findUnique.mockRejectedValue(new Error("Internal details"));
    const token = await signBearerToken(env, 7, 0);
    const response = await request(app)
      .get("/catalog")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: "error",
      message: "Internal server error.",
    });
  });
});
