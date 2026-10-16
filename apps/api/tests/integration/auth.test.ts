import { decodeJwt } from "jose";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../../src/modules/auth/password.service.js";
import { TEST_ORIGIN, authHeaders, extractToken } from "../helpers/auth.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("auth and profiles (Bearer JWT)", () => {
  const { app, prisma, env } = buildTestApp();

  beforeEach(async () => {
    await prisma.revokedAccessToken.deleteMany();
    await prisma.orderIdempotencyKey.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
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

    return {
      response,
      email,
      password,
      token: response.status === 201 ? extractToken(response) : "",
    };
  }

  it("registers with a single Bearer token and no cookie/legacy fields", async () => {
    const { response, email } = await register();

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe(email.toLowerCase());
    expect(response.body.data.user.role).toBe("CUSTOMER");
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(typeof response.body.data.token).toBe("string");
    expect(response.body.data.accessToken).toBeUndefined();
    expect(response.body.data.refreshToken).toBeUndefined();
    expect(response.body.data.expiresIn).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|password_hash/i);
    expect(response.headers["set-cookie"]).toBeUndefined();

    const claims = decodeJwt(response.body.data.token);
    expect(claims.iss).toBe(env.JWT_ISSUER);
    expect(claims.aud).toBe(env.JWT_AUDIENCE);
    expect(typeof claims.jti).toBe("string");
    expect(typeof claims.exp).toBe("number");
    expect(typeof claims.iat).toBe("number");
    expect((claims.exp as number) - (claims.iat as number)).toBe(
      env.JWT_TTL_SECONDS,
    );

    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", TEST_ORIGIN)
      .send({ email: email.toUpperCase(), password: "Password123!" });

    expect(login.status).toBe(200);
    expect(typeof login.body.data.token).toBe("string");
    expect(login.body.data.accessToken).toBeUndefined();
    expect(login.body.data.refreshToken).toBeUndefined();
    expect(login.body.data.expiresIn).toBeUndefined();
  });

  it("rejects duplicate emails with different casing", async () => {
    await register("Duplicate@Example.com");

    const second = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", TEST_ORIGIN)
      .send({ email: "duplicate@example.com", password: "Password123!" });

    expect(second.status).toBe(409);
    expect(second.body).toEqual({
      status: "error",
      message: "An account with this email already exists. Please log in.",
    });
  });

  it("rejects invalid registration input", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", TEST_ORIGIN)
      .send({ email: "not-an-email", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: "error",
      message: "Please enter a valid email address.",
    });
  });

  it("returns generic 401 for bad credentials and disabled accounts", async () => {
    const { email } = await register("disabled@example.com");

    const badPassword = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", TEST_ORIGIN)
      .send({ email, password: "WrongPassword1!" });

    expect(badPassword.status).toBe(401);
    expect(badPassword.body).toEqual({
      status: "error",
      message: "Invalid email or password.",
    });

    await prisma.user.update({
      where: { email },
      data: { status: "DISABLED" },
    });

    const disabled = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", TEST_ORIGIN)
      .send({ email, password: "Password123!" });

    expect(disabled.status).toBe(401);
    expect(disabled.body).toEqual({
      status: "error",
      message: "Invalid email or password.",
    });
  });

  it("authenticates with Bearer and rejects missing/malformed tokens", async () => {
    const { token } = await register();

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set(authHeaders(token));
    expect(me.status).toBe(200);

    const missing = await request(app).get("/api/v1/auth/me");
    expect(missing.status).toBe(401);

    const malformed = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-jwt");
    expect(malformed.status).toBe(401);

    const refreshGone = await request(app).post("/api/v1/auth/refresh");
    expect(refreshGone.status).toBe(404);
  });

  it("rejects expired JWTs with 401", async () => {
    const shortLived = buildTestApp({ JWT_TTL_SECONDS: "1" });
    try {
      await shortLived.prisma.revokedAccessToken.deleteMany();
      await shortLived.prisma.userProfile.deleteMany();
      await shortLived.prisma.user.deleteMany();

      const registered = await request(shortLived.app)
        .post("/api/v1/auth/register")
        .set("Origin", TEST_ORIGIN)
        .send({
          email: `exp-${Date.now()}@example.com`,
          password: "Password123!",
        });
      expect(registered.status).toBe(201);
      const token = extractToken(registered);

      await new Promise((r) => setTimeout(r, 1100));

      const me = await request(shortLived.app)
        .get("/api/v1/auth/me")
        .set(authHeaders(token));
      expect(me.status).toBe(401);
    } finally {
      await shortLived.prisma.$disconnect();
    }
  });

  it("revokes JWT on logout; repeated logout is 200; revoked token fails elsewhere", async () => {
    const { token } = await register();

    const first = await request(app)
      .post("/api/v1/auth/logout")
      .set(authHeaders(token));
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/v1/auth/logout")
      .set(authHeaders(token));
    expect(second.status).toBe(200);

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set(authHeaders(token));
    expect(me.status).toBe(401);

    const count = await prisma.revokedAccessToken.count();
    expect(count).toBe(1);
  });

  it("handles concurrent logout without duplicate revoke rows", async () => {
    const { token } = await register();

    const [a, b] = await Promise.all([
      request(app).post("/api/v1/auth/logout").set(authHeaders(token)),
      request(app).post("/api/v1/auth/logout").set(authHeaders(token)),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await prisma.revokedAccessToken.count()).toBe(1);
  });

  it("disables access immediately when user status becomes DISABLED", async () => {
    const { token, email } = await register();

    await prisma.user.update({
      where: { email },
      data: { status: "DISABLED" },
    });

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set(authHeaders(token));
    expect(me.status).toBe(401);
  });

  it("applies role changes from PostgreSQL immediately", async () => {
    const { token, email } = await register();

    await prisma.user.update({
      where: { email },
      data: { role: "ADMIN" },
    });

    const ping = await request(app)
      .get("/api/v1/users/admin/ping")
      .set(authHeaders(token));
    expect(ping.status).toBe(200);
  });

  it("updates own profile with Bearer auth", async () => {
    const { token } = await register();

    const patched = await request(app)
      .patch("/api/v1/users/me/profile")
      .set(authHeaders(token))
      .send({ firstName: "Bloom", phone: "+201000000000" });

    expect(patched.status).toBe(200);
    expect(patched.body.data.profile.firstName).toBe("Bloom");
  });

  it("does not create refresh_tokens rows on register/login", async () => {
    await register();
    expect(await prisma.refreshToken.count()).toBe(0);
  });
});
