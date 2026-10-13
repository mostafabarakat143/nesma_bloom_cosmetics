import { describe, expect, it } from "vitest";

import { getCorsOrigins, loadEnv } from "../../src/config/env.js";

describe("loadEnv", () => {
  it("applies safe defaults", () => {
    const env = loadEnv({
      NODE_ENV: "test",
    });

    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.BODY_SIZE_LIMIT).toBe("100kb");
  });

  it("fails fast on invalid configuration", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "test",
        PORT: "not-a-number",
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it("parses comma-separated CORS origins", () => {
    expect(getCorsOrigins("http://localhost:3000, https://app.example.com")).toEqual([
      "http://localhost:3000",
      "https://app.example.com",
    ]);
    expect(getCorsOrigins("")).toBe(false);
  });
});
