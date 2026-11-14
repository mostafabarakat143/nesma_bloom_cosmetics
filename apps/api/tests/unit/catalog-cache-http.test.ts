import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import { createCatalogCache } from "../../src/common/cache/catalog-cache.js";
import { AppError } from "../../src/common/errors/app-error.js";
import type { Database } from "../../src/config/database.js";
import { loadEnv } from "../../src/config/env.js";
import { createLogger } from "../../src/config/logger.js";
import { signBearerToken } from "../../src/modules/auth/token.service.js";
import { createMemoryCacheStore } from "../helpers/memory-cache.js";
import { baseTestEnvVars } from "../helpers/test-env.js";

const services = vi.hoisted(() => ({
  categories: {
    listCategories: vi.fn(), getCategoryById: vi.fn(), createCategoryService: vi.fn(),
    updateCategoryService: vi.fn(), archiveCategoryService: vi.fn(),
  },
  subcategories: {
    listSubcategories: vi.fn(), getSubcategoryById: vi.fn(), createSubcategoryService: vi.fn(),
    updateSubcategoryService: vi.fn(), archiveSubcategoryService: vi.fn(),
  },
  products: {
    listProducts: vi.fn(), getProductById: vi.fn(), createProductService: vi.fn(),
    updateProductService: vi.fn(), archiveProductService: vi.fn(), addProductImageService: vi.fn(),
    updateProductImageService: vi.fn(), deleteProductImageService: vi.fn(),
  },
  orders: {
    createOrderService: vi.fn(), listMyOrders: vi.fn(), listAllOrders: vi.fn(),
    getOrderById: vi.fn(), cancelOrderService: vi.fn(), updateOrderStatusService: vi.fn(),
  },
}));

vi.mock("../../src/modules/categories/category.service.js", () => services.categories);
vi.mock("../../src/modules/subcategories/subcategory.service.js", () => services.subcategories);
vi.mock("../../src/modules/products/product.service.js", () => services.products);
vi.mock("../../src/modules/orders/order.service.js", () => services.orders);

const env = loadEnv({ ...baseTestEnvVars, LOG_LEVEL: "silent" });
const logger = createLogger(env);
const principal = { role: "ADMIN", status: "ACTIVE", authVersion: 0 };

function setup() {
  const { store } = createMemoryCacheStore();
  const cache = createCatalogCache(store, { prefix: "test:catalog-http", ttlSeconds: 30, logger });
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(principal) },
    revokedAccessToken: { findUnique: vi.fn().mockResolvedValue(null) },
  } as unknown as Database;
  return { app: createApp({ env, logger, prisma, cache }), cache };
}

beforeEach(() => {
  principal.role = "ADMIN";
  for (const group of Object.values(services)) {
    for (const mock of Object.values(group)) mock.mockReset().mockResolvedValue({ id: 1 });
  }
  services.orders.createOrderService.mockResolvedValue({ order: { id: 1 }, created: true });
});

