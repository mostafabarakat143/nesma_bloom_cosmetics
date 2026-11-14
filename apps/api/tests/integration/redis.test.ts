import { randomUUID } from "node:crypto";

import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { loadEnv } from "../../src/config/env.js";
import { createLogger } from "../../src/config/logger.js";
import { createRedisCache } from "../../src/config/redis.js";
import { baseTestEnvVars } from "../helpers/test-env.js";

const redisUrl = process.env.REDIS_URL_TEST;

describe.skipIf(!redisUrl)("Redis catalog cache with a real server", () => {
  const env = loadEnv({
    ...baseTestEnvVars,
    REDIS_URL: redisUrl,
    REDIS_KEY_PREFIX: `test:${randomUUID()}`,
    CACHE_TTL_SECONDS: "30",
    LOG_LEVEL: "silent",
  });
  const prefix = `${env.REDIS_KEY_PREFIX}:test:catalog:v1`;
  const redis = createRedisCache(env, createLogger(env));
  const probe = createClient({
    url: redisUrl,
    socket: { reconnectStrategy: false, connectTimeout: 1_000 },
    commandOptions: { timeout: 1_000 },
  });
  probe.on("error", () => { });

  beforeAll(async () => {
    await probe.connect();
    redis.start();
    await vi.waitFor(async () => {
      expect(await probe.get(`${prefix}:revision`)).not.toBeNull();
    }, { timeout: 5_000 });
  });

  afterAll(async () => {
    redis.stop();
    try {
      if (probe.isReady) {
        const keys = await probe.keys(`${prefix}:*`);
        if (keys.length > 0) await probe.del(keys);
      }
    } finally {
      if (probe.isOpen) probe.destroy();
    }
  });

  it("stores JSON with a TTL and serves repeated requests from Redis", async () => {
    const load = vi.fn().mockResolvedValue({ id: 1, stockQty: 2 });
    const first = await redis.cache.read("products:1", load);
    expect(await redis.cache.read("products:1", load)).toEqual(first);
    expect(load).toHaveBeenCalledTimes(1);
    const revision = await probe.get(`${prefix}:revision`);
    const key = `${prefix}:${revision}:products:1`;
    expect(JSON.parse((await probe.get(key))!)).toEqual(first);
    expect(await probe.ttl(key)).toBeGreaterThan(0);
    expect(await probe.ttl(key)).toBeLessThanOrEqual(30);
  });

  it("reloads from the database after a committed mutation", async () => {
    let stockQty = 2;
    const load = vi.fn(async () => ({ stockQty }));
    await redis.cache.read("products:stock", load);
    await redis.cache.write(async () => { stockQty = 1; });
    expect(await redis.cache.read("products:stock", load)).toEqual({ stockQty: 1 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("reloads after Redis expires an entry", async () => {
    const load = vi.fn().mockResolvedValue({ id: 1 });
    await redis.cache.read("products:expiry", load);
    const revision = await probe.get(`${prefix}:revision`);
    await probe.pExpire(`${prefix}:${revision}:products:expiry`, 1);
    await vi.waitFor(async () => {
      expect(await probe.get(`${prefix}:${revision}:products:expiry`)).toBeNull();
    });
    await redis.cache.read("products:expiry", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
