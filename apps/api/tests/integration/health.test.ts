import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { buildTestApp } from "../helpers/test-app.js";

describe("health endpoints", () => {
  const { app, prisma } = buildTestApp();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("GET /health returns success", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "success",
      message: "Nesma Bloom Cosmetics API is healthy",
    });
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("GET /api/v1/health returns success", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });
});
