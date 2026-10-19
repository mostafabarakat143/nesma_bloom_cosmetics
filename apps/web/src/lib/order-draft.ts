import { canonicalOrderItems, MAX_ORDER_LINES, MAX_ORDER_QUANTITY, parseIdempotencyKey, type OrderLine } from "@/lib/orders/payload";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/parse";

const STORAGE_KEY = "nesma_order_draft";

/** Matches Express IDEMPOTENCY_TTL_MS. An older key can be inserted again and create another order. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export const EXPIRED_CHECKOUT_MESSAGE =
  "This checkout request is older than 24 hours, so it was not sent again. Place the order only if you still want a new one.";

type Bucket = {
  items: OrderLine[];
  idempotencyKey: string | null;
  canonical: string | null;
  keyIssuedAt: number | null;
  pending: boolean;
};

type Confirmation = {
  orderId: number;
  status: OrderStatus;
  totalMinor: number;
  currency: string;
};

type Store = {
  guest: Bucket;
  users: Record<string, Bucket>;
  confirmations: Record<string, Confirmation>;
};

export type DraftSnapshot = {
  ready: boolean;
  lines: OrderLine[];
  pending: boolean;
  source: "user" | "guest";
  guestExtra: OrderLine[];
  confirmation: Confirmation | null;
};

const SERVER_SNAPSHOT: DraftSnapshot = {
  ready: false,
  lines: [],
  pending: false,
  source: "user",
  guestExtra: [],
  confirmation: null,
};

const listeners = new Set<() => void>();
let cacheKey = "";
let cacheSnapshot: DraftSnapshot | null = null;

function emptyBucket(): Bucket {
  return { items: [], idempotencyKey: null, canonical: null, keyIssuedAt: null, pending: false };
}

function emptyStore(): Store {
  return { guest: emptyBucket(), users: {}, confirmations: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBucket(value: unknown): Bucket {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return emptyBucket();
  }
  const items: OrderLine[] = [];
  const seen = new Set<number>();
  for (const entry of value.items) {
    if (!isRecord(entry)) {
      continue;
    }
    const { productId, quantity } = entry;
    if (
      typeof productId !== "number" ||
      !Number.isInteger(productId) ||
      productId < 1 ||
      productId > 2_147_483_647 ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_ORDER_QUANTITY ||
      seen.has(productId)
    ) {
      continue;
    }
    seen.add(productId);
    items.push({ productId, quantity });
    if (items.length === MAX_ORDER_LINES) {
      break;
    }
  }
  items.sort((left, right) => left.productId - right.productId);
  const canonical = canonicalOrderItems(items);
  const key =
    typeof value.idempotencyKey === "string" ? parseIdempotencyKey(value.idempotencyKey) : null;
  const storedCanonical = typeof value.canonical === "string" ? value.canonical : null;
  const matches = key !== null && storedCanonical === canonical;
  const keyIssuedAt =
    typeof value.keyIssuedAt === "number" && Number.isFinite(value.keyIssuedAt)
      ? value.keyIssuedAt
      : null;
  return {
    items,
    idempotencyKey: matches ? key : null,
    canonical: matches ? canonical : null,
    keyIssuedAt: matches ? keyIssuedAt : null,
    pending: value.pending === true && matches,
  };
}

function keyIsCurrent(bucket: Bucket, canonical: string): boolean {
  return (
    bucket.idempotencyKey !== null &&
    bucket.canonical === canonical &&
    bucket.keyIssuedAt !== null &&
    Date.now() - bucket.keyIssuedAt < IDEMPOTENCY_TTL_MS
  );
}

function parseConfirmation(value: unknown): Confirmation | null {
  if (!isRecord(value)) {
    return null;
  }
  const { orderId, status, totalMinor, currency } = value;
  if (
    typeof orderId !== "number" ||
    !Number.isInteger(orderId) ||
    orderId < 1 ||
    typeof status !== "string" ||
    !ORDER_STATUSES.includes(status as OrderStatus) ||
    typeof totalMinor !== "number" ||
    !Number.isInteger(totalMinor) ||
    totalMinor < 0 ||
    typeof currency !== "string" ||
    currency.trim() === ""
  ) {
    return null;
  }
  return { orderId, status: status as OrderStatus, totalMinor, currency };
}

function parseStore(raw: string): Store {
  if (!raw) {
    return emptyStore();
  }
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)) {
      return emptyStore();
    }
    const users: Record<string, Bucket> = {};
    if (isRecord(value.users)) {
      for (const [id, bucket] of Object.entries(value.users)) {
        if (!/^[1-9]\d*$/.test(id)) {
          continue;
        }
        users[id] = parseBucket(bucket);
      }
    }
    const confirmations: Record<string, Confirmation> = {};
    if (isRecord(value.confirmations)) {
      for (const [id, confirmation] of Object.entries(value.confirmations)) {
        if (!/^[1-9]\d*$/.test(id)) {
          continue;
        }
        const parsed = parseConfirmation(confirmation);
        if (parsed) {
          confirmations[id] = parsed;
        }
      }
    }
    return {
      guest: parseBucket(value.guest),
      users,
      confirmations,
    };
  } catch {
    return emptyStore();
  }
}

function readRaw(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    return;
  }
  cacheKey = "";
  cacheSnapshot = null;
  for (const listener of listeners) {
    listener();
  }
}

function readStore(): Store {
  return parseStore(readRaw());
}

function snapshotFor(store: Store, userId: number): DraftSnapshot {
  const user = store.users[String(userId)] ?? emptyBucket();
  const showingGuest = user.items.length === 0 && !user.pending && store.guest.items.length > 0;
  const lines = showingGuest ? store.guest.items : user.items;
  const confirmation =
    lines.length === 0 ? (store.confirmations[String(userId)] ?? null) : null;
  return {
    ready: true,
    lines,
    pending: showingGuest ? store.guest.pending : user.pending,
    source: showingGuest ? "guest" : "user",
    guestExtra: showingGuest ? [] : store.guest.items,
    confirmation,
  };
}

export function serverDraftSnapshot(): DraftSnapshot {
  return SERVER_SNAPSHOT;
}

export function readDraftSnapshot(userId: number): DraftSnapshot {
  const raw = readRaw();
  const key = `${userId}:${raw}`;
  if (cacheSnapshot && cacheKey === key) {
    return cacheSnapshot;
  }
  const snapshot = snapshotFor(parseStore(raw), userId);
  cacheKey = key;
  cacheSnapshot = snapshot;
  return snapshot;
}

export function subscribeDraft(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      cacheKey = "";
      cacheSnapshot = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function withBucket(store: Store, owner: number | "guest"): Bucket {
  if (owner === "guest") {
    return store.guest;
  }
  return store.users[String(owner)] ?? emptyBucket();
}

function saveBucket(store: Store, owner: number | "guest", bucket: Bucket) {
  if (owner === "guest") {
    store.guest = bucket;
    return;
  }
  store.users[String(owner)] = bucket;
  delete store.confirmations[String(owner)];
}

function replaceItems(bucket: Bucket, items: OrderLine[]): Bucket {
  const canonical = canonicalOrderItems(items);
  const unchanged = bucket.canonical === canonical && bucket.idempotencyKey !== null;
  return {
    items,
    idempotencyKey: unchanged ? bucket.idempotencyKey : null,
    canonical: unchanged ? canonical : null,
    keyIssuedAt: unchanged ? bucket.keyIssuedAt : null,
    pending: false,
  };
}

export function addProduct(
  owner: number | "guest",
  productId: number,
  quantity: number,
  maxQty: number,
): "added" | "clamped" | "full" | "pending" | "unavailable" | "invalid" {
  if (
    !Number.isInteger(productId) ||
    productId < 1 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_ORDER_QUANTITY
  ) {
    return "invalid";
  }
  if (maxQty < 1) {
    return "unavailable";
  }

  const store = readStore();
  const bucket = withBucket(store, owner);
  if (bucket.pending) {
    return "pending";
  }

  const existing = bucket.items.find((item) => item.productId === productId);
  if (!existing && bucket.items.length >= MAX_ORDER_LINES) {
    return "full";
  }

  const desired = (existing?.quantity ?? 0) + quantity;
  const nextQty = Math.min(maxQty, MAX_ORDER_QUANTITY, desired);
  if (nextQty < 1) {
    return "unavailable";
  }
  const items = existing
    ? bucket.items.map((item) =>
        item.productId === productId ? { productId, quantity: nextQty } : item,
      )
    : [...bucket.items, { productId, quantity: nextQty }];
  items.sort((left, right) => left.productId - right.productId);
  saveBucket(store, owner, replaceItems(bucket, items));
  writeStore(store);
  return nextQty < desired ? "clamped" : "added";
}

function claimGuest(store: Store, userId: number) {
  const key = String(userId);
  const user = store.users[key] ?? emptyBucket();
  if (user.items.length > 0 || user.pending || store.guest.items.length === 0) {
    return;
  }
  store.users[key] = {
    items: store.guest.items.map((item) => ({ ...item })),
    idempotencyKey: store.guest.idempotencyKey,
    canonical: store.guest.canonical,
    keyIssuedAt: store.guest.keyIssuedAt,
    pending: store.guest.pending,
  };
  store.guest = emptyBucket();
  delete store.confirmations[key];
}

export function updateDraftQuantity(
  userId: number,
  productId: number,
  quantity: number,
): "ok" | "pending" | "invalid" | "missing" {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_QUANTITY) {
    return "invalid";
  }
  const store = readStore();
  const user = store.users[String(userId)] ?? emptyBucket();
  if (user.items.length === 0 && !user.pending && store.guest.items.length > 0) {
    claimGuest(store, userId);
  }
  const bucket = store.users[String(userId)] ?? emptyBucket();
  if (bucket.pending) {
    writeStore(store);
    return "pending";
  }
  if (!bucket.items.some((item) => item.productId === productId)) {
    return "missing";
  }
  const items = bucket.items.map((item) =>
    item.productId === productId ? { productId, quantity } : item,
  );
  saveBucket(store, userId, replaceItems(bucket, items));
  writeStore(store);
  return "ok";
}

export function removeDraftLine(userId: number, productId: number): "ok" | "pending" | "missing" {
  const store = readStore();
  const user = store.users[String(userId)] ?? emptyBucket();
  if (user.items.length === 0 && !user.pending && store.guest.items.length > 0) {
    claimGuest(store, userId);
  }
  const bucket = store.users[String(userId)] ?? emptyBucket();
  if (bucket.pending) {
    writeStore(store);
    return "pending";
  }
  if (!bucket.items.some((item) => item.productId === productId)) {
    return "missing";
  }
  saveBucket(
    store,
    userId,
    replaceItems(
      bucket,
      bucket.items.filter((item) => item.productId !== productId),
    ),
  );
  writeStore(store);
  return "ok";
}

export function includeGuestLines(userId: number): "ok" | "pending" | "full" | "empty" {
  const store = readStore();
  const bucket = store.users[String(userId)] ?? emptyBucket();
  if (bucket.pending) {
    return "pending";
  }
  if (store.guest.items.length === 0) {
    return "empty";
  }
  const quantities = new Map(bucket.items.map((item) => [item.productId, item.quantity]));
  for (const line of store.guest.items) {
    const current = quantities.get(line.productId) ?? 0;
    quantities.set(line.productId, Math.min(MAX_ORDER_QUANTITY, current + line.quantity));
  }
  if (quantities.size > MAX_ORDER_LINES) {
    return "full";
  }
  const items = [...quantities.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((left, right) => left.productId - right.productId);
  store.guest = emptyBucket();
  saveBucket(store, userId, {
    items,
    idempotencyKey: null,
    canonical: null,
    keyIssuedAt: null,
    pending: false,
  });
  writeStore(store);
  return "ok";
}

export function discardGuestLines() {
  const store = readStore();
  store.guest = emptyBucket();
  writeStore(store);
}

export function clearGuestDraft() {
  discardGuestLines();
}

export function clearVisibleDraft(userId: number): "ok" | "pending" {
  const store = readStore();
  const user = store.users[String(userId)] ?? emptyBucket();
  if (user.items.length === 0 && !user.pending && store.guest.items.length > 0) {
    if (store.guest.pending) {
      return "pending";
    }
    store.guest = emptyBucket();
    writeStore(store);
    return "ok";
  }
  if (user.pending) {
    return "pending";
  }
  store.users[String(userId)] = emptyBucket();
  writeStore(store);
  return "ok";
}

export function beginOrderSubmit(
  userId: number,
): { ok: true; key: string; items: OrderLine[] } | { ok: false; message: string } {
  const store = readStore();
  claimGuest(store, userId);
  const key = String(userId);
  const bucket = store.users[key] ?? emptyBucket();
  if (bucket.items.length === 0) {
    return { ok: false, message: "Your order is empty." };
  }
  const canonical = canonicalOrderItems(bucket.items);
  if (bucket.pending && !keyIsCurrent(bucket, canonical)) {
    store.users[key] = {
      ...bucket,
      idempotencyKey: null,
      canonical: null,
      keyIssuedAt: null,
      pending: false,
    };
    writeStore(store);
    return { ok: false, message: EXPIRED_CHECKOUT_MESSAGE };
  }
  if (bucket.pending && bucket.idempotencyKey) {
    writeStore(store);
    return {
      ok: true,
      key: bucket.idempotencyKey,
      items: bucket.items.map((item) => ({ ...item })),
    };
  }
  const fresh = keyIsCurrent(bucket, canonical);
  const idempotencyKey = fresh && bucket.idempotencyKey ? bucket.idempotencyKey : crypto.randomUUID();
  store.users[key] = {
    items: bucket.items,
    idempotencyKey,
    canonical,
    keyIssuedAt: fresh && bucket.keyIssuedAt ? bucket.keyIssuedAt : Date.now(),
    pending: true,
  };
  writeStore(store);
  return { ok: true, key: idempotencyKey, items: bucket.items.map((item) => ({ ...item })) };
}

export function releaseOrderKey(userId: number) {
  const store = readStore();
  const key = String(userId);
  const bucket = store.users[key] ?? emptyBucket();
  store.users[key] = {
    ...bucket,
    idempotencyKey: null,
    canonical: null,
    keyIssuedAt: null,
    pending: false,
  };
  writeStore(store);
}

export function finishOrderSubmit(
  userId: number,
  outcome: "success" | "settled" | "uncertain",
  confirmation?: Confirmation,
) {
  const store = readStore();
  const key = String(userId);
  const bucket = store.users[key] ?? emptyBucket();
  if (outcome === "success" && confirmation) {
    store.users[key] = emptyBucket();
    store.confirmations[key] = confirmation;
  } else if (outcome === "settled") {
    store.users[key] = { ...bucket, pending: false };
  } else {
    store.users[key] = { ...bucket, pending: true };
  }
  writeStore(store);
}
