import { access, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES } from "../../src/modules/uploads/image-file.js";
import { hashPassword } from "../../src/modules/auth/password.service.js";
import { authHeaders, TEST_ORIGIN, extractToken } from "../helpers/auth.js";
import { createAdminUser, loginAsAdmin } from "../helpers/admin.js";
import { buildTestApp } from "../helpers/test-app.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==",
  "base64",
);

const uploadDir = path.join(tmpdir(), `nesma-uploads-${process.pid}`);

describe("image uploads", () => {
  const { app, prisma } = buildTestApp({
    UPLOAD_DIR: uploadDir,
    API_PUBLIC_URL: "http://localhost:4000",
  });

  beforeEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
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
    await rm(uploadDir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  async function asAdmin() {
    const admin = await createAdminUser(prisma);
    const token = await loginAsAdmin(app, admin.email, admin.password);
    return { ...admin, token };
  }

  async function asCustomer() {
    const password = "Password123!";
    const email = `customer-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
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
    return { token: extractToken(login), user };
  }

  async function uploadCatalog(token: string, file: Buffer, filename: string) {
    return request(app)
      .post("/api/v1/uploads/images")
      .set(authHeaders(token))
      .attach("file", file, { filename, contentType: "application/octet-stream" });
  }

  it("stores a catalog image for an admin and serves the bytes", async () => {
    const admin = await asAdmin();
    const uploaded = await uploadCatalog(admin.token, PNG, "rose.png");

    expect(uploaded.status).toBe(201);
    const url = uploaded.body.data.url as string;
    expect(url).toMatch(
      /^http:\/\/localhost:4000\/api\/v1\/media\/catalog\/[0-9a-f-]+\.png$/,
    );

    const file = await request(app).get(new URL(url).pathname);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toMatch(/image\/png/);
    expect(file.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(file.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.from(file.body).equals(PNG)).toBe(true);
  });

  it("refuses catalog uploads from customers and unsigned requests", async () => {
    const customer = await asCustomer();
    const denied = await uploadCatalog(customer.token, PNG, "rose.png");
    expect(denied.status).toBe(403);

    const anonymous = await request(app)
      .post("/api/v1/uploads/images")
      .set("Origin", TEST_ORIGIN)
      .attach("file", PNG, { filename: "rose.png", contentType: "image/png" });
    expect(anonymous.status).toBe(401);
  });

  it("rejects SVG, the wrong field, and files over 5 MB", async () => {
    const admin = await asAdmin();
    const svg = await uploadCatalog(
      admin.token,
      Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
      "icon.svg",
    );
    expect(svg.status).toBe(400);

    const wrongField = await request(app)
      .post("/api/v1/uploads/images")
      .set(authHeaders(admin.token))
      .attach("image", PNG, { filename: "rose.png", contentType: "image/png" });
    expect(wrongField.status).toBe(400);

    const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    PNG.copy(oversized);
    const tooBig = await uploadCatalog(admin.token, oversized, "big.png");
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.message).toMatch(/5 MB/);
  });

  it("deletes a catalog file when the last category stops using it", async () => {
    const admin = await asAdmin();
    const uploaded = await uploadCatalog(admin.token, PNG, "rose.png");
    const url = uploaded.body.data.url as string;

    const first = await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(admin.token))
      .send({ name: "Rose", slug: `rose-${Date.now()}`, imageUrl: url });
    const second = await request(app)
      .post("/api/v1/categories")
      .set(authHeaders(admin.token))
      .send({ name: "Bloom", slug: `bloom-${Date.now()}`, imageUrl: url });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const replaced = await request(app)
      .patch(`/api/v1/categories/${first.body.data.category.id}`)
      .set(authHeaders(admin.token))
      .send({ imageUrl: "https://cdn.example.com/other.jpg" });
    expect(replaced.status).toBe(200);
    expect((await request(app).get(new URL(url).pathname)).status).toBe(200);

    const cleared = await request(app)
      .patch(`/api/v1/categories/${second.body.data.category.id}`)
      .set(authHeaders(admin.token))
      .send({ imageUrl: "https://cdn.example.com/second.jpg" });
    expect(cleared.status).toBe(200);
    expect((await request(app).get(new URL(url).pathname)).status).toBe(404);
  });

  it("deletes a product image file only after the last reference is removed", async () => {
    const admin = await asAdmin();
    const uploaded = await uploadCatalog(admin.token, PNG, "serum.png");
    const url = uploaded.body.data.url as string;
    const stamp = Date.now();

    const category = await prisma.category.create({
      data: { name: "Care", slug: `care-${stamp}`, imageUrl: "https://cdn.example.com/c.jpg" },
    });
    const subcategory = await prisma.subcategory.create({
      data: { name: "Serum", slug: `serum-${stamp}`, categoryId: category.id },
    });
    const firstProduct = await prisma.product.create({
      data: {
        name: "Rose serum",
        slug: `rose-serum-${stamp}`,
        sku: `ROSE-${stamp}`,
        priceMinor: 1500,
        subcategoryId: subcategory.id,
      },
    });
    const secondProduct = await prisma.product.create({
      data: {
        name: "Bloom serum",
        slug: `bloom-serum-${stamp}`,
        sku: `BLOOM-${stamp}`,
        priceMinor: 1800,
        subcategoryId: subcategory.id,
      },
    });

    const firstImage = await request(app)
      .post(`/api/v1/products/${firstProduct.id}/images`)
      .set(authHeaders(admin.token))
      .send({ url, isPrimary: true });
    const secondImage = await request(app)
      .post(`/api/v1/products/${secondProduct.id}/images`)
      .set(authHeaders(admin.token))
      .send({ url, isPrimary: true });
    expect(firstImage.status).toBe(201);
    expect(secondImage.status).toBe(201);

    const removed = await request(app)
      .delete(
        `/api/v1/products/${firstProduct.id}/images/${firstImage.body.data.product.images[0].id}`,
      )
      .set(authHeaders(admin.token));
    expect(removed.status).toBe(200);
    expect((await request(app).get(new URL(url).pathname)).status).toBe(200);

    const removedLast = await request(app)
      .delete(
        `/api/v1/products/${secondProduct.id}/images/${secondImage.body.data.product.images[0].id}`,
      )
      .set(authHeaders(admin.token));
    expect(removedLast.status).toBe(200);
    expect((await request(app).get(new URL(url).pathname)).status).toBe(404);
  });

  it("keeps one profile image and replaces it when the user uploads again", async () => {
    const customer = await asCustomer();
    const first = await request(app)
      .post("/api/v1/users/me/avatar")
      .set(authHeaders(customer.token))
      .attach("file", PNG, { filename: "me.png", contentType: "image/png" });

    expect(first.status).toBe(200);
    const pngUrl = first.body.data.profile.avatarUrl as string;
    expect(pngUrl).toBe(
      `http://localhost:4000/api/v1/media/avatars/${customer.user.id}.png`,
    );
    expect((await request(app).get(new URL(pngUrl).pathname)).status).toBe(200);

    const second = await request(app)
      .post("/api/v1/users/me/avatar")
      .set(authHeaders(customer.token))
      .attach("file", JPEG, { filename: "me.jpg", contentType: "image/jpeg" });
    expect(second.status).toBe(200);
    const jpgUrl = second.body.data.profile.avatarUrl as string;
    expect(jpgUrl).toBe(
      `http://localhost:4000/api/v1/media/avatars/${customer.user.id}.jpg`,
    );

    const names = (await readdir(path.join(uploadDir, "avatars"))).filter(
      (name) => !name.startsWith("."),
    );
    expect(names).toEqual([`${customer.user.id}.jpg`]);
    expect((await request(app).get(new URL(pngUrl).pathname)).status).toBe(404);
    const jpg = await request(app).get(new URL(jpgUrl).pathname);
    expect(jpg.status).toBe(200);
    expect(jpg.headers["content-type"]).toMatch(/image\/jpeg/);

    const cleared = await request(app)
      .patch("/api/v1/users/me/profile")
      .set(authHeaders(customer.token))
      .send({ avatarUrl: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.profile.avatarUrl).toBeNull();
    await expect(access(path.join(uploadDir, "avatars", `${customer.user.id}.jpg`))).rejects.toThrow();
  });

  it("does not serve filenames the API did not generate", async () => {
    const missing = await request(app).get(
      "/api/v1/media/catalog/not-a-real-file.jpg",
    );
    expect(missing.status).toBe(404);

    const traversal = await request(app).get(
      "/api/v1/media/catalog/..%2F..%2Fpackage.json",
    );
    expect(traversal.status).toBe(404);
  });
});
