import { createValidation } from "@/shared/validation";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { accountService } from "@/features/account/services/account.service";
import { accountServerService } from "@/features/account/services/account.server";
import { authService } from "@/features/auth/services/auth.service";
import { authServerService } from "@/features/auth/services/auth.server";
import { catalogKeys, loadProduct } from "@/features/catalog/services/catalog.service";
import { listShopProducts } from "@/features/catalog/services/catalog.server";
import { contactService } from "@/features/contact/services/contact.service";
import { contactServerService } from "@/features/contact/services/contact.server";
import { ordersService, orderWhatsappUrl } from "@/features/orders/services/orders.service";
import { ordersServerService } from "@/features/orders/services/orders.server";

import { SAME_ORIGIN_HEADER, SAME_ORIGIN_VALUE, joinApiUrl } from "@/shared/http/request";

import { createQueryClient } from "@/shared/query-provider";
import { isTrustedMutation } from "@/shared/http/response";

const defaultValidation = createValidation();

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let calls: { url: string; init: RequestInit; }[];
let reply: () => Response;

test("mutation origin checks retain same-origin and trusted-proxy behavior", () => {
  function request(headers: Record<string, string>, url = "https://shop.example/api/contact") {
    return new Request(url, { method: "POST", headers });
  }
  const requiredHeader = { [SAME_ORIGIN_HEADER]: SAME_ORIGIN_VALUE };
  assert.equal(isTrustedMutation(request({ ...requiredHeader, origin: "https://shop.example" })), true);
  assert.equal(isTrustedMutation(request({ origin: "https://shop.example" })), false);
  assert.equal(isTrustedMutation(request(requiredHeader)), false);
  assert.equal(isTrustedMutation(request({ ...requiredHeader, origin: "https://evil.example" })), false);
  assert.equal(isTrustedMutation(request({ ...requiredHeader, origin: "invalid" })), false);
  assert.equal(isTrustedMutation(request({
    ...requiredHeader, origin: "https://shop.example", "x-forwarded-host": "shop.example",
  }, "http://internal:3000/api/contact")), true);
});

beforeEach(() => {
  process.env.API_URL = "https://express.example/api/v1/";
  process.env.NEXT_PUBLIC_ORDER_WHATSAPP_NUMBER = "201015981398";
  calls = [];
  reply = () => Response.json({ status: "success", data: { redirectTo: "/checkout" } });
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    return reply();
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ["API_URL", "NEXT_PUBLIC_ORDER_WHATSAPP_NUMBER"]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test("browser services preserve URLs, JSON bodies, methods, origin headers and no-store", async () => {
  const credentials = { email: "customer@example.com", password: "password123", next: "/checkout" };
  const password = { currentPassword: "current", newPassword: "new-password" };
  const contact = { name: "Customer", phone: "01001234567", email: "customer@example.com", message: "Hello" };
  const cases = [
    { run: () => authService.login(credentials), endpoint: "auth/login", method: "POST", body: credentials },
    { run: () => authService.register({ ...credentials, firstName: "Customer" }), endpoint: "auth/register", method: "POST", body: { ...credentials, firstName: "Customer" } },
    { run: () => authService.forgotPassword({ email: credentials.email }), endpoint: "auth/forgot-password", method: "POST", body: { email: credentials.email } },
    { run: () => authService.resetPassword({ token: "reset-token", newPassword: "new-password" }), endpoint: "auth/reset-password", method: "POST", body: { token: "reset-token", newPassword: "new-password" } },
    { run: () => accountService.updateProfile({ firstName: "Customer", avatarUrl: null }), endpoint: "account/profile", method: "PATCH", body: { firstName: "Customer", avatarUrl: null } },
    { run: () => accountService.changePassword(password), endpoint: "account/change-password", method: "POST", body: password },
    { run: () => contactService.send(contact), endpoint: "contact", method: "POST", body: contact },
    { run: () => ordersService.create({ items: [{ productId: 12, quantity: 2 }], key: "same-checkout-key" }), endpoint: "orders", method: "POST", body: { items: [{ productId: 12, quantity: 2 }] } },
    { run: () => ordersService.cancel(12), endpoint: "orders/12/cancel", method: "POST", body: {} },
  ];
  for (const entry of cases) {
    await entry.run();
    const request = calls.at(-1)!;
    assert.equal(request.url, `/api/${entry.endpoint}`);
    assert.equal(request.init.method, entry.method);
    assert.deepEqual(JSON.parse(String(request.init.body)), entry.body);
    assert.equal(request.init.cache, "no-store");
    const headers = new Headers(request.init.headers);
    assert.equal(headers.get(SAME_ORIGIN_HEADER), SAME_ORIGIN_VALUE);
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.has("authorization"), false);
    if (entry.endpoint === "orders") assert.equal(headers.get("idempotency-key"), "same-checkout-key");
  }
});

test("avatar upload remains multipart without a manually set Content-Type", async () => {
  const file = new File(["image"], "avatar.png", { type: "image/png" });
  await accountService.uploadAvatar(file);
  const request = calls[0];
  assert.equal(request.url, "/api/account/avatar");
  assert.ok(request.init.body instanceof FormData);
  assert.equal(new Headers(request.init.headers).has("content-type"), false);
  const uploaded = request.init.body.get("file");
  assert.ok(uploaded instanceof File);
  assert.equal(uploaded.name, "avatar.png");
});

test("request failures keep their original status and message instead of throwing or retrying", async () => {
  reply = () => Response.json({ status: "error", message: "Current password is incorrect." }, { status: 401 });
  assert.deepEqual(await accountService.changePassword({ currentPassword: "wrong", newPassword: "new-password" }), {
    ok: false, status: 401, message: "Current password is incorrect.",
  });
  reply = () => { throw new TypeError("offline"); };
  assert.deepEqual(await contactService.send({ name: "A", phone: "123", email: "a@b.co", message: "Hello" }), {
    ok: false, status: 0, message: defaultValidation.messages.unavailable,
  });
  assert.equal(calls.length, 2);
});

test("logout preserves the body-free request and the unconfirmed revocation status", async () => {
  reply = () => Response.json({ message: defaultValidation.messages.revokeUnconfirmed }, { status: 503 });
  const result = await authService.logout();
  assert.equal(result.status, 503);
  assert.equal(result.message, defaultValidation.messages.revokeUnconfirmed);
  assert.equal(calls[0].url, "/api/auth/logout");
  assert.equal(calls[0].init.body, undefined);
  assert.equal(new Headers(calls[0].init.headers).has("content-type"), false);
});

test("server services append the configured API prefix and keep Bearer tokens server-side", async () => {
  const token = "private-token";
  await authServerService.getSession(token);
  await authServerService.revokeToken(token);
  await accountServerService.getProfile(token);
  await accountServerService.updateProfile(token, { phone: null });
  await accountServerService.changePassword(token, { currentPassword: "old", newPassword: "new-password" });
  await ordersServerService.create(token, "same-key", [{ productId: 2, quantity: 3 }]);
  await ordersServerService.cancel(token, 4);
  assert.deepEqual(calls.map((request) => new URL(request.url).pathname), [
    "/api/v1/auth/me", "/api/v1/auth/logout", "/api/v1/users/me/profile", "/api/v1/users/me/profile",
    "/api/v1/auth/change-password", "/api/v1/orders", "/api/v1/orders/4/cancel",
  ]);
  for (const request of calls) {
    assert.equal(new Headers(request.init.headers).get("authorization"), `Bearer ${token}`);
    assert.equal(request.init.cache, "no-store");
    assert.ok(request.init.signal instanceof AbortSignal);
  }
  assert.equal(new Headers(calls[5].init.headers).get("idempotency-key"), "same-key");
  assert.deepEqual(JSON.parse(String(calls[5].init.body)), { items: [{ productId: 2, quantity: 3 }] });
});

test("public server requests preserve the existing payloads without adding authorization", async () => {
  await authServerService.login({ email: "a@b.co", password: "password" });
  await authServerService.register({ email: "a@b.co", password: "password", firstName: "A" });
  await authServerService.forgotPassword({ email: "a@b.co" });
  await authServerService.resetPassword({ token: "token", newPassword: "password" });
  await contactServerService.send({ name: "A", phone: "123", email: "a@b.co", message: "Hello" });
  for (const request of calls) {
    assert.equal(request.init.method, "POST");
    assert.equal(new Headers(request.init.headers).has("authorization"), false);
  }
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { email: "a@b.co", password: "password" });
});

