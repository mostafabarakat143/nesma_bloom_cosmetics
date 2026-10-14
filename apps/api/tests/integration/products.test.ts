import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../../src/modules/auth/password.service.js";
import { authHeaders, parseCookies, TEST_ORIGIN } from "../helpers/auth.js";
import { createAdminUser, loginAsAdmin } from "../helpers/admin.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("products CRUD and images", () => {
  const { app, prisma } = buildTestApp();

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.subcategory.deleteMany();
    await prisma.category.deleteMany();
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

  async function seedCatalog() {
    const activeCategory = await prisma.category.create({
      data: { name: "Skincare", slug: "skincare", status: "ACTIVE" },
    });
    const archivedCategory = await prisma.category.create({
      data: { name: "Legacy", slug: "legacy", status: "ARCHIVED" },
    });
    const otherCategory = await prisma.category.create({
      data: { name: "Makeup", slug: "makeup", status: "ACTIVE" },
    });

    const activeSub = await prisma.subcategory.create({
      data: {
        name: "Serums",
        slug: "serums",
        categoryId: activeCategory.id,
        status: "ACTIVE",
      },
    });
    const archivedSub = await prisma.subcategory.create({
      data: {
        name: "Old Line",
        slug: "old-line",
        categoryId: activeCategory.id,
        status: "ARCHIVED",
      },
    });
    const subUnderArchivedCategory = await prisma.subcategory.create({
      data: {
        name: "Archived Parent Sub",
        slug: "archived-parent-sub",
        categoryId: archivedCategory.id,
        status: "ARCHIVED",
      },
    });
    const otherSub = await prisma.subcategory.create({
      data: {
        name: "Lips",
        slug: "lips",
        categoryId: otherCategory.id,
        status: "ACTIVE",
      },
    });

    return {
      activeCategory,
      archivedCategory,
      otherCategory,
      activeSub,
      archivedSub,
      subUnderArchivedCategory,
      otherSub,
    };
  }

  function productBody(
    subcategoryId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      name: "Rose Serum",
      subcategoryId,
      sku: "SKU-ROSE-001",
      priceMinor: 25_000,
      stockQty: 10,
      ...overrides,
    };
  }

  it("creates a product under an active subcategory", async () => {
    const { cookies } = await asAdmin();
    const { activeSub, activeCategory } = await seedCatalog();

    const response = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(activeSub.id, { sku: "sku-rose-001" }));

    expect(response.status).toBe(201);
    const product = response.body.data.product;
    expect(product.slug).toBe("rose-serum");
    expect(product.sku).toBe("SKU-ROSE-001");
    expect(product.currency).toBe("EGP");
    expect(product.inStock).toBe(true);
    expect(product.subcategory.id).toBe(activeSub.id);
    expect(product.category.id).toBe(activeCategory.id);
    expect(product.images).toEqual([]);
  });

  it("returns 404 when subcategory is missing", async () => {
    const { cookies } = await asAdmin();
    const response = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody("00000000-0000-4000-8000-000000000099", {
          sku: "SKU-MISS-001",
        }),
      );
    expect(response.status).toBe(404);
  });

  it("rejects ACTIVE create under archived parents with 409", async () => {
    const { cookies } = await asAdmin();
    const { archivedSub, subUnderArchivedCategory } = await seedCatalog();

    const underArchivedSub = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(archivedSub.id, { sku: "SKU-ARCH-SUB" }));
    expect(underArchivedSub.status).toBe(409);

    const underArchivedCat = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody(subUnderArchivedCategory.id, {
          sku: "SKU-ARCH-CAT",
          status: "ACTIVE",
        }),
      );
    expect(underArchivedCat.status).toBe(409);
  });

  it("allows ARCHIVED product under archived parents for admin org", async () => {
    const { cookies } = await asAdmin();
    const { archivedSub } = await seedCatalog();

    const response = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody(archivedSub.id, {
          sku: "SKU-ORG-001",
          status: "ARCHIVED",
          name: "Legacy Serum",
        }),
      );

    expect(response.status).toBe(201);
    expect(response.body.data.product.status).toBe("ARCHIVED");
  });

  it("rejects duplicate SKU and slug with 409", async () => {
    const { cookies } = await asAdmin();
    const { activeSub } = await seedCatalog();

    await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(activeSub.id, { sku: "SKU-DUP-1", slug: "dup-slug" }));

    const dupSku = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody(activeSub.id, {
          sku: "sku-dup-1",
          name: "Other",
          slug: "other-slug",
        }),
      );
    expect(dupSku.status).toBe(409);

    const dupSlug = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody(activeSub.id, {
          sku: "SKU-DUP-2",
          slug: "dup-slug",
        }),
      );
    expect(dupSlug.status).toBe(409);
  });

  it("rejects invalid price, stock, SKU and overflowing integers", async () => {
    const { cookies } = await asAdmin();
    const { activeSub } = await seedCatalog();

    const negative = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(activeSub.id, { sku: "SKU-NEG", priceMinor: -1 }));
    expect(negative.status).toBe(400);

    const floatStock = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(activeSub.id, { sku: "SKU-FLOAT", stockQty: 1.5 }));
    expect(floatStock.status).toBe(400);

    const overflow = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody(activeSub.id, {
          sku: "SKU-BIG",
          priceMinor: 2_147_483_648,
        }),
      );
    expect(overflow.status).toBe(400);

    const badSku = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(activeSub.id, { sku: "bad sku!!" }));
    expect(badSku.status).toBe(400);
  });

  it("hides unavailable, archived and archived-parent products from public APIs", async () => {
    const { cookies } = await asAdmin();
    const { activeSub, archivedSub } = await seedCatalog();

    const visible = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(activeSub.id, { sku: "SKU-VIS", name: "Visible" }));

    const unavailable = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody(activeSub.id, {
          sku: "SKU-UNAV",
          name: "Hidden Unav",
          isAvailable: false,
        }),
      );

    const archived = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody(activeSub.id, {
          sku: "SKU-ARCH",
          name: "Hidden Arch",
          status: "ARCHIVED",
        }),
      );

    const underArchived = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody(archivedSub.id, {
          sku: "SKU-PAR",
          name: "Hidden Parent",
          status: "ARCHIVED",
        }),
      );

    const list = await request(app).get("/api/v1/products");
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].id).toBe(visible.body.data.product.id);

    expect(
      (await request(app).get(`/api/v1/products/${unavailable.body.data.product.id}`))
        .status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/v1/products/${archived.body.data.product.id}`))
        .status,
    ).toBe(404);
    expect(
      (
        await request(app).get(
          `/api/v1/products/${underArchived.body.data.product.id}`,
        )
      ).status,
    ).toBe(404);
  });

  it("keeps out-of-stock products publicly visible with inStock false", async () => {
    const { cookies } = await asAdmin();
    const { activeSub } = await seedCatalog();

    const created = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody(activeSub.id, {
          sku: "SKU-OOS",
          stockQty: 0,
          name: "Out of Stock Serum",
        }),
      );

    expect(created.body.data.product.inStock).toBe(false);

    const list = await request(app).get("/api/v1/products");
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].inStock).toBe(false);

    const detail = await request(app).get(
      `/api/v1/products/${created.body.data.product.id}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.data.product.inStock).toBe(false);
  });

  it("lets ADMIN list unavailable/archived and filter by category", async () => {
    const { cookies } = await asAdmin();
    const { activeSub, otherSub, activeCategory } = await seedCatalog();

    await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(activeSub.id, { sku: "SKU-A1", name: "Alpha" }));
    await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody(otherSub.id, {
          sku: "SKU-B1",
          name: "Beta Lip",
          priceMinor: 10_000,
        }),
      );
    await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(
        productBody(activeSub.id, {
          sku: "SKU-C1",
          name: "Hidden",
          isAvailable: false,
        }),
      );

    const byCategory = await request(app)
      .get("/api/v1/products")
      .set(authHeaders(cookies))
      .query({ categoryId: activeCategory.id, sortBy: "name", sortOrder: "asc" });
    expect(byCategory.status).toBe(200);
    expect(byCategory.body.data.items).toHaveLength(1);
    expect(byCategory.body.data.items[0].name).toBe("Alpha");

    const unavailable = await request(app)
      .get("/api/v1/products")
      .set(authHeaders(cookies))
      .query({ availability: "UNAVAILABLE" });
    expect(unavailable.body.data.items).toHaveLength(1);
    expect(unavailable.body.data.items[0].sku).toBe("SKU-C1");

    const search = await request(app)
      .get("/api/v1/products")
      .query({ search: "lip", sortBy: "priceMinor", sortOrder: "asc" });
    expect(search.body.data.items).toHaveLength(1);
    expect(search.body.data.items[0].name).toBe("Beta Lip");
  });

  it("supports pagination, price filters and stable sorting", async () => {
    const { cookies } = await asAdmin();
    const { activeSub } = await seedCatalog();

    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post("/api/v1/products")
        .set(authHeaders(cookies))
        .send(
          productBody(activeSub.id, {
            sku: `SKU-PAG-${i}`,
            name: `Product ${i}`,
            priceMinor: (i + 1) * 1000,
          }),
        );
    }

    const page1 = await request(app)
      .get("/api/v1/products")
      .query({ page: 1, pageSize: 2, sortBy: "priceMinor", sortOrder: "asc" });
    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.meta.totalItems).toBe(3);
    expect(page1.body.data.meta.totalPages).toBe(2);

    const priced = await request(app)
      .get("/api/v1/products")
      .query({ minPriceMinor: 2000, maxPriceMinor: 3000 });
    expect(priced.body.data.items).toHaveLength(2);
  });

  it("returns 403 for non-admin status=ALL or availability=ALL", async () => {
    const { cookies } = await asCustomer();

    const statusAll = await request(app)
      .get("/api/v1/products")
      .set(authHeaders(cookies))
      .query({ status: "ALL" });
    expect(statusAll.status).toBe(403);

    const availAll = await request(app)
      .get("/api/v1/products")
      .set(authHeaders(cookies))
      .query({ availability: "ALL" });
    expect(availAll.status).toBe(403);
  });

  it("updates name without changing slug; supports reassignment and restore rules", async () => {
    const { cookies } = await asAdmin();
    const { activeSub, otherSub, archivedSub } = await seedCatalog();

    const created = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(activeSub.id, { sku: "SKU-UPD", slug: "keep-slug" }));
    const id = created.body.data.product.id;

    const renamed = await request(app)
      .patch(`/api/v1/products/${id}`)
      .set(authHeaders(cookies))
      .send({ name: "New Display Name" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.product.name).toBe("New Display Name");
    expect(renamed.body.data.product.slug).toBe("keep-slug");

    const moved = await request(app)
      .patch(`/api/v1/products/${id}`)
      .set(authHeaders(cookies))
      .send({ subcategoryId: otherSub.id });
    expect(moved.status).toBe(200);
    expect(moved.body.data.product.subcategoryId).toBe(otherSub.id);

    const badMove = await request(app)
      .patch(`/api/v1/products/${id}`)
      .set(authHeaders(cookies))
      .send({ subcategoryId: archivedSub.id });
    expect(badMove.status).toBe(409);

    await request(app)
      .delete(`/api/v1/products/${id}`)
      .set(authHeaders(cookies));

    const badRestore = await request(app)
      .patch(`/api/v1/products/${id}`)
      .set(authHeaders(cookies))
      .send({ subcategoryId: archivedSub.id, status: "ACTIVE" });
    expect(badRestore.status).toBe(409);

    const restore = await request(app)
      .patch(`/api/v1/products/${id}`)
      .set(authHeaders(cookies))
      .send({ subcategoryId: activeSub.id, status: "ACTIVE" });
    expect(restore.status).toBe(200);
    expect(restore.body.data.product.status).toBe("ACTIVE");
  });

  it("archives idempotently and preserves images", async () => {
    const { cookies } = await asAdmin();
    const { activeSub } = await seedCatalog();

    const created = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(activeSub.id, { sku: "SKU-DEL" }));
    const id = created.body.data.product.id;

    await request(app)
      .post(`/api/v1/products/${id}/images`)
      .set(authHeaders(cookies))
      .send({ url: "https://cdn.example.com/a.jpg", isPrimary: true });

    const first = await request(app)
      .delete(`/api/v1/products/${id}`)
      .set(authHeaders(cookies));
    expect(first.status).toBe(200);
    expect(first.body.data.product.status).toBe("ARCHIVED");
    expect(first.body.data.product.images).toHaveLength(1);

    const second = await request(app)
      .delete(`/api/v1/products/${id}`)
      .set(authHeaders(cookies));
    expect(second.status).toBe(200);
    expect(second.body.data.product.status).toBe("ARCHIVED");
    expect(second.body.data.product.images).toHaveLength(1);
  });

  it("enforces auth, role and CSRF on product mutations", async () => {
    const { activeSub } = await seedCatalog();
    const { cookies: customer } = await asCustomer();
    const { cookies: admin } = await asAdmin();

    const anon = await request(app)
      .post("/api/v1/products")
      .set("Origin", TEST_ORIGIN)
      .send(productBody(activeSub.id, { sku: "SKU-ANON" }));
    expect(anon.status).toBe(401);

    const role = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(customer))
      .send(productBody(activeSub.id, { sku: "SKU-ROLE" }));
    expect(role.status).toBe(403);

    const csrf = await request(app)
      .post("/api/v1/products")
      .set("Origin", TEST_ORIGIN)
      .set(
        "Cookie",
        Object.entries(admin)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      )
      .send(productBody(activeSub.id, { sku: "SKU-CSRF" }));
    expect(csrf.status).toBe(403);
  });

  it("manages images: ordering, primary uniqueness, conflicts and promotion", async () => {
    const { cookies } = await asAdmin();
    const { activeSub } = await seedCatalog();

    const created = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(activeSub.id, { sku: "SKU-IMG" }));
    const productId = created.body.data.product.id;

    const img1 = await request(app)
      .post(`/api/v1/products/${productId}/images`)
      .set(authHeaders(cookies))
      .send({
        url: "https://cdn.example.com/one.jpg",
        sortOrder: 0,
        isPrimary: true,
        altText: "One",
      });
    expect(img1.status).toBe(201);
    expect(img1.body.data.product.images).toHaveLength(1);
    expect(img1.body.data.product.images[0].isPrimary).toBe(true);
    const image1Id = img1.body.data.product.images[0].id;

    const img2 = await request(app)
      .post(`/api/v1/products/${productId}/images`)
      .set(authHeaders(cookies))
      .send({
        url: "https://cdn.example.com/two.jpg",
        sortOrder: 1,
        isPrimary: true,
      });
    expect(img2.status).toBe(201);
    const imagesAfterPrimary = img2.body.data.product.images;
    expect(imagesAfterPrimary.filter((i: { isPrimary: boolean }) => i.isPrimary)).toHaveLength(
      1,
    );
    expect(imagesAfterPrimary.find((i: { id: string }) => i.id === image1Id)?.isPrimary).toBe(
      false,
    );
    const image2Id = imagesAfterPrimary.find(
      (i: { sortOrder: number }) => i.sortOrder === 1,
    ).id;

    const conflict = await request(app)
      .post(`/api/v1/products/${productId}/images`)
      .set(authHeaders(cookies))
      .send({ url: "https://cdn.example.com/three.jpg", sortOrder: 1 });
    expect(conflict.status).toBe(409);

    const badUrl = await request(app)
      .post(`/api/v1/products/${productId}/images`)
      .set(authHeaders(cookies))
      .send({ url: "javascript:alert(1)" });
    expect(badUrl.status).toBe(400);

    const withCreds = await request(app)
      .post(`/api/v1/products/${productId}/images`)
      .set(authHeaders(cookies))
      .send({ url: "https://user:pass@cdn.example.com/x.jpg" });
    expect(withCreds.status).toBe(400);

    const mismatch = await request(app)
      .patch(
        `/api/v1/products/${productId}/images/00000000-0000-4000-8000-000000000099`,
      )
      .set(authHeaders(cookies))
      .send({ altText: "Nope" });
    expect(mismatch.status).toBe(404);

    const deleted = await request(app)
      .delete(`/api/v1/products/${productId}/images/${image2Id}`)
      .set(authHeaders(cookies));
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.product.images).toHaveLength(1);
    expect(deleted.body.data.product.images[0].id).toBe(image1Id);
    expect(deleted.body.data.product.images[0].isPrimary).toBe(true);

    const lastDelete = await request(app)
      .delete(`/api/v1/products/${productId}/images/${image1Id}`)
      .set(authHeaders(cookies));
    expect(lastDelete.status).toBe(200);
    expect(lastDelete.body.data.product.images).toHaveLength(0);
  });

  it("handles concurrent primary-image assignment safely", async () => {
    const { cookies } = await asAdmin();
    const { activeSub } = await seedCatalog();

    const created = await request(app)
      .post("/api/v1/products")
      .set(authHeaders(cookies))
      .send(productBody(activeSub.id, { sku: "SKU-CONC" }));
    const productId = created.body.data.product.id;

    const a = await request(app)
      .post(`/api/v1/products/${productId}/images`)
      .set(authHeaders(cookies))
      .send({ url: "https://cdn.example.com/a.jpg", sortOrder: 0 });
    const b = await request(app)
      .post(`/api/v1/products/${productId}/images`)
      .set(authHeaders(cookies))
      .send({ url: "https://cdn.example.com/b.jpg", sortOrder: 1 });

    const imageA = a.body.data.product.images[0].id;
    const imageB = b.body.data.product.images.find(
      (i: { sortOrder: number }) => i.sortOrder === 1,
    ).id;

    const [r1, r2] = await Promise.all([
      request(app)
        .patch(`/api/v1/products/${productId}/images/${imageA}`)
        .set(authHeaders(cookies))
        .send({ isPrimary: true }),
      request(app)
        .patch(`/api/v1/products/${productId}/images/${imageB}`)
        .set(authHeaders(cookies))
        .send({ isPrimary: true }),
    ]);

    expect([r1.status, r2.status].every((s) => s === 200 || s === 409)).toBe(
      true,
    );

    const detail = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set(authHeaders(cookies));
    const primaries = detail.body.data.product.images.filter(
      (i: { isPrimary: boolean }) => i.isPrimary,
    );
    expect(primaries).toHaveLength(1);
  });
});
