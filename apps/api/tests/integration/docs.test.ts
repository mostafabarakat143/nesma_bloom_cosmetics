import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { openApiDocument } from "../../src/docs/openapi.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("API documentation", () => {
  const enabled = buildTestApp({ ENABLE_API_DOCS: "true" });
  const disabled = buildTestApp({
    ENABLE_API_DOCS: "false",
    NODE_ENV: "test",
  });

  afterAll(async () => {
    await enabled.prisma.$disconnect();
    await disabled.prisma.$disconnect();
  });

  it("serves OpenAPI 3.1 JSON with required paths when enabled", async () => {
    const response = await request(enabled.app).get("/api/openapi.json");
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.paths["/api/v1/orders"]).toBeTruthy();
    expect(response.body.paths["/api/v1/auth/login"]).toBeTruthy();
    expect(response.body.paths["/api/v1/products"]).toBeTruthy();
    expect(openApiDocument.info.title).toContain("Nesma Bloom");
  });

  it("serves Swagger UI when enabled", async () => {
    const response = await request(enabled.app).get("/api/docs/");
    expect(response.status).toBe(200);
    expect(String(response.text)).toMatch(/swagger/i);
  });

  it("hides docs endpoints when ENABLE_API_DOCS=false", async () => {
    expect((await request(disabled.app).get("/api/openapi.json")).status).toBe(
      404,
    );
    expect((await request(disabled.app).get("/api/docs/")).status).toBe(404);
  });
});
