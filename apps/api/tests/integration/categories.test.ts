import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../../src/modules/auth/password.service.js";
import { authHeaders, TEST_ORIGIN, extractToken } from "../helpers/auth.js";
import { createAdminUser, loginAsAdmin } from "../helpers/admin.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("categories CRUD", () => {
  const { app, prisma } = buildTestApp();

  beforeEach(async () => {
    await prisma.revokedAccessToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.orderIdempotencyKey.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.subcategory.deleteMany();
    await prisma.category.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function asAdmin() {
    const admin = await createAdminUser(prisma);
    const token = await loginAsAdmin(app, admin.email, admin.password);
    return { ...admin, token };
  }

  async function asCustomer() {
    const password = "Password123!";
    const email = `customer-${Date.now()}@example.com`;
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: "CUSTOMER",
        profile: { create: {} },
      },
    });
    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", TEST_ORIGIN)
      .send({ email, password });
    return { token: extractToken(login) };
  }

  it("lists and details only ACTIVE categories publicly", async () => {
    await prisma.category.createMany({
      data: [
        { name: "Active One", slug: "active-one", status: "ACTIVE" },
        { name: "Archived One", slug: "archived-one", status: "ARCHIVED" },
      ],
    });

    const list = await request(app).get("/api/v1/categories");
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].slug).toBe("active-one");
    expect(list.body.data.meta.totalItems).toBe(1);

    const active = await prisma.category.findUniqueOrThrow({
      where: { slug: "active-one" },
    });
    const archived = await prisma.category.findUniqueOrThrow({
      where: { slug: "archived-one" },
    });

    const detailActive = await request(app).get(
      `/api/v1/categories/${active.id}`,
    );
    expect(detailActive.status).toBe(200);

    const detailArchived = await request(app).get(
      `/api/v1/categories/${archived.id}`,
    );
    expect(detailArchived.status).toBe(404);
  });

  it("allows ADMIN to list and retrieve archived categories", async () => {
    const { token } = await asAdmin();
    const archived = await prisma.category.create({
      data: { name: "Hidden", slug: "hidden", status: "ARCHIVED" },
    });

    const list = await request(app)
      .get("/api/v1/categories?status=ARCHIVED")
      .set(authHeaders(token));
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);

    const all = await request(app)
      .get("/api/v1/categories?status=ALL")
      .set(authHeaders(token));
    expect(all.status).toBe(200);

    const detail = await request(app)
      .get(`/api/v1/categories/${archived.id}`)
      .set(authHeaders(token));
    expect(detail.status).toBe(200);
    expect(detail.body.data.category.status).toBe("ARCHIVED");
  });

  it("returns 403 when CUSTOMER or anonymous requests archived/all filters", async () => {
    const anon = await request(app).get("/api/v1/categories?status=ALL");
    expect(anon.status).toBe(403);

    const { token } = await asCustomer();
    const customer = await request(app)
      .get("/api/v1/categories?status=ARCHIVED")
      .set(authHeaders(token));
    expect(customer.status).toBe(403);
  });

  it("supports search, pagination and deterministic sorting", async () => {
    await prisma.category.createMany({
      data: [
        { name: "Beta", slug: "beta" },
        { name: "Alpha", slug: "alpha" },
        { name: "Gamma Care", slug: "gamma-care" },
      ],
    });

    const sorted = await request(app).get(
      "/api/v1/categories?sortBy=name&sortOrder=asc",
    );
    expect(sorted.status).toBe(200);
    expect(sorted.body.data.items.map((i: { name: string }) => i.name)).toEqual([
      "Alpha",
      "Beta",
      "Gamma Care",
    ]);

    const page = await request(app).get(
      "/api/v1/categories?page=1&pageSize=2&sortBy=name&sortOrder=asc",
    );
    expect(page.body.data.items).toHaveLength(2);
    expect(page.body.data.meta).toMatchObject({
      page: 1,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2,
    });

    const search = await request(app).get("/api/v1/categories?search=care");
    expect(search.body.data.items).toHaveLength(1);
    expect(search.body.data.items[0].slug).toBe("gamma-care");
  });

  it("creates categories with generated or explicit slugs", async () => {
    const { token } = await asAdmin();

    const generated = await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(token))
      .send({ name: "Skin Care" });
    expect(generated.status).toBe(201);
    expect(generated.body.data.category.slug).toBe("skin-care");

    const explicit = await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(token))
      .send({ name: "Makeup", slug: "make-up" });
    expect(explicit.status).toBe(201);
    expect(explicit.body.data.category.slug).toBe("make-up");
  });

  it("rejects duplicate slugs with 409", async () => {
    const { token } = await asAdmin();
    await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(token))
      .send({ name: "One", slug: "shared" });

    const dup = await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(token))
      .send({ name: "Two", slug: "shared" });
    expect(dup.status).toBe(409);
  });

  it("updates name without changing slug unless slug is explicit", async () => {
    const { token } = await asAdmin();
    const created = await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(token))
      .send({ name: "Original", slug: "original" });

    const id = created.body.data.category.id;

    const renamed = await request(app)
      .patch(`/api/v1/categories/${id}`)
      .set(authHeaders(token))
      .send({ name: "Renamed" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.category.name).toBe("Renamed");
    expect(renamed.body.data.category.slug).toBe("original");

    const slugChange = await request(app)
      .patch(`/api/v1/categories/${id}`)
      .set(authHeaders(token))
      .send({ slug: "renamed-slug" });
    expect(slugChange.status).toBe(200);
    expect(slugChange.body.data.category.slug).toBe("renamed-slug");
  });

  it("archives idempotently and restores via PATCH", async () => {
    const { token } = await asAdmin();
    const created = await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(token))
      .send({ name: "Temp", slug: "temp" });
    const id = created.body.data.category.id;

    const first = await request(app)
      .delete(`/api/v1/categories/${id}`)
      .set(authHeaders(token));
    expect(first.status).toBe(200);
    expect(first.body.data.category.status).toBe("ARCHIVED");

    const second = await request(app)
      .delete(`/api/v1/categories/${id}`)
      .set(authHeaders(token));
    expect(second.status).toBe(200);
    expect(second.body.data.category.status).toBe("ARCHIVED");

    const restored = await request(app)
      .patch(`/api/v1/categories/${id}`)
      .set(authHeaders(token))
      .send({ status: "ACTIVE" });
    expect(restored.status).toBe(200);
    expect(restored.body.data.category.status).toBe("ACTIVE");
  });

  it("validates ID, body and empty PATCH", async () => {
    const { token } = await asAdmin();

    const badId = await request(app).get("/api/v1/categories/not-an-id");
    expect(badId.status).toBe(400);

    const badBody = await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(token))
      .send({ name: "" });
    expect(badBody.status).toBe(400);

    const created = await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(token))
      .send({ name: "Valid", slug: "valid" });

    const emptyPatch = await request(app)
      .patch(`/api/v1/categories/${created.body.data.category.id}`)
      .set(authHeaders(token))
      .send({});
    expect(emptyPatch.status).toBe(400);
  });

  it("requires ADMIN auth and Bearer for mutations", async () => {
    const unauth = await request(app)
      .post("/api/v1/categories")
      .set("Origin", TEST_ORIGIN)
      .send({ name: "Nope" });
    expect(unauth.status).toBe(401);

    const { token: customerToken } = await asCustomer();
    const forbidden = await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(customerToken))
      .send({ name: "Nope" });
    expect(forbidden.status).toBe(403);

    const { token: adminToken } = await asAdmin();
    const created = await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(adminToken))
      .send({ name: "Admin Target", slug: "admin-target" });
    expect(created.status).toBe(201);

    const noBearer = await request(app)
      .patch(`/api/v1/categories/${created.body.data.category.id}`)
      .set("Origin", TEST_ORIGIN)
      .send({ name: "Hacked" });
    expect(noBearer.status).toBe(401);
  });
});
