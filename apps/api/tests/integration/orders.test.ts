import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../../src/modules/auth/password.service.js";
import { authHeaders, parseCookies, TEST_ORIGIN } from "../helpers/auth.js";
import { createAdminUser, loginAsAdmin } from "../helpers/admin.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("orders management", () => {
  const { app, prisma } = buildTestApp();

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
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
    return { cookies, admin };
  }

  async function asCustomer(email = `customer-${Date.now()}@example.com`) {
    const password = "Password123!";
    const user = await prisma.user.create({
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
    return { cookies: parseCookies(login), user, password, email };
  }

  async function seedCatalog(stockQty = 10, priceMinor = 25_000) {
    const category = await prisma.category.create({
      data: { name: "Skincare", slug: `skin-${Date.now()}`, status: "ACTIVE" },
    });
    const archivedCategory = await prisma.category.create({
      data: {
        name: "Legacy",
        slug: `legacy-${Date.now()}`,
        status: "ARCHIVED",
      },
    });
    const subcategory = await prisma.subcategory.create({
      data: {
        name: "Serums",
        slug: `serums-${Date.now()}`,
        categoryId: category.id,
        status: "ACTIVE",
      },
    });
    const archivedSub = await prisma.subcategory.create({
      data: {
        name: "Old",
        slug: `old-${Date.now()}`,
        categoryId: category.id,
        status: "ARCHIVED",
      },
    });
    const product = await prisma.product.create({
      data: {
        name: "Rose Serum",
        slug: `rose-${Date.now()}`,
        sku: `SKU-${Date.now()}`,
        subcategoryId: subcategory.id,
        priceMinor,
        stockQty,
        isAvailable: true,
        status: "ACTIVE",
      },
    });
    return {
      category,
      archivedCategory,
      subcategory,
      archivedSub,
      product,
    };
  }

  it("creates an order with snapshots, totals and stock deduction", async () => {
    const { cookies } = await asCustomer();
    const { product } = await seedCatalog(10, 25_000);

    const response = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(cookies))
      .send({ items: [{ productId: product.id, quantity: 2 }] });

    expect(response.status).toBe(201);
    const order = response.body.data.order;
    expect(order.status).toBe("PENDING");
    expect(order.currency).toBe("EGP");
    expect(order.totalMinor).toBe(50_000);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      productId: product.id,
      productNameSnapshot: "Rose Serum",
      productSkuSnapshot: product.sku,
      unitPriceMinor: 25_000,
      quantity: 2,
      lineTotalMinor: 50_000,
    });

    const stock = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(stock.stockQty).toBe(8);

    await prisma.product.update({
      where: { id: product.id },
      data: { priceMinor: 99_999, name: "Changed" },
    });

    const detail = await request(app)
      .get(`/api/v1/orders/${order.id}`)
      .set(authHeaders(cookies));
    expect(detail.body.data.order.items[0].unitPriceMinor).toBe(25_000);
    expect(detail.body.data.order.items[0].productNameSnapshot).toBe(
      "Rose Serum",
    );
  });

  it("rejects empty, duplicate, invalid quantity and overflow", async () => {
    const { cookies } = await asCustomer();
    const { product } = await seedCatalog();

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(cookies))
          .send({ items: [] })
      ).status,
    ).toBe(400);

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(cookies))
          .send({
            items: [
              { productId: product.id, quantity: 1 },
              { productId: product.id, quantity: 2 },
            ],
          })
      ).status,
    ).toBe(400);

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(cookies))
          .send({ items: [{ productId: product.id, quantity: 0 }] })
      ).status,
    ).toBe(400);

    await prisma.product.update({
      where: { id: product.id },
      data: { priceMinor: 2_147_483_647, stockQty: 100 },
    });

    const overflow = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(cookies))
      .send({ items: [{ productId: product.id, quantity: 2 }] });
    expect(overflow.status).toBe(400);

    const stock = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(stock.stockQty).toBe(100);
  });

  it("rejects missing, unavailable and archived-parent products", async () => {
    const { cookies } = await asCustomer();
    const { product, archivedSub, subcategory } = await seedCatalog();

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(cookies))
          .send({
            items: [
              {
                productId: "00000000-0000-4000-8000-000000000099",
                quantity: 1,
              },
            ],
          })
      ).status,
    ).toBe(404);

    await prisma.product.update({
      where: { id: product.id },
      data: { isAvailable: false },
    });
    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(cookies))
          .send({ items: [{ productId: product.id, quantity: 1 }] })
      ).status,
    ).toBe(409);

    await prisma.product.update({
      where: { id: product.id },
      data: { isAvailable: true, subcategoryId: archivedSub.id },
    });
    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(cookies))
          .send({ items: [{ productId: product.id, quantity: 1 }] })
      ).status,
    ).toBe(409);

    await prisma.product.update({
      where: { id: product.id },
      data: { subcategoryId: subcategory.id, status: "ARCHIVED" },
    });
    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(cookies))
          .send({ items: [{ productId: product.id, quantity: 1 }] })
      ).status,
    ).toBe(409);
  });

  it("rejects insufficient stock and rolls back multi-item failure", async () => {
    const { cookies } = await asCustomer();
    const { subcategory } = await seedCatalog(1);
    const a = await prisma.product.findFirstOrThrow({
      where: { subcategoryId: subcategory.id },
    });
    const b = await prisma.product.create({
      data: {
        name: "Second",
        slug: `second-${Date.now()}`,
        sku: `SKU-B-${Date.now()}`,
        subcategoryId: subcategory.id,
        priceMinor: 1000,
        stockQty: 5,
        status: "ACTIVE",
        isAvailable: true,
      },
    });

    const insufficient = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(cookies))
      .send({ items: [{ productId: a.id, quantity: 2 }] });
    expect(insufficient.status).toBe(409);

    // Order product ids so B is decremented first, then A fails → full rollback
    const ids = [a.id, b.id].sort();
    const items = ids.map((productId) => ({
      productId,
      quantity: productId === a.id ? 2 : 1,
    }));

    const multi = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(cookies))
      .send({ items });
    expect(multi.status).toBe(409);

    const stockA = await prisma.product.findUniqueOrThrow({ where: { id: a.id } });
    const stockB = await prisma.product.findUniqueOrThrow({ where: { id: b.id } });
    expect(stockA.stockQty).toBe(1);
    expect(stockB.stockQty).toBe(5);
  });

  it("allows only one concurrent checkout of the last unit", async () => {
    const customerA = await asCustomer(`a-${Date.now()}@example.com`);
    const customerB = await asCustomer(`b-${Date.now()}@example.com`);
    const { product } = await seedCatalog(1);

    const [r1, r2] = await Promise.all([
      request(app)
        .post("/api/v1/orders")
        .set(authHeaders(customerA.cookies))
        .send({ items: [{ productId: product.id, quantity: 1 }] }),
      request(app)
        .post("/api/v1/orders")
        .set(authHeaders(customerB.cookies))
        .send({ items: [{ productId: product.id, quantity: 1 }] }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const stock = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(stock.stockQty).toBe(0);

    const orderCount = await prisma.order.count();
    expect(orderCount).toBe(1);
  });

  it("enforces ownership and ADMIN listing", async () => {
    const customerA = await asCustomer(`own-a-${Date.now()}@example.com`);
    const customerB = await asCustomer(`own-b-${Date.now()}@example.com`);
    const { cookies: adminCookies } = await asAdmin();
    const { product } = await seedCatalog();

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(customerA.cookies))
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    const orderId = created.body.data.order.id;

    expect(
      (
        await request(app)
          .get(`/api/v1/orders/${orderId}`)
          .set(authHeaders(customerB.cookies))
      ).status,
    ).toBe(404);

    const mine = await request(app)
      .get("/api/v1/orders/my")
      .set(authHeaders(customerA.cookies));
    expect(mine.status).toBe(200);
    expect(mine.body.data.items).toHaveLength(1);

    const adminList = await request(app)
      .get("/api/v1/orders")
      .set(authHeaders(adminCookies))
      .query({ userId: customerA.user.id });
    expect(adminList.status).toBe(200);
    expect(adminList.body.data.items).toHaveLength(1);

    expect(
      (
        await request(app)
          .get("/api/v1/orders")
          .set(authHeaders(customerA.cookies))
      ).status,
    ).toBe(403);
  });

  it("applies status transitions and blocks invalid ones", async () => {
    const { cookies: customerCookies } = await asCustomer();
    const { cookies: adminCookies } = await asAdmin();
    const { product } = await seedCatalog();

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(customerCookies))
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    const orderId = created.body.data.order.id;

    const skip = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminCookies))
      .send({ status: "FULFILLED" });
    expect(skip.status).toBe(409);

    const confirmed = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminCookies))
      .send({ status: "CONFIRMED" });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.order.status).toBe("CONFIRMED");

    const fulfilled = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminCookies))
      .send({ status: "FULFILLED" });
    expect(fulfilled.status).toBe(200);
    expect(fulfilled.body.data.order.status).toBe("FULFILLED");

    const again = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminCookies))
      .send({ status: "CONFIRMED" });
    expect(again.status).toBe(409);
  });

  it("cancels with single restock and supports idempotent repeat cancel", async () => {
    const { cookies } = await asCustomer();
    const { product } = await seedCatalog(5);

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(cookies))
      .send({ items: [{ productId: product.id, quantity: 3 }] });
    const orderId = created.body.data.order.id;

    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stockQty,
    ).toBe(2);

    const cancel = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set(authHeaders(cookies));
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.order.status).toBe("CANCELLED");
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stockQty,
    ).toBe(5);

    const again = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set(authHeaders(cookies));
    expect(again.status).toBe(200);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stockQty,
    ).toBe(5);
  });

  it("handles concurrent cancellation with a single restock", async () => {
    const { cookies: customerCookies } = await asCustomer();
    const { cookies: adminCookies } = await asAdmin();
    const { product } = await seedCatalog(4);

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(customerCookies))
      .send({ items: [{ productId: product.id, quantity: 2 }] });
    const orderId = created.body.data.order.id;

    const [c1, c2] = await Promise.all([
      request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set(authHeaders(customerCookies)),
      request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set(authHeaders(adminCookies)),
    ]);

    expect([c1.status, c2.status].every((s) => s === 200)).toBe(true);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stockQty,
    ).toBe(4);
  });

  it("resolves cancel versus fulfill races without double restock", async () => {
    const { cookies: customerCookies } = await asCustomer();
    const { cookies: adminCookies } = await asAdmin();
    const { product } = await seedCatalog(3);

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(customerCookies))
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    const orderId = created.body.data.order.id;

    await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminCookies))
      .send({ status: "CONFIRMED" });

    const [cancel, fulfill] = await Promise.all([
      request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set(authHeaders(adminCookies)),
      request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set(authHeaders(adminCookies))
        .send({ status: "FULFILLED" }),
    ]);

    const outcomes = [cancel.status, fulfill.status].sort();
    expect(outcomes).toEqual([200, 409]);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(["CANCELLED", "FULFILLED"]).toContain(order.status);

    const stock = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    if (order.status === "CANCELLED") {
      expect(stock.stockQty).toBe(3);
    } else {
      expect(stock.stockQty).toBe(2);
    }
  });

  it("blocks customer cancel of CONFIRMED and foreign cancel with 404", async () => {
    const customerA = await asCustomer(`c1-${Date.now()}@example.com`);
    const customerB = await asCustomer(`c2-${Date.now()}@example.com`);
    const { cookies: adminCookies } = await asAdmin();
    const { product } = await seedCatalog();

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(customerA.cookies))
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    const orderId = created.body.data.order.id;

    await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminCookies))
      .send({ status: "CONFIRMED" });

    expect(
      (
        await request(app)
          .post(`/api/v1/orders/${orderId}/cancel`)
          .set(authHeaders(customerA.cookies))
      ).status,
    ).toBe(409);

    expect(
      (
        await request(app)
          .post(`/api/v1/orders/${orderId}/cancel`)
          .set(authHeaders(customerB.cookies))
      ).status,
    ).toBe(404);
  });

  it("enforces auth, role and CSRF on mutations", async () => {
    const { product } = await seedCatalog();
    const { cookies: customer } = await asCustomer();
    const { cookies: admin } = await asAdmin();

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set("Origin", TEST_ORIGIN)
          .send({ items: [{ productId: product.id, quantity: 1 }] })
      ).status,
    ).toBe(401);

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(admin))
          .send({ items: [{ productId: product.id, quantity: 1 }] })
      ).status,
    ).toBe(403);

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set("Origin", TEST_ORIGIN)
          .set(
            "Cookie",
            Object.entries(customer)
              .map(([k, v]) => `${k}=${v}`)
              .join("; "),
          )
          .send({ items: [{ productId: product.id, quantity: 1 }] })
      ).status,
    ).toBe(403);
  });
});
