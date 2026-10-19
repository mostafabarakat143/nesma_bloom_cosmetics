import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../../src/modules/auth/password.service.js";
import { authHeaders, TEST_ORIGIN, extractToken } from "../helpers/auth.js";
import { createAdminUser, loginAsAdmin } from "../helpers/admin.js";
import { buildTestApp } from "../helpers/test-app.js";

describe("orders management", () => {
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

  let idempotencySeq = 0;
  function nextIdempotencyKey(prefix = "ord") {
    idempotencySeq += 1;
    return `${prefix}-${Date.now()}-${idempotencySeq}`;
  }

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function asAdmin() {
    const admin = await createAdminUser(prisma);
    const token = await loginAsAdmin(app, admin.email, admin.password);
    return { token, admin };
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
    return { token: extractToken(login), user, password, email };
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
    const { token } = await asCustomer();
    const { product } = await seedCatalog(10, 25_000);

    const response = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(token))
      .set("Idempotency-Key", nextIdempotencyKey())
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
      .set(authHeaders(token));
    expect(detail.body.data.order.items[0].unitPriceMinor).toBe(25_000);
    expect(detail.body.data.order.items[0].productNameSnapshot).toBe(
      "Rose Serum",
    );
  });

  it("rejects empty, duplicate, invalid quantity and overflow", async () => {
    const { token } = await asCustomer();
    const { product } = await seedCatalog();

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(token))
          .set("Idempotency-Key", nextIdempotencyKey())
          .send({ items: [] })
      ).status,
    ).toBe(400);

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(token))
          .set("Idempotency-Key", nextIdempotencyKey())
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
          .set(authHeaders(token))
          .set("Idempotency-Key", nextIdempotencyKey())
          .send({ items: [{ productId: product.id, quantity: 0 }] })
      ).status,
    ).toBe(400);

    await prisma.product.update({
      where: { id: product.id },
      data: { priceMinor: 2_147_483_647, stockQty: 100 },
    });

    const overflow = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(token))
      .set("Idempotency-Key", nextIdempotencyKey())
      .send({ items: [{ productId: product.id, quantity: 2 }] });
    expect(overflow.status).toBe(400);

    const stock = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(stock.stockQty).toBe(100);
  });

  it("rejects missing, unavailable and archived-parent products", async () => {
    const { token } = await asCustomer();
    const { product, archivedSub, subcategory } = await seedCatalog();

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(token))
          .set("Idempotency-Key", nextIdempotencyKey())
          .send({
            items: [
              {
                productId: 999_999_999,
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
          .set(authHeaders(token))
          .set("Idempotency-Key", nextIdempotencyKey())
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
          .set(authHeaders(token))
          .set("Idempotency-Key", nextIdempotencyKey())
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
          .set(authHeaders(token))
          .set("Idempotency-Key", nextIdempotencyKey())
          .send({ items: [{ productId: product.id, quantity: 1 }] })
      ).status,
    ).toBe(409);
  });

  it("rejects insufficient stock and rolls back multi-item failure", async () => {
    const { token } = await asCustomer();
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
      .set(authHeaders(token))
      .set("Idempotency-Key", nextIdempotencyKey())
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
      .set(authHeaders(token))
      .set("Idempotency-Key", nextIdempotencyKey())
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
        .set(authHeaders(customerA.token))
        .set("Idempotency-Key", nextIdempotencyKey())
        .send({ items: [{ productId: product.id, quantity: 1 }] }),
      request(app)
        .post("/api/v1/orders")
        .set(authHeaders(customerB.token))
        .set("Idempotency-Key", nextIdempotencyKey())
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
    const { token: adminToken } = await asAdmin();
    const { product } = await seedCatalog();

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(customerA.token))
      .set("Idempotency-Key", nextIdempotencyKey())
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    const orderId = created.body.data.order.id;

    expect(
      (
        await request(app)
          .get(`/api/v1/orders/${orderId}`)
          .set(authHeaders(customerB.token))
      ).status,
    ).toBe(404);

    const mine = await request(app)
      .get("/api/v1/orders/my")
      .set(authHeaders(customerA.token));
    expect(mine.status).toBe(200);
    expect(mine.body.data.items).toHaveLength(1);

    const adminList = await request(app)
      .get("/api/v1/orders")
      .set(authHeaders(adminToken))
      .query({ userId: customerA.user.id });
    expect(adminList.status).toBe(200);
    expect(adminList.body.data.items).toHaveLength(1);
    expect(adminList.body.data.items[0].customer).toEqual({
      id: customerA.user.id,
      email: customerA.email,
      firstName: null,
      lastName: null,
    });
    expect(mine.body.data.items[0].customer).toBeUndefined();

    const adminDetail = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set(authHeaders(adminToken));
    expect(adminDetail.status).toBe(200);
    expect(adminDetail.body.data.order.customer.email).toBe(customerA.email);

    const ownerDetail = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set(authHeaders(customerA.token));
    expect(ownerDetail.status).toBe(200);
    expect(ownerDetail.body.data.order.customer).toBeUndefined();

    expect(
      (
        await request(app)
          .get("/api/v1/orders")
          .set(authHeaders(customerA.token))
      ).status,
    ).toBe(403);
  });

  it("applies status transitions and blocks invalid ones", async () => {
    const { token: customerToken } = await asCustomer();
    const { token: adminToken } = await asAdmin();
    const { product } = await seedCatalog();

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(customerToken))
      .set("Idempotency-Key", nextIdempotencyKey())
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    const orderId = created.body.data.order.id;

    const skip = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminToken))
      .send({ status: "FULFILLED" });
    expect(skip.status).toBe(409);

    const confirmed = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminToken))
      .send({ status: "CONFIRMED" });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.order.status).toBe("CONFIRMED");

    const fulfilled = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminToken))
      .send({ status: "FULFILLED" });
    expect(fulfilled.status).toBe(200);
    expect(fulfilled.body.data.order.status).toBe("FULFILLED");

    const again = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminToken))
      .send({ status: "CONFIRMED" });
    expect(again.status).toBe(409);
  });

  it("cancels with single restock and supports idempotent repeat cancel", async () => {
    const { token } = await asCustomer();
    const { product } = await seedCatalog(5);

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(token))
      .set("Idempotency-Key", nextIdempotencyKey())
      .send({ items: [{ productId: product.id, quantity: 3 }] });
    const orderId = created.body.data.order.id;

    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stockQty,
    ).toBe(2);

    const cancel = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set(authHeaders(token));
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.order.status).toBe("CANCELLED");
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stockQty,
    ).toBe(5);

    const again = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set(authHeaders(token));
    expect(again.status).toBe(200);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stockQty,
    ).toBe(5);
  });

  it("handles concurrent cancellation with a single restock", async () => {
    const { token: customerToken } = await asCustomer();
    const { token: adminToken } = await asAdmin();
    const { product } = await seedCatalog(4);

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(customerToken))
      .set("Idempotency-Key", nextIdempotencyKey())
      .send({ items: [{ productId: product.id, quantity: 2 }] });
    const orderId = created.body.data.order.id;

    const [c1, c2] = await Promise.all([
      request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set(authHeaders(customerToken)),
      request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set(authHeaders(adminToken)),
    ]);

    expect([c1.status, c2.status].every((s) => s === 200)).toBe(true);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stockQty,
    ).toBe(4);
  });

  it("resolves cancel versus fulfill races without double restock", async () => {
    const { token: customerToken } = await asCustomer();
    const { token: adminToken } = await asAdmin();
    const { product } = await seedCatalog(3);

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(customerToken))
      .set("Idempotency-Key", nextIdempotencyKey())
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    const orderId = created.body.data.order.id;

    await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminToken))
      .send({ status: "CONFIRMED" });

    const [cancel, fulfill] = await Promise.all([
      request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set(authHeaders(adminToken)),
      request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set(authHeaders(adminToken))
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
    const { token: adminToken } = await asAdmin();
    const { product } = await seedCatalog();

    const created = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(customerA.token))
      .set("Idempotency-Key", nextIdempotencyKey())
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    const orderId = created.body.data.order.id;

    await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeaders(adminToken))
      .send({ status: "CONFIRMED" });

    expect(
      (
        await request(app)
          .post(`/api/v1/orders/${orderId}/cancel`)
          .set(authHeaders(customerA.token))
      ).status,
    ).toBe(409);

    expect(
      (
        await request(app)
          .post(`/api/v1/orders/${orderId}/cancel`)
          .set(authHeaders(customerB.token))
      ).status,
    ).toBe(404);
  });

  it("enforces auth, role and Bearer auth on mutations", async () => {
    const { product } = await seedCatalog();
    const { token: customer } = await asCustomer();
    const { token: admin } = await asAdmin();

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set("Origin", TEST_ORIGIN)
          .set("Idempotency-Key", nextIdempotencyKey())
          .send({ items: [{ productId: product.id, quantity: 1 }] })
      ).status,
    ).toBe(401);

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(admin))
          .set("Idempotency-Key", nextIdempotencyKey())
          .send({ items: [{ productId: product.id, quantity: 1 }] })
      ).status,
    ).toBe(403);

    expect(
      (
        await request(app)
          .post("/api/v1/orders")
          .set(authHeaders(customer))
          .set("Idempotency-Key", nextIdempotencyKey())
          .send({ items: [{ productId: product.id, quantity: 1 }] })
      ).status,
    ).toBe(201);
  });

  it("requires Idempotency-Key and replays same payload with 200", async () => {
    const { token } = await asCustomer();
    const { product } = await seedCatalog(5);
    const key = nextIdempotencyKey("idem");

    const missing = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(token))
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    expect(missing.status).toBe(400);

    const first = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(token))
      .set("Idempotency-Key", key)
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    expect(first.status).toBe(201);
    const orderId = first.body.data.order.id;

    const replay = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(token))
      .set("Idempotency-Key", key)
      .send({ items: [{ productId: product.id, quantity: 1 }] });
    expect(replay.status).toBe(200);
    expect(replay.body.data.order.id).toBe(orderId);

    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stockQty,
    ).toBe(4);
    expect(await prisma.order.count()).toBe(1);
  });

  it("rejects same Idempotency-Key with different payload", async () => {
    const { token } = await asCustomer();
    const { product } = await seedCatalog(5);
    const key = nextIdempotencyKey("conflict");

    await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(token))
      .set("Idempotency-Key", key)
      .send({ items: [{ productId: product.id, quantity: 1 }] });

    const conflict = await request(app)
      .post("/api/v1/orders")
      .set(authHeaders(token))
      .set("Idempotency-Key", key)
      .send({ items: [{ productId: product.id, quantity: 2 }] });
    expect(conflict.status).toBe(409);
  });

  it("handles concurrent duplicate Idempotency-Key submissions safely", async () => {
    const { token } = await asCustomer();
    const { product } = await seedCatalog(5);
    const key = nextIdempotencyKey("conc");
    const body = { items: [{ productId: product.id, quantity: 1 }] };

    const [a, b] = await Promise.all([
      request(app)
        .post("/api/v1/orders")
        .set(authHeaders(token))
        .set("Idempotency-Key", key)
        .send(body),
      request(app)
        .post("/api/v1/orders")
        .set(authHeaders(token))
        .set("Idempotency-Key", key)
        .send(body),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 201]);
    expect(a.body.data.order.id).toBe(b.body.data.order.id);
    expect(await prisma.order.count()).toBe(1);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stockQty,
    ).toBe(4);
  });
});