describe("catalog cache HTTP behavior", () => {
  it.each([
    ["categories", services.categories.listCategories, services.categories.getCategoryById],
    ["subcategories", services.subcategories.listSubcategories, services.subcategories.getSubcategoryById],
    ["products", services.products.listProducts, services.products.getProductById],
  ] as const)("caches anonymous %s lists and details", async (resource, list, detail) => {
    const { app } = setup();
    const first = await request(app).get(`/api/v1/${resource}`);
    const cached = await request(app).get(`/api/v1/${resource}`);
    expect(first.status).toBe(200);
    expect(cached.body).toEqual(first.body);
    await request(app).get(`/api/v1/${resource}/1`).expect(200);
    await request(app).get(`/api/v1/${resource}/1`).expect(200);
    expect(list).toHaveBeenCalledTimes(1);
    expect(detail).toHaveBeenCalledTimes(1);
  });

  it("keys normalized queries separately for pages, filters, and sorting", async () => {
    const { app } = setup();
    for (const path of [
      "/products", "/products?page=1&pageSize=20", "/products?page=2",
      "/products?search=serum", "/products?sortBy=priceMinor", "/products?categoryId=2",
    ]) await request(app).get(`/api/v1${path}`).expect(200);
    expect(services.products.listProducts).toHaveBeenCalledTimes(5);
  });

  it.each(["ADMIN", "CUSTOMER"])("bypasses shared caching for authenticated %s requests", async (role) => {
    const { app } = setup();
    principal.role = role;
    const token = await signBearerToken(env, 7, 0);
    services.products.listProducts
      .mockResolvedValueOnce({ items: ["public"] })
      .mockResolvedValue({ items: ["signed-in-view"] });

    await request(app).get("/api/v1/products").expect(200);
    for (let i = 0; i < 2; i++) {
      const response = await request(app).get("/api/v1/products").auth(token, { type: "bearer" });
      expect(response.body.data.items).toEqual(["signed-in-view"]);
    }
    const publicAgain = await request(app).get("/api/v1/products");
    expect(publicAgain.body.data.items).toEqual(["public"]);
    expect(services.products.listProducts).toHaveBeenCalledTimes(3);
  });

  it("still authenticates and validates requests before consulting the cache", async () => {
    const { app } = setup();
    await request(app).get("/api/v1/products").expect(200);
    await request(app).get("/api/v1/products").auth("invalid-token", { type: "bearer" }).expect(401);
    await request(app).get("/api/v1/products?page=invalid").expect(400);
    expect(services.products.listProducts).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["post", "/categories", { name: "Care", imageUrl: "https://example.com/care.png" }],
    ["patch", "/categories/1", { name: "Updated" }],
    ["delete", "/categories/1", undefined],
    ["post", "/subcategories", { name: "Serums", categoryId: 1 }],
    ["patch", "/subcategories/1", { name: "Updated" }],
    ["delete", "/subcategories/1", undefined],
    ["post", "/products", { name: "Serum", subcategoryId: 1, sku: "SERUM", priceMinor: 100, stockQty: 2 }],
    ["patch", "/products/1", { stockQty: 1 }],
    ["delete", "/products/1", undefined],
    ["post", "/products/1/images", { url: "https://example.com/product.png" }],
    ["patch", "/products/1/images/1", { isPrimary: true }],
    ["delete", "/products/1/images/1", undefined],
    ["post", "/orders/1/cancel", undefined],
    ["patch", "/orders/1/status", { status: "CONFIRMED" }],
  ] as const)("invalidates catalog reads after %s %s", async (method, path, body) => {
    const { app } = setup();
    await request(app).get("/api/v1/products").expect(200);
    const token = await signBearerToken(env, 7, 0);
    const change = request(app)[method](`/api/v1${path}`).auth(token, { type: "bearer" });
    if (body) change.send(body);
    const response = await change;
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    await request(app).get("/api/v1/products").expect(200);
    expect(services.products.listProducts).toHaveBeenCalledTimes(2);
  });

  it("invalidates cached stock after checkout while keeping checkout uncached", async () => {
    const { app } = setup();
    principal.role = "CUSTOMER";
    await request(app).get("/api/v1/products").expect(200);
    const token = await signBearerToken(env, 7, 0);
    for (let i = 0; i < 2; i++) {
      await request(app).post("/api/v1/orders").auth(token, { type: "bearer" })
        .send({ items: [{ productId: 1, quantity: 1 }] }).expect(201);
    }
    await request(app).get("/api/v1/products").expect(200);
    expect(services.products.listProducts).toHaveBeenCalledTimes(2);
    expect(services.orders.createOrderService).toHaveBeenCalledTimes(2);
  });

  it("invalidates even when a catalog write reports a post-commit failure", async () => {
    const { app } = setup();
    await request(app).get("/api/v1/products").expect(200);
    services.products.updateProductService.mockRejectedValueOnce(AppError.internal("Post-commit failure"));
    const token = await signBearerToken(env, 7, 0);
    await request(app).patch("/api/v1/products/1").auth(token, { type: "bearer" })
      .send({ stockQty: 1 }).expect(500);
    await request(app).get("/api/v1/products").expect(200);
    expect(services.products.listProducts).toHaveBeenCalledTimes(2);
  });

  it("keeps private order reads out of the shared cache", async () => {
    const { app } = setup();
    const token = await signBearerToken(env, 7, 0);
    await request(app).get("/api/v1/orders/my").auth(token, { type: "bearer" }).expect(200);
    await request(app).get("/api/v1/orders/my").auth(token, { type: "bearer" }).expect(200);
    expect(services.orders.listMyOrders).toHaveBeenCalledTimes(2);
  });

  it("does not cache a missing product response", async () => {
    const { app } = setup();
    services.products.getProductById.mockRejectedValueOnce(AppError.notFound("Product not found"));
    await request(app).get("/api/v1/products/1").expect(404);
    await request(app).get("/api/v1/products/1").expect(200);
    expect(services.products.getProductById).toHaveBeenCalledTimes(2);
  });
});
