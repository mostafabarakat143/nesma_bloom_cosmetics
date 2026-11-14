import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogCacheKey, createCatalogCache } from "../../src/common/cache/catalog-cache.js";
import { loadEnv } from "../../src/config/env.js";
import { createLogger } from "../../src/config/logger.js";
import { createMemoryCacheStore } from "../helpers/memory-cache.js";
import { baseTestEnvVars } from "../helpers/test-env.js";

const logger = createLogger(loadEnv({ ...baseTestEnvVars, LOG_LEVEL: "silent" }));

function setup() {
  const { store, entries } = createMemoryCacheStore();
  const cache = createCatalogCache(store, { prefix: "test:catalog", ttlSeconds: 30, logger });
  return { store, entries, cache };
}

afterEach(() => vi.useRealTimers());

describe("catalog cache", () => {
  it("loads a miss from the database and serves the next read from cache", async () => {
    const { cache } = setup();
    const load = vi.fn().mockResolvedValue({ items: [{ id: 1, priceMinor: 100 }] });
    const first = await cache.read("products", load);
    const second = await cache.read("products", load);
    expect(second).toEqual(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("expires entries after the configured TTL", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { cache } = setup();
    const load = vi.fn().mockResolvedValueOnce({ stockQty: 2 }).mockResolvedValueOnce({ stockQty: 1 });
    await cache.read("product:1", load);
    vi.setSystemTime(Date.now() + 30_001);
    await expect(cache.read("product:1", load)).resolves.toEqual({ stockQty: 1 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps resource, filter, sort, and page keys separate without exposing search text", () => {
    const inputs = [
      ["products", { page: 1, search: "private search", sortBy: "name" }],
      ["products", { page: 2, search: "private search", sortBy: "name" }],
      ["products", { page: 1, search: "other", sortBy: "name" }],
      ["products", { page: 1, search: "private search", sortBy: "priceMinor" }],
      ["categories", { page: 1, search: "private search", sortBy: "name" }],
    ] as const;
    const keys = inputs.map(([resource, input]) => catalogCacheKey(resource, input));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.join("")).not.toContain("private search");
  });

  it("bypasses the cache when the caller disables caching", async () => {
    const { cache, store } = setup();
    const load = vi.fn().mockResolvedValue({ id: 1 });
    const get = vi.spyOn(store, "get");
    await cache.read("products", load, false);
    await cache.read("products", load, false);
    expect(load).toHaveBeenCalledTimes(2);
    expect(get).not.toHaveBeenCalled();
  });

  it("uses the database when Redis is disconnected", async () => {
    const { cache, store } = setup();
    store.isReady = false;
    await expect(cache.read("products", async () => ({ id: 1 }))).resolves.toEqual({ id: 1 });
  });

  it.each(["get", "set"] as const)("falls back safely when Redis %s fails", async (method) => {
    const { cache, store } = setup();
    vi.spyOn(store, method).mockRejectedValue(new Error("Redis unavailable"));
    await expect(cache.read("products", async () => ({ id: 1 }))).resolves.toEqual({ id: 1 });
  });

  it("still returns the database result when writing a cache entry fails", async () => {
    const { cache, store } = setup();
    await cache.invalidate();
    vi.spyOn(store, "set").mockRejectedValue(new Error("Redis write failure"));
    await expect(cache.read("products", async () => ({ id: 1 }))).resolves.toEqual({ id: 1 });
  });

  it("invalidates every catalog view after a write", async () => {
    const { cache } = setup();
    const products = vi.fn().mockResolvedValue({ stockQty: 2 });
    const categories = vi.fn().mockResolvedValue({ name: "Care" });
    await cache.read("products", products);
    await cache.read("categories", categories);
    await cache.write(async () => ({ updated: true }));
    await cache.read("products", products);
    await cache.read("categories", categories);
    expect(products).toHaveBeenCalledTimes(2);
    expect(categories).toHaveBeenCalledTimes(2);
  });

  it("invalidates across API instances sharing the same Redis key prefix", async () => {
    const { cache, store } = setup();
    const other = createCatalogCache(store, { prefix: "test:catalog", ttlSeconds: 30, logger });
    await other.invalidate();
    const load = vi.fn().mockResolvedValue({ id: 1 });
    await cache.read("products", load);
    await other.read("products", load);
    expect(load).toHaveBeenCalledTimes(1);
    await other.write(async () => undefined);
    await cache.read("products", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not let a slow, older read repopulate the current revision", async () => {
    const { cache } = setup();
    let finishOldRead!: (value: { stockQty: number }) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const oldRead = cache.read("product:1", () => {
      markStarted();
      return new Promise<{ stockQty: number }>((resolve) => { finishOldRead = resolve; });
    });
    await started;
    await cache.write(async () => undefined);
    const fresh = vi.fn().mockResolvedValue({ stockQty: 1 });
    await expect(cache.read("product:1", fresh)).resolves.toEqual({ stockQty: 1 });
    finishOldRead({ stockQty: 2 });
    await oldRead;
    await expect(cache.read("product:1", fresh)).resolves.toEqual({ stockQty: 1 });
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("invalidates even if an operation throws after changing database state", async () => {
    const { cache } = setup();
    const load = vi.fn().mockResolvedValue({ id: 1 });
    await cache.read("products", load);
    const failure = new Error("File cleanup failed after database commit");
    await expect(cache.write(async () => { throw failure; })).rejects.toBe(failure);
    await cache.read("products", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not turn a committed database write into a failure when invalidation fails", async () => {
    const { cache, store } = setup();
    vi.spyOn(store, "set").mockRejectedValue(new Error("Redis unavailable"));
    await expect(cache.write(async () => ({ created: true }))).resolves.toEqual({ created: true });
  });

  it("drops old cache entries before resuming after an outage", async () => {
    const { cache, store } = setup();
    const load = vi.fn().mockResolvedValueOnce({ stockQty: 2 }).mockResolvedValueOnce({ stockQty: 1 });
    await cache.read("products", load);
    store.isReady = false;
    await cache.write(async () => undefined);
    store.isReady = true;
    await expect(cache.read("products", load)).resolves.toEqual({ stockQty: 1 });
  });

  it("shares a database lookup between simultaneous misses in the same API instance", async () => {
    const { cache } = setup();
    await cache.invalidate();
    let resolve!: (value: { id: number }) => void;
    const load = vi.fn(() => new Promise<{ id: number }>((finish) => { resolve = finish; }));
    const first = cache.read("products", load);
    const second = cache.read("products", load);
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    resolve({ id: 1 });
    expect(await first).toEqual(await second);
  });

  it("does not cache business errors", async () => {
    const { cache } = setup();
    const failure = new Error("Product not found");
    const load = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce({ id: 1 });
    await expect(cache.read("products", load)).rejects.toBe(failure);
    await expect(cache.read("products", load)).resolves.toEqual({ id: 1 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("recovers from malformed cached JSON", async () => {
    const { cache, entries } = setup();
    const load = vi.fn().mockResolvedValue({ id: 1 });
    await cache.read("products", load);
    const entry = [...entries.entries()].find(([key]) => key.endsWith(":products"))!;
    entry[1].value = "broken JSON";
    await expect(cache.read("products", load)).resolves.toEqual({ id: 1 });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
