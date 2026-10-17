import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../../src/modules/auth/password.service.js";
import { authHeaders, TEST_ORIGIN, extractToken } from "../helpers/auth.js";
import { createAdminUser, loginAsAdmin } from "../helpers/admin.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("subcategories CRUD", () => {
  const { app, prisma } = buildTestApp();

  beforeEach(async () => {
    await prisma.revokedAccessToken.deleteMany();
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
    return { token };
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

  async function seedCategories() {
    const active = await prisma.category.create({
      data: { name: "Skincare", slug: "skincare", status: "ACTIVE" },
    });
    const archived = await prisma.category.create({
      data: { name: "Legacy", slug: "legacy", status: "ARCHIVED" },
    });
    const other = await prisma.category.create({
      data: { name: "Makeup", slug: "makeup", status: "ACTIVE" },
    });
    return { active, archived, other };
  }

  it("creates a subcategory under an active parent", async () => {
    const { token } = await asAdmin();
    const { active } = await seedCategories();

    const response = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(token))
      .send({ name: "Lip Care", categoryId: active.id });

    expect(response.status).toBe(201);
    expect(response.body.data.subcategory.slug).toBe("lip-care");
    expect(response.body.data.subcategory.categoryId).toBe(active.id);
    expect(response.body.data.subcategory.category.status).toBe("ACTIVE");
  });

  it("returns 404 when parent category is missing", async () => {
    const { token } = await asAdmin();
    const response = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(token))
      .send({
        name: "Orphan",
        categoryId: 999_999_999,
      });
    expect(response.status).toBe(404);
  });

  it("rejects ACTIVE create under archived parent with 409", async () => {
    const { token } = await asAdmin();
    const { archived } = await seedCategories();

    const response = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(token))
      .send({
        name: "Blocked",
        categoryId: archived.id,
        status: "ACTIVE",
      });
    expect(response.status).toBe(409);
  });

  it("allows ARCHIVED subcategory under archived parent for admin org", async () => {
    const { token } = await asAdmin();
    const { archived } = await seedCategories();

    const response = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(token))
      .send({
        name: "Parked",
        categoryId: archived.id,
        status: "ARCHIVED",
      });
    expect(response.status).toBe(201);
    expect(response.body.data.subcategory.status).toBe("ARCHIVED");
    expect(response.body.data.subcategory.category.status).toBe("ARCHIVED");
  });

  it("hides archived and archived-parent subcategories from public APIs", async () => {
    const { active, archived } = await seedCategories();
    const visible = await prisma.subcategory.create({
      data: {
        name: "Visible",
        slug: "visible",
        categoryId: active.id,
        status: "ACTIVE",
      },
    });
    const archivedChild = await prisma.subcategory.create({
      data: {
        name: "Archived Child",
        slug: "archived-child",
        categoryId: active.id,
        status: "ARCHIVED",
      },
    });
    const underArchived = await prisma.subcategory.create({
      data: {
        name: "Hidden Parent",
        slug: "hidden-parent",
        categoryId: archived.id,
        status: "ARCHIVED",
      },
    });

    const list = await request(app).get("/api/v1/subcategories");
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].id).toBe(visible.id);
    expect(list.body.data.meta.totalItems).toBe(1);

    expect((await request(app).get(`/api/v1/subcategories/${visible.id}`)).status).toBe(
      200,
    );
    expect(
      (await request(app).get(`/api/v1/subcategories/${archivedChild.id}`)).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/v1/subcategories/${underArchived.id}`)).status,
    ).toBe(404);
  });

  it("lets ADMIN list archived and view under archived parents", async () => {
    const { token } = await asAdmin();
    const { active, archived } = await seedCategories();
    await prisma.subcategory.create({
      data: {
        name: "A",
        slug: "a",
        categoryId: active.id,
        status: "ARCHIVED",
      },
    });
    const under = await prisma.subcategory.create({
      data: {
        name: "B",
        slug: "b",
        categoryId: archived.id,
        status: "ARCHIVED",
      },
    });

    const list = await request(app)
      .get("/api/v1/subcategories?status=ARCHIVED")
      .set(authHeaders(token));
    expect(list.status).toBe(200);
    expect(list.body.data.meta.totalItems).toBe(2);

    const detail = await request(app)
      .get(`/api/v1/subcategories/${under.id}`)
      .set(authHeaders(token));
    expect(detail.status).toBe(200);
  });

  it("returns 403 for non-admin status=ALL", async () => {
    expect((await request(app).get("/api/v1/subcategories?status=ALL")).status).toBe(
      403,
    );
    const { token } = await asCustomer();
    expect(
      (
        await request(app)
          .get("/api/v1/subcategories?status=ARCHIVED")
          .set(authHeaders(token))
      ).status,
    ).toBe(403);
  });

  it("filters by categoryId and supports pagination/sorting", async () => {
    const { active, other } = await seedCategories();
    await prisma.subcategory.createMany({
      data: [
        { name: "Beta", slug: "beta", categoryId: active.id },
        { name: "Alpha", slug: "alpha", categoryId: active.id },
        { name: "Other", slug: "other", categoryId: other.id },
      ],
    });

    const filtered = await request(app).get(
      `/api/v1/subcategories?categoryId=${active.id}&sortBy=name&sortOrder=asc`,
    );
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.items.map((i: { name: string }) => i.name)).toEqual([
      "Alpha",
      "Beta",
    ]);
    expect(filtered.body.data.meta.totalItems).toBe(2);

    const page = await request(app).get(
      `/api/v1/subcategories?categoryId=${active.id}&page=1&pageSize=1&sortBy=name&sortOrder=asc`,
    );
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.meta.totalPages).toBe(2);
  });

  it("enforces slug uniqueness per category but allows reuse across categories", async () => {
    const { token } = await asAdmin();
    const { active, other } = await seedCategories();

    const first = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(token))
      .send({ name: "Shared", slug: "shared", categoryId: active.id });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(token))
      .send({ name: "Shared 2", slug: "shared", categoryId: active.id });
    expect(dup.status).toBe(409);

    const otherCat = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(token))
      .send({ name: "Shared", slug: "shared", categoryId: other.id });
    expect(otherCat.status).toBe(201);
  });

  it("updates name without changing slug; supports explicit slug and reassignment", async () => {
    const { token } = await asAdmin();
    const { active, other } = await seedCategories();
    const created = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(token))
      .send({ name: "Original", slug: "original", categoryId: active.id });
    const id = created.body.data.subcategory.id;

    const renamed = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(token))
      .send({ name: "Renamed" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.subcategory.slug).toBe("original");

    const slugged = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(token))
      .send({ slug: "renamed-slug" });
    expect(slugged.body.data.subcategory.slug).toBe("renamed-slug");

    const moved = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(token))
      .send({ categoryId: other.id });
    expect(moved.status).toBe(200);
    expect(moved.body.data.subcategory.categoryId).toBe(other.id);
  });

  it("blocks ACTIVE move/restore under archived parent", async () => {
    const { token } = await asAdmin();
    const { active, archived } = await seedCategories();
    const created = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(token))
      .send({ name: "Move Me", slug: "move-me", categoryId: active.id });
    const id = created.body.data.subcategory.id;

    const move = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(token))
      .send({ categoryId: archived.id });
    expect(move.status).toBe(409);

    await request(app)
      .delete(`/api/v1/subcategories/${id}`)
      .set(authHeaders(token));

    const parked = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(token))
      .send({ categoryId: archived.id, status: "ARCHIVED" });
    expect(parked.status).toBe(200);

    const restore = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(token))
      .send({ status: "ACTIVE" });
    expect(restore.status).toBe(409);
  });

  it("archives idempotently and restores under active parent", async () => {
    const { token } = await asAdmin();
    const { active } = await seedCategories();
    const created = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(token))
      .send({ name: "Temp", slug: "temp", categoryId: active.id });
    const id = created.body.data.subcategory.id;

    const first = await request(app)
      .delete(`/api/v1/subcategories/${id}`)
      .set(authHeaders(token));
    expect(first.status).toBe(200);
    expect(first.body.data.subcategory.status).toBe("ARCHIVED");

    const second = await request(app)
      .delete(`/api/v1/subcategories/${id}`)
      .set(authHeaders(token));
    expect(second.status).toBe(200);

    const restored = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(token))
      .send({ status: "ACTIVE" });
    expect(restored.status).toBe(200);
    expect(restored.body.data.subcategory.status).toBe("ACTIVE");
  });

  it("enforces auth, role and Bearer auth on mutations", async () => {
    const { active } = await seedCategories();

    const unauth = await request(app)
      .post("/api/v1/subcategories")
      .set("Origin", TEST_ORIGIN)
      .send({ name: "X", categoryId: active.id });
    expect(unauth.status).toBe(401);

    const { token: customerToken } = await asCustomer();
    const forbidden = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(customerToken))
      .send({ name: "X", categoryId: active.id });
    expect(forbidden.status).toBe(403);

    const { token } = await asAdmin();
    const created = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(token))
      .send({ name: "Admin Sub", slug: "admin-sub", categoryId: active.id });
    expect(created.status).toBe(201);

    const noBearer = await request(app)
      .patch(`/api/v1/subcategories/${created.body.data.subcategory.id}`)
      .set("Origin", TEST_ORIGIN)
      .send({ name: "Hacked" });
    expect(noBearer.status).toBe(401);
  });
});
