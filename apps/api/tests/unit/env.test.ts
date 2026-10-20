import path from "node:path";
import { describe, expect, it } from "vitest";

import { getCorsOrigins, loadEnv } from "../../src/config/env.js";
import { baseTestEnvVars } from "../helpers/test-env.js";

describe("loadEnv", () => {
  it("applies safe defaults", () => {
    const env = loadEnv({
      ...baseTestEnvVars,
    });

    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.BODY_SIZE_LIMIT).toBe("100kb");
    expect(env.JWT_TTL_SECONDS).toBe(604_800);
    expect(env.JWT_ISSUER).toBe("nesma-bloom-api");
    expect(env.JWT_AUDIENCE).toBe("nesma-bloom-clients");
    expect(env.API_PUBLIC_URL).toBe("http://localhost:4000");
    expect(env.UPLOAD_DIR).toBe(path.resolve("uploads"));
  });

  it("fails fast on invalid configuration", () => {
    expect(() =>
      loadEnv({
        ...baseTestEnvVars,
        PORT: "not-a-number",
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it("requires a PostgreSQL DATABASE_URL", () => {
    expect(() =>
      loadEnv({
        ...baseTestEnvVars,
        DATABASE_URL: "mysql://example",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("requires a sufficiently long JWT secret", () => {
    expect(() =>
      loadEnv({
        ...baseTestEnvVars,
        JWT_ACCESS_SECRET: "short",
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("rejects an API public URL that includes a path", () => {
    expect(() =>
      loadEnv({
        ...baseTestEnvVars,
        API_PUBLIC_URL: "http://localhost:4000/api",
      }),
    ).toThrow(/API_PUBLIC_URL/);
  });

  it("parses comma-separated CORS origins", () => {
    expect(getCorsOrigins("http://localhost:3000, https://app.example.com")).toEqual([
      "http://localhost:3000",
      "https://app.example.com",
    ]);
    expect(getCorsOrigins("")).toBe(false);
  });

  it("disables API docs by default in production", () => {
    const env = loadEnv({
      ...baseTestEnvVars,
      NODE_ENV: "production",
    });
    expect(env.ENABLE_API_DOCS).toBe(false);
  });
});
