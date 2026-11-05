import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { TEST_ORIGIN } from "../helpers/auth.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("request validation", () => {
  const { app, prisma } = buildTestApp();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 413 when a JSON body exceeds the API size limit", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ message: "x".repeat(110_000) });
    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      status: "error",
      message: "Request body is too large.",
    });
  });

  it("rejects invalid registration emails with HTTP 400", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", TEST_ORIGIN)
      .send({ email: "invalid-email", password: "Password123!" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: "error",
      message: "Please enter a valid email address.",
    });
  });

  it("rejects missing auth fields with field-specific messages", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", TEST_ORIGIN)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: "error",
      message: "Email is required.",
    });
  });

});
