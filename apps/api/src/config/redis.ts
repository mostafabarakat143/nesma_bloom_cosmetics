import { createClient } from "redis";

import {
  createCatalogCache,
  uncachedCatalog,
  type CacheStore,
} from "../common/cache/catalog-cache.js";
import type { Env } from "./env.js";
import type { Logger } from "./logger.js";

export function createRedisCache(env: Env, logger: Logger) {
  if (!env.REDIS_URL) {
    return { cache: uncachedCatalog, start: () => { }, stop: () => { } };
  }

  const client = createClient({
    url: env.REDIS_URL,
    socket: {
      connectTimeout: 1_000,
      reconnectStrategy: (retries) => Math.min(250 * 2 ** Math.min(retries, 4), 5_000),
    },
    disableOfflineQueue: true,
    commandsQueueMaxLength: 100,
    commandOptions: { timeout: 200 },
  });
  const store: CacheStore = {
    get isReady() { return client.isReady; },
    get: (key) => client.get(key),
    async set(key, value, ttlSeconds) {
      await client.set(key, value, ttlSeconds === undefined ? undefined : { EX: ttlSeconds });
    },
  };
  const cache = createCatalogCache(store, {
    prefix: `${env.REDIS_KEY_PREFIX}:${env.NODE_ENV}:catalog:v1`,
    ttlSeconds: env.CACHE_TTL_SECONDS,
    logger,
  });
  let warned = false;

  function unavailable(): void {
    if (!warned) {
      warned = true;
      logger.warn("Redis unavailable; catalog requests will use PostgreSQL");
    }
  }

  client.on("error", unavailable);
  client.on("ready", () => {
    warned = false;
    void cache.invalidate();
    logger.info("Redis connected for catalog caching");
  });

  return {
    cache,
    start(): void {
      if (!client.isOpen) void client.connect().catch(unavailable);
    },
    stop(): void {
      if (client.isOpen) client.destroy();
    },
  };
}
