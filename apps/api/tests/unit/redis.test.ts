import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadEnv } from "../../src/config/env.js";
import { createLogger } from "../../src/config/logger.js";
import { createRedisCache } from "../../src/config/redis.js";
import { baseTestEnvVars } from "../helpers/test-env.js";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  events: new Map<string, () => void>(),
  client: {
    isOpen: false,
    isReady: false,
    on: vi.fn(),
    connect: vi.fn(),
    destroy: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("redis", () => ({ createClient: mocks.createClient }));

const logger = createLogger(loadEnv({ ...baseTestEnvVars, LOG_LEVEL: "silent" }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.events.clear();
  mocks.client.isOpen = false;
  mocks.client.isReady = false;
  mocks.createClient.mockReturnValue(mocks.client);
  mocks.client.on.mockImplementation((event, callback) => {
    mocks.events.set(event, callback);
    return mocks.client;
  });
  mocks.client.connect.mockImplementation(async () => { mocks.client.isOpen = true; });
  mocks.client.destroy.mockImplementation(() => { mocks.client.isOpen = false; });
  mocks.client.get.mockResolvedValue(null);
  mocks.client.set.mockResolvedValue("OK");
});

describe("Redis lifecycle", () => {
  it("does not open a connection when REDIS_URL is empty", async () => {
    const redis = createRedisCache(loadEnv(baseTestEnvVars), logger);
    redis.start();
    await expect(redis.cache.read("products", async () => ({ id: 1 }))).resolves.toEqual({ id: 1 });
    redis.stop();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("bounds command latency and disables offline command queuing", () => {
    createRedisCache(loadEnv({ ...baseTestEnvVars, REDIS_URL: "redis://localhost:6379/0" }), logger);
    expect(mocks.createClient).toHaveBeenCalledWith(expect.objectContaining({
      disableOfflineQueue: true,
      commandsQueueMaxLength: 100,
      commandOptions: { timeout: 200 },
      socket: expect.objectContaining({ connectTimeout: 1_000 }),
    }));
  });

  it("starts one background connection and closes it during shutdown", () => {
    const redis = createRedisCache(loadEnv({ ...baseTestEnvVars, REDIS_URL: "redis://localhost:6379/0" }), logger);
    redis.start();
    redis.start();
    expect(mocks.client.connect).toHaveBeenCalledTimes(1);
    redis.stop();
    redis.stop();
    expect(mocks.client.destroy).toHaveBeenCalledTimes(1);
  });

  it("invalidates the shared revision whenever Redis becomes ready again", async () => {
    createRedisCache(loadEnv({ ...baseTestEnvVars, REDIS_URL: "redis://localhost:6379/0" }), logger);
    mocks.client.isReady = true;
    mocks.events.get("ready")!();
    await vi.waitFor(() => expect(mocks.client.set).toHaveBeenCalledTimes(1));
    mocks.events.get("ready")!();
    await vi.waitFor(() => expect(mocks.client.set).toHaveBeenCalledTimes(2));
    expect(mocks.client.set.mock.calls[0]?.[0]).toBe("cosmetics:api:test:catalog:v1:revision");
    expect(mocks.client.set.mock.calls[0]?.[1]).not.toBe(mocks.client.set.mock.calls[1]?.[1]);
  });

  it("keeps database reads working and never logs Redis credentials on connection failure", async () => {
    const warn = vi.spyOn(logger, "warn");
    mocks.client.connect.mockRejectedValueOnce(new Error("redis://user:secret@localhost:6379"));
    const redis = createRedisCache(loadEnv({ ...baseTestEnvVars, REDIS_URL: "redis://user:secret@localhost:6379" }), logger);
    redis.start();
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    mocks.events.get("error")!();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
    await expect(redis.cache.read("products", async () => ({ id: 1 }))).resolves.toEqual({ id: 1 });
  });
});
