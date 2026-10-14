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
    expect(response.body.status).toBe("error");
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "message" }),
      ]),
    );
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
