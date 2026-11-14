import { createHash, randomUUID } from "node:crypto";

import type { Logger } from "../../config/logger.js";

export type CatalogCache = {
  read<T>(key: string, load: () => Promise<T>, enabled?: boolean): Promise<T>;
  write<T>(operation: () => Promise<T>): Promise<T>;
  invalidate(): Promise<void>;
};

export type CacheStore = {
  readonly isReady: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
};

export const uncachedCatalog: CatalogCache = {
  read: (_key, load) => load(),
  write: (operation) => operation(),
  invalidate: async () => { },
};

export function catalogCacheKey(resource: string, input: unknown): string {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return `${resource}:${hash}`;
}

export function createCatalogCache(
  store: CacheStore,
  options: { prefix: string; ttlSeconds: number; logger: Logger },
): CatalogCache {
  const revisionKey = `${options.prefix}:revision`;
  const pending = new Map<string, Promise<unknown>>();
  let needsReset = true;
  let warned = false;

  function unavailable(operation: string): void {
    needsReset = true;
    if (!warned) {
      warned = true;
      options.logger.warn({ operation }, "Catalog cache unavailable; using PostgreSQL");
    }
  }

  async function invalidate(): Promise<void> {
    if (!store.isReady) {
      needsReset = true;
      return;
    }
    try {
      await store.set(revisionKey, randomUUID());
      needsReset = false;
      warned = false;
    } catch {
      unavailable("invalidate");
    }
  }

  return {
    invalidate,

    async read<T>(key: string, load: () => Promise<T>, enabled = true): Promise<T> {
      if (!enabled) return load();
      if (!store.isReady) {
        needsReset = true;
        return load();
      }

      let entryKey: string;
      try {
        if (needsReset) await invalidate();
        if (needsReset) return load();

        let revision = await store.get(revisionKey);
        if (revision === null) {
          await invalidate();
          if (needsReset) return load();
          revision = await store.get(revisionKey);
          if (revision === null) return load();
        }
        entryKey = `${options.prefix}:${revision}:${key}`;
        const cached = await store.get(entryKey);
        if (cached !== null) {
          const result = JSON.parse(cached) as T;
          options.logger.debug({ key }, "Catalog cache hit");
          return result;
        }
      } catch {
        unavailable("read");
        return load();
      }

      const existing = pending.get(entryKey);
      if (existing) return existing as Promise<T>;

      options.logger.debug({ key }, "Catalog cache miss");
      const result = (async () => {
        const data = await load();
        try {
          const serialized = JSON.stringify(data);
          if (serialized !== undefined && store.isReady) {
            await store.set(entryKey, serialized, options.ttlSeconds);
          }
        } catch {
          unavailable("populate");
        }
        return data;
      })();
      pending.set(entryKey, result);
      try {
        return await result;
      } finally {
        pending.delete(entryKey);
      }
    },

    async write<T>(operation: () => Promise<T>): Promise<T> {
      try {
        return await operation();
      } finally {
        await invalidate();
      }
    },
  };
}
