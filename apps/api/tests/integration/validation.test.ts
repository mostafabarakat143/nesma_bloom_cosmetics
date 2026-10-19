import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { TEST_ORIGIN } from "../helpers/auth.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("request validation", () => {
  const { app, prisma } = buildTestApp();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects invalid echo bodies with HTTP 400", async () => {
    const response = await request(app)
      .post("/api/v1/health/echo")
      .set("Origin", TEST_ORIGIN)
      .send({ message: "" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: "error",
      message: "Message is required.",
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

  it("accepts valid echo bodies", async () => {
    const response = await request(app)
      .post("/api/v1/health/echo")
      .set("Origin", TEST_ORIGIN)
      .send({ message: "hello" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "success",
      data: { message: "hello" },
    });
  });
});
