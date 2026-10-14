import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../../src/modules/auth/password.service.js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  TEST_ORIGIN,
  authHeaders,
  mergeCookies,
  parseCookies,
} from "../helpers/auth.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("auth and profiles", () => {
  const { app, prisma } = buildTestApp();

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function register(
    email = `user-${Date.now()}@example.com`,
    password = "Password123!",
  ) {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", TEST_ORIGIN)
      .send({ email, password, firstName: "Nesma" });

    return { response, email, password, cookies: parseCookies(response) };
  }

  it("registers and logs in a customer without leaking passwordHash", async () => {
    const { response, email, cookies } = await register();

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe(email.toLowerCase());
    expect(response.body.data.user.role).toBe("CUSTOMER");
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|password_hash/i);
    expect(cookies[ACCESS_COOKIE]).toBeTruthy();
    expect(cookies[REFRESH_COOKIE]).toBeTruthy();

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash.startsWith("$argon2id$")).toBe(true);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", TEST_ORIGIN)
      .send({ email: email.toUpperCase(), password: "Password123!" });

    expect(login.status).toBe(200);
    expect(login.body.data.user.email).toBe(email.toLowerCase());
  });

  it("rejects duplicate emails with different casing", async () => {
    await register("Duplicate@Example.com");

    const second = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", TEST_ORIGIN)
      .send({ email: "duplicate@example.com", password: "Password123!" });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe("CONFLICT");
  });

  it("rejects invalid registration input", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", TEST_ORIGIN)
      .send({ email: "not-an-email", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns generic 401 for bad credentials and disabled accounts", async () => {
    const { email } = await register("disabled@example.com");

    const badPassword = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", TEST_ORIGIN)
      .send({ email, password: "WrongPassword1!" });

    expect(badPassword.status).toBe(401);
    expect(badPassword.body.message).toBe("Invalid email or password");

    await prisma.user.update({
      where: { email },
      data: { status: "DISABLED" },
    });

    const disabled = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", TEST_ORIGIN)
      .send({ email, password: "Password123!" });

    expect(disabled.status).toBe(401);
    expect(disabled.body.message).toBe("Invalid email or password");
  });

  it("rejects missing and malformed access tokens", async () => {
    const missing = await request(app).get("/api/v1/auth/me");
    expect(missing.status).toBe(401);

    const malformed = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", `${ACCESS_COOKIE}=not-a-jwt`);
    expect(malformed.status).toBe(401);
  });

  it("logs out and immediately invalidates the access session", async () => {
    const { cookies } = await register("logout@example.com");

    const meBefore = await request(app)
      .get("/api/v1/auth/me")
      .set(authHeaders(cookies));
    expect(meBefore.status).toBe(200);

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set(authHeaders(cookies));
    expect(logout.status).toBe(200);

    const meAfter = await request(app)
      .get("/api/v1/auth/me")
      .set(authHeaders(cookies));
    expect(meAfter.status).toBe(401);

    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set(authHeaders(cookies));
    expect(refresh.status).toBe(401);
  });

  it("rotates refresh tokens and rejects replay of the old token", async () => {
    let cookies = (await register("rotate@example.com")).cookies;
    const oldRefresh = cookies[REFRESH_COOKIE];

    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .set(authHeaders(cookies));
    expect(refreshed.status).toBe(200);

    cookies = mergeCookies(cookies, refreshed);
    expect(cookies[REFRESH_COOKIE]).not.toBe(oldRefresh);

    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", `${REFRESH_COOKIE}=${oldRefresh}`);
    expect(replay.status).toBe(401);
  });

  it("handles concurrent refresh races safely", async () => {
    const { cookies } = await register("race@example.com");

    const [first, second] = await Promise.all([
      request(app).post("/api/v1/auth/refresh").set(authHeaders(cookies)),
      request(app).post("/api/v1/auth/refresh").set(authHeaders(cookies)),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toContain(200);
    expect(statuses).toContain(401);
  });

  it("rejects CSRF-invalid mutating requests after login", async () => {
    const { cookies } = await register("csrf@example.com");

    const response = await request(app)
      .patch("/api/v1/users/me/profile")
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; "))
      .send({ firstName: "Hacker" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  it("allows profile get/update for the authenticated owner only", async () => {
    const first = await register("owner@example.com");
    const second = await register("other@example.com");

    const updated = await request(app)
      .patch("/api/v1/users/me/profile")
      .set(authHeaders(first.cookies))
      .send({ firstName: "Bloom", phone: "+201000000000" });

    expect(updated.status).toBe(200);
    expect(updated.body.data.profile.firstName).toBe("Bloom");
    expect(updated.body.data.profile.userId).toBe(
      first.response.body.data.user.id,
    );

    const otherProfile = await request(app)
      .get("/api/v1/users/me/profile")
      .set(authHeaders(second.cookies));

    expect(otherProfile.status).toBe(200);
    expect(otherProfile.body.data.profile.userId).toBe(
      second.response.body.data.user.id,
    );
    expect(otherProfile.body.data.profile.firstName).not.toBe("Bloom");
  });

  it("blocks CUSTOMER from ADMIN-only routes", async () => {
    const { cookies } = await register("customer@example.com");

    const response = await request(app)
      .get("/api/v1/users/admin/ping")
      .set(authHeaders(cookies));

    expect(response.status).toBe(403);
  });

  it("allows ADMIN role through requireRole", async () => {
    const passwordHash = await hashPassword("Password123!");
    const admin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        passwordHash,
        role: "ADMIN",
        profile: { create: {} },
      },
    });

    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", TEST_ORIGIN)
      .send({ email: admin.email, password: "Password123!" });

    expect(login.status).toBe(200);
    const cookies = parseCookies(login);

    const response = await request(app)
      .get("/api/v1/users/admin/ping")
      .set(authHeaders(cookies));

    expect(response.status).toBe(200);
    expect(response.body.data.message).toBe("admin ok");
  });

  it("ignores role elevation attempts on registration", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", TEST_ORIGIN)
      .send({
        email: "elevate@example.com",
        password: "Password123!",
        role: "ADMIN",
      });

    expect(response.status).toBe(400);
  });
});
