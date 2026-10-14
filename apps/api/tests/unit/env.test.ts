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
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
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

  it("parses comma-separated CORS origins", () => {
    expect(getCorsOrigins("http://localhost:3000, https://app.example.com")).toEqual([
      "http://localhost:3000",
      "https://app.example.com",
    ]);
    expect(getCorsOrigins("")).toBe(false);
  });
});