test("catalog queries retain every filter, sort, page and guest visibility constraint", async () => {
  reply = () => Response.json({ status: "success", data: { items: [], meta: { page: 2, pageSize: 12, totalItems: 24, totalPages: 2 } } });
  await listShopProducts({ q: "rose & oil", categoryId: 3, subcategoryId: 4, minPriceMinor: 1250, maxPriceMinor: 5000, sort: "price-desc", page: 2 });
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/api/v1/products");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    page: "2", pageSize: "12", status: "ACTIVE", availability: "AVAILABLE", sortBy: "priceMinor", sortOrder: "desc",
    search: "rose & oil", categoryId: "3", subcategoryId: "4", minPriceMinor: "1250", maxPriceMinor: "5000",
  });
});

test("checkout distinguishes missing products from unavailable or malformed products", async () => {
  reply = () => new Response(null, { status: 404 });
  assert.deepEqual(await loadProduct(4), { state: "missing" });
  reply = () => new Response(null, { status: 503 });
  assert.deepEqual(await loadProduct(4), { state: "unavailable" });
  reply = () => Response.json({ data: { product: { id: 4 } } });
  assert.deepEqual(await loadProduct(4), { state: "unavailable" });
});

test("query clients do not share private data and failed writes are attempted once", async () => {
  const client = createQueryClient();
  const other = createQueryClient();
  const key = catalogKeys.checkoutProduct(7, 4);
  client.setQueryData(key, { name: "cached" });
  assert.equal(other.getQueryData(key), undefined);
  assert.equal(client.getQueryData(catalogKeys.checkoutProduct(8, 4)), undefined);
  let attempts = 0;
  const mutation = client.getMutationCache().build(client, {
    mutationFn: async () => { attempts++; throw new Error("uncertain checkout"); },
  });
  await assert.rejects(mutation.execute(undefined), /uncertain checkout/);
  assert.equal(attempts, 1);
  assert.equal(client.getDefaultOptions().queries?.refetchOnWindowFocus, false);
  client.clear();
  other.clear();
});

test("URL joining and configurable WhatsApp destination keep their original values", () => {
  assert.equal(joinApiUrl("https://api.example/api/v1/", "/orders/4"), "https://api.example/api/v1/orders/4");
  const url = new URL(orderWhatsappUrl(12));
  assert.equal(url.pathname, "/201015981398");
  assert.equal(url.searchParams.get("text"), "تاكيد الاوردر رقم 12");
});
