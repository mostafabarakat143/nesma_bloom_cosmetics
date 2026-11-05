import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { buildTestApp } from "../helpers/test-app.js";

describe("not found handling", () => {
  const { app, prisma } = buildTestApp();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each(["/health", "/api/v1/health"])("returns 404 for removed GET %s", async (path) => {
    const response = await request(app).get(path);
    expect(response.status).toBe(404);
    expect(response.body.status).toBe("error");
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("returns 404 for the removed demonstration echo route", async () => {
    const response = await request(app)
      .post("/api/v1/health/echo")
      .send({ message: "hello" });
    expect(response.status).toBe(404);
    expect(response.body.status).toBe("error");
  });

  it("returns a consistent 404 error contract for unknown routes", async () => {
    const response = await request(app).get("/api/v1/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toMatch(/not found/i);
    expect(response.body).not.toHaveProperty("code");
    expect(response.body).not.toHaveProperty("requestId");
    expect(Object.keys(response.body).sort()).toEqual(["message", "status"]);
  });
});
