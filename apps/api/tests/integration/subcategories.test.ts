import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../../src/modules/auth/password.service.js";
import { authHeaders, parseCookies, TEST_ORIGIN } from "../helpers/auth.js";
import { createAdminUser, loginAsAdmin } from "../helpers/admin.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("subcategories CRUD", () => {
  const { app, prisma } = buildTestApp();

  beforeEach(async () => {
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
    const cookies = await loginAsAdmin(app, admin.email, admin.password);
    return { cookies };
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
    return { cookies: parseCookies(login) };
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
    const { cookies } = await asAdmin();
    const { active } = await seedCategories();

    const response = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(cookies))
      .send({ name: "Lip Care", categoryId: active.id });

    expect(response.status).toBe(201);
    expect(response.body.data.subcategory.slug).toBe("lip-care");
    expect(response.body.data.subcategory.categoryId).toBe(active.id);
    expect(response.body.data.subcategory.category.status).toBe("ACTIVE");
  });

  it("returns 404 when parent category is missing", async () => {
    const { cookies } = await asAdmin();
    const response = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(cookies))
      .send({
        name: "Orphan",
        categoryId: "00000000-0000-4000-8000-000000000000",
      });
    expect(response.status).toBe(404);
  });

  it("rejects ACTIVE create under archived parent with 409", async () => {
    const { cookies } = await asAdmin();
    const { archived } = await seedCategories();

    const response = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(cookies))
      .send({
        name: "Blocked",
        categoryId: archived.id,
        status: "ACTIVE",
      });
    expect(response.status).toBe(409);
  });

  it("allows ARCHIVED subcategory under archived parent for admin org", async () => {
    const { cookies } = await asAdmin();
    const { archived } = await seedCategories();

    const response = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(cookies))
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
    const { cookies } = await asAdmin();
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
      .set(authHeaders(cookies));
    expect(list.status).toBe(200);
    expect(list.body.data.meta.totalItems).toBe(2);

    const detail = await request(app)
      .get(`/api/v1/subcategories/${under.id}`)
      .set(authHeaders(cookies));
    expect(detail.status).toBe(200);
  });

  it("returns 403 for non-admin status=ALL", async () => {
    expect((await request(app).get("/api/v1/subcategories?status=ALL")).status).toBe(
      403,
    );
    const { cookies } = await asCustomer();
    expect(
      (
        await request(app)
          .get("/api/v1/subcategories?status=ARCHIVED")
          .set(authHeaders(cookies))
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
    const { cookies } = await asAdmin();
    const { active, other } = await seedCategories();

    const first = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(cookies))
      .send({ name: "Shared", slug: "shared", categoryId: active.id });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(cookies))
      .send({ name: "Shared 2", slug: "shared", categoryId: active.id });
    expect(dup.status).toBe(409);

    const otherCat = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(cookies))
      .send({ name: "Shared", slug: "shared", categoryId: other.id });
    expect(otherCat.status).toBe(201);
  });

  it("updates name without changing slug; supports explicit slug and reassignment", async () => {
    const { cookies } = await asAdmin();
    const { active, other } = await seedCategories();
    const created = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(cookies))
      .send({ name: "Original", slug: "original", categoryId: active.id });
    const id = created.body.data.subcategory.id;

    const renamed = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(cookies))
      .send({ name: "Renamed" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.subcategory.slug).toBe("original");

    const slugged = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(cookies))
      .send({ slug: "renamed-slug" });
    expect(slugged.body.data.subcategory.slug).toBe("renamed-slug");

    const moved = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(cookies))
      .send({ categoryId: other.id });
    expect(moved.status).toBe(200);
    expect(moved.body.data.subcategory.categoryId).toBe(other.id);
  });

  it("blocks ACTIVE move/restore under archived parent", async () => {
    const { cookies } = await asAdmin();
    const { active, archived } = await seedCategories();
    const created = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(cookies))
      .send({ name: "Move Me", slug: "move-me", categoryId: active.id });
    const id = created.body.data.subcategory.id;

    const move = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(cookies))
      .send({ categoryId: archived.id });
    expect(move.status).toBe(409);

    await request(app)
      .delete(`/api/v1/subcategories/${id}`)
      .set(authHeaders(cookies));

    const parked = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(cookies))
      .send({ categoryId: archived.id, status: "ARCHIVED" });
    expect(parked.status).toBe(200);

    const restore = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(cookies))
      .send({ status: "ACTIVE" });
    expect(restore.status).toBe(409);
  });

  it("archives idempotently and restores under active parent", async () => {
    const { cookies } = await asAdmin();
    const { active } = await seedCategories();
    const created = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(cookies))
      .send({ name: "Temp", slug: "temp", categoryId: active.id });
    const id = created.body.data.subcategory.id;

    const first = await request(app)
      .delete(`/api/v1/subcategories/${id}`)
      .set(authHeaders(cookies));
    expect(first.status).toBe(200);
    expect(first.body.data.subcategory.status).toBe("ARCHIVED");

    const second = await request(app)
      .delete(`/api/v1/subcategories/${id}`)
      .set(authHeaders(cookies));
    expect(second.status).toBe(200);

    const restored = await request(app)
      .patch(`/api/v1/subcategories/${id}`)
      .set(authHeaders(cookies))
      .send({ status: "ACTIVE" });
    expect(restored.status).toBe(200);
    expect(restored.body.data.subcategory.status).toBe("ACTIVE");
  });

  it("enforces auth, role and CSRF on mutations", async () => {
    const { active } = await seedCategories();

    const unauth = await request(app)
      .post("/api/v1/subcategories")
      .set("Origin", TEST_ORIGIN)
      .send({ name: "X", categoryId: active.id });
    expect(unauth.status).toBe(401);

    const { cookies: customerCookies } = await asCustomer();
    const forbidden = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(customerCookies))
      .send({ name: "X", categoryId: active.id });
    expect(forbidden.status).toBe(403);

    const { cookies } = await asAdmin();
    const created = await request(app)
      .post("/api/v1/subcategories")
      .set(authHeaders(cookies))
      .send({ name: "CSRF", slug: "csrf", categoryId: active.id });

    const noCsrf = await request(app)
      .patch(`/api/v1/subcategories/${created.body.data.subcategory.id}`)
      .set("Origin", TEST_ORIGIN)
      .set(
        "Cookie",
        Object.entries(cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      )
      .send({ name: "Hacked" });
    expect(noCsrf.status).toBe(403);
  });
});
