import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../../src/modules/auth/password.service.js";
import { authHeaders, TEST_ORIGIN, extractToken } from "../helpers/auth.js";
import { createAdminUser, loginAsAdmin } from "../helpers/admin.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("admin dashboard, users, and contact", () => {
  const { app, prisma } = buildTestApp();

  beforeEach(async () => {
    await prisma.contactMessage.deleteMany();
    await prisma.revokedAccessToken.deleteMany();
    await prisma.orderIdempotencyKey.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.subcategory.deleteMany();
    await prisma.category.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function asAdmin(email = `admin-${Date.now()}@example.com`) {
    const admin = await createAdminUser(prisma, email);
    const token = await loginAsAdmin(app, admin.email, admin.password);
    return { ...admin, token };
  }

  async function asCustomer(email = `customer-${Date.now()}@example.com`) {
    const password = "Password123!";
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: "CUSTOMER",
        profile: {
          create: { firstName: "Lina", lastName: "Hassan" },
        },
      },
    });
    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", TEST_ORIGIN)
      .send({ email, password });
    return { token: extractToken(login), user, email };
  }

  it("lists, reads, and updates users without removing the last admin", async () => {
    const admin = await asAdmin("owner-admin@example.com");
    const customer = await asCustomer("lina.hassan@example.com");

    const forbidden = await request(app)
      .get("/api/v1/users")
      .set(authHeaders(customer.token));
    expect(forbidden.status).toBe(403);

    const list = await request(app)
      .get("/api/v1/users")
      .set(authHeaders(admin.token))
      .query({ search: "lina", role: "CUSTOMER" });
    expect(list.status).toBe(200);
    expect(list.body.data.meta.totalItems).toBe(1);
    expect(list.body.data.items[0]).toMatchObject({
      id: customer.user.id,
      email: customer.email,
      role: "CUSTOMER",
      status: "ACTIVE",
      profile: { firstName: "Lina", lastName: "Hassan" },
    });
    expect(list.body.data.items[0].passwordHash).toBeUndefined();

    const detail = await request(app)
      .get(`/api/v1/users/${customer.user.id}`)
      .set(authHeaders(admin.token));
    expect(detail.status).toBe(200);
    expect(detail.body.data.user.email).toBe(customer.email);

    const lastAdmin = await request(app)
      .patch(`/api/v1/users/${admin.user.id}`)
      .set(authHeaders(admin.token))
      .send({ status: "DISABLED" });
    expect(lastAdmin.status).toBe(409);

    const promoted = await request(app)
      .patch(`/api/v1/users/${customer.user.id}`)
      .set(authHeaders(admin.token))
      .send({ role: "ADMIN" });
    expect(promoted.status).toBe(200);
    expect(promoted.body.data.user.role).toBe("ADMIN");

    const demoted = await request(app)
      .patch(`/api/v1/users/${customer.user.id}`)
      .set(authHeaders(admin.token))
      .send({ role: "CUSTOMER", status: "DISABLED" });
    expect(demoted.status).toBe(200);
    expect(demoted.body.data.user).toMatchObject({
      role: "CUSTOMER",
      status: "DISABLED",
    });
  });

  it("returns dashboard totals and a UTC order series", async () => {
    const { token } = await asAdmin();
    await prisma.category.create({
      data: { name: "Care", slug: `care-${Date.now()}`, status: "ACTIVE" },
    });

    const dashboard = await request(app)
      .get("/api/v1/admin/dashboard")
      .set(authHeaders(token))
      .query({ bucket: "month" });
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.dashboard.totals.categories).toBe(1);
    expect(dashboard.body.data.dashboard.totals.users).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.data.dashboard.ordersByStatus).toEqual({
      PENDING: 0,
      CONFIRMED: 0,
      FULFILLED: 0,
      CANCELLED: 0,
    });
    expect(dashboard.body.data.dashboard.ordersOverTime).toEqual([]);
    expect(dashboard.body.data.dashboard.range.bucket).toBe("month");

    const inverted = await request(app)
      .get("/api/v1/admin/dashboard")
      .set(authHeaders(token))
      .query({ from: "2026-12-31", to: "2026-01-01" });
    expect(inverted.status).toBe(400);
  });

  it("stores a public contact message and lets only admins list it", async () => {
    const created = await request(app)
      .post("/api/v1/contact")
      .set("Origin", TEST_ORIGIN)
      .send({
        name: "Lina Hassan",
        phone: "01015981398",
        email: "Lina@Example.com",
        message: "Please tell me about the serum.",
      });
    expect(created.status).toBe(201);
    expect(created.body.data.contact.email).toBe("lina@example.com");

    const invalid = await request(app)
      .post("/api/v1/contact")
      .set("Origin", TEST_ORIGIN)
      .send({ name: "Lina" });
    expect(invalid.status).toBe(400);

    const customer = await asCustomer();
    const forbidden = await request(app)
      .get("/api/v1/contact")
      .set(authHeaders(customer.token));
    expect(forbidden.status).toBe(403);

    const { token } = await asAdmin();
    const list = await request(app)
      .get("/api/v1/contact")
      .set(authHeaders(token));
    expect(list.status).toBe(200);
    expect(list.body.data.meta.totalItems).toBe(1);
    expect(list.body.data.items[0]).toMatchObject({
      name: "Lina Hassan",
      phone: "01015981398",
      email: "lina@example.com",
      message: "Please tell me about the serum.",
    });
  });
});
