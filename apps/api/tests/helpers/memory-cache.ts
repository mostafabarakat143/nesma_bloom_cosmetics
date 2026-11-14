import type { CacheStore } from "../../src/common/cache/catalog-cache.js";

export function createMemoryCacheStore() {
  const entries = new Map<string, { value: string; expiresAt?: number }>();
  const store: CacheStore & { isReady: boolean } = {
    isReady: true,
    async get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, {
        value,
        expiresAt: ttlSeconds === undefined ? undefined : Date.now() + ttlSeconds * 1_000,
      });
    },
  };
  return { store, entries };
}
