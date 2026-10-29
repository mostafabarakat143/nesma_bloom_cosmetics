import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { isWrongCurrentPassword, validatePasswordChange } from "./auth/password-change";
import { validateProfileUpdate } from "./auth/profile-update";
import { safeNextPath } from "./auth/redirect";
import { formatMinorPrice, parseEgpToMinor } from "./money";
import { ordersHref, parseOrderListQuery } from "./orders/query";

const memory = new Map<string, string>();

Object.assign(globalThis, {
  window: {
    sessionStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
    addEventListener() {},
    removeEventListener() {},
  },
});

const draft = await import("./order-draft");

beforeEach(() => {
  memory.clear();
});

test("money formatting uses integer piastres", () => {
  assert.equal(formatMinorPrice(1500, "EGP"), "15.00 EGP");
  assert.equal(formatMinorPrice(5, "EGP"), "0.05 EGP");
  assert.deepEqual(parseEgpToMinor("15.50"), { ok: true, minor: 1550 });
  assert.equal(parseEgpToMinor("15.555").ok, false);
});

test("profile validation follows the server field rules", () => {
  const saved = validateProfileUpdate({
    firstName: "Nesma",
    lastName: "",
    phone: "01001234567",
    avatarUrl: "",
  });
  assert.equal(saved.ok, true);
  if (saved.ok) {
    assert.deepEqual(saved.value, {
      firstName: "Nesma",
      lastName: null,
      phone: "01001234567",
      avatarUrl: null,
    });
  }

  const phone = validateProfileUpdate({ phone: "12" });
  assert.equal(phone.ok, false);
  const avatar = validateProfileUpdate({ avatarUrl: "not-a-url" });
  assert.equal(avatar.ok, false);
  const email = validateProfileUpdate({ email: "a@b.c" });
  assert.equal(email.ok, false);
});

test("order list queries keep status and page", () => {
  assert.deepEqual(parseOrderListQuery({ status: "pending", page: "2" }), {
    page: 2,
    status: "PENDING",
  });
  assert.equal(ordersHref({ page: 2, status: "CANCELLED" }, 3), "/account/orders?status=CANCELLED&page=3");
  assert.equal(parseOrderListQuery({ status: "shipped" }).status, "ALL");
});

test("authentication redirects and password errors stay specific", () => {
  assert.equal(safeNextPath("https://evil.example"), "/shop");
  assert.equal(safeNextPath("/checkout"), "/checkout");
  assert.equal(isWrongCurrentPassword("Current password is incorrect."), true);
  assert.equal(isWrongCurrentPassword("Authentication required"), false);
  const mismatch = validatePasswordChange({
    currentPassword: "current-password",
    newPassword: "new-password",
    confirmPassword: "other-password",
  });
  assert.equal(mismatch.ok, false);
  const same = validatePasswordChange({
    currentPassword: "same-password",
    newPassword: "same-password",
    confirmPassword: "same-password",
  });
  assert.equal(same.ok, false);
});

test("the same draft payload reuses one idempotency key", () => {
  assert.equal(draft.addProduct(7, 1, 1, 5), "added");
  const first = draft.beginOrderSubmit(7);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  draft.finishOrderSubmit(7, "uncertain");
  const retry = draft.beginOrderSubmit(7);
  assert.equal(retry.ok, true);
  if (!retry.ok) return;
  assert.equal(retry.key, first.key);
  assert.deepEqual(retry.items, [{ productId: 1, quantity: 1 }]);
  const snapshot = draft.readDraftSnapshot(7);
  assert.equal(snapshot.pending, true);
  assert.equal(snapshot.lines.length, 1);
});

test("a successful order clears the draft and an uncertain one does not", () => {
  draft.addProduct(7, 1, 1, 5);
  const started = draft.beginOrderSubmit(7);
  assert.equal(started.ok, true);
  draft.finishOrderSubmit(7, "success", {
    orderId: 9,
    status: "PENDING",
    totalMinor: 1500,
    currency: "EGP",
  });
  const done = draft.readDraftSnapshot(7);
  assert.equal(done.lines.length, 0);
  assert.equal(done.confirmation?.orderId, 9);
  assert.equal(done.confirmation?.totalMinor, 1500);
});

test("an expired pending key is not sent again", () => {
  const canonical = '[{"productId":1,"quantity":1}]';
  memory.set(
    "nesma_order_draft",
    JSON.stringify({
      guest: { items: [], idempotencyKey: null, canonical: null, keyIssuedAt: null, pending: false },
      users: {
        "7": {
          items: [{ productId: 1, quantity: 1 }],
          idempotencyKey: "11111111-1111-4111-8111-111111111111",
          canonical,
          keyIssuedAt: Date.now() - draft.IDEMPOTENCY_TTL_MS - 1,
          pending: true,
        },
      },
      confirmations: {},
    }),
  );
  const expired = draft.beginOrderSubmit(7);
  assert.equal(expired.ok, false);
  if (expired.ok) return;
  assert.match(expired.message, /24 hours/);
  const stored = JSON.parse(memory.get("nesma_order_draft") ?? "{}") as {
    users: Record<string, { pending: boolean; idempotencyKey: string | null }>;
  };
  assert.equal(stored.users["7"].pending, false);
  assert.equal(stored.users["7"].idempotencyKey, null);

  const explicit = draft.beginOrderSubmit(7);
  assert.equal(explicit.ok, true);
  if (!explicit.ok) return;
  assert.notEqual(explicit.key, "11111111-1111-4111-8111-111111111111");
});

test("a draft owned by another account is not submitted", () => {
  memory.set(
    "nesma_order_draft",
    JSON.stringify({
      guest: { items: [], idempotencyKey: null, canonical: null, keyIssuedAt: null, pending: false },
      users: {
        "4": {
          items: [{ productId: 1, quantity: 4 }],
          idempotencyKey: null,
          canonical: null,
          keyIssuedAt: null,
          pending: false,
        },
      },
      confirmations: {},
    }),
  );
  const other = draft.readDraftSnapshot(8);
  assert.deepEqual(other.lines, []);
  const empty = draft.beginOrderSubmit(8);
  assert.equal(empty.ok, false);
});
