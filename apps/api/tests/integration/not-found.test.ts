import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { buildTestApp } from "../helpers/test-app.js";

describe("not found handling", () => {
  const { app, prisma } = buildTestApp();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns a consistent 404 error contract for unknown routes", async () => {
    const response = await request(app).get("/api/v1/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("error");
    expect(response.body.code).toBe("NOT_FOUND");
    expect(response.body.message).toMatch(/not found/i);
    expect(response.body.requestId).toBeTruthy();
  });
});
