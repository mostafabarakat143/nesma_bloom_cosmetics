import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTestApp, buildTestEnv } from "../helpers/test-app.js";
import { assertTestDatabaseUrl } from "../helpers/test-database.js";

const safeUrl = "postgresql://test:private@127.0.0.1:5432/nesma_bloom_test?schema=public";

afterEach(() => vi.unstubAllEnvs());

describe("test database safety", () => {
  it("allows the explicitly dedicated test database", () => {
    expect(() => assertTestDatabaseUrl(safeUrl)).not.toThrow();
    expect(buildTestEnv({ DATABASE_URL: safeUrl }).DATABASE_URL).toBe(safeUrl);
  });

  it.each([
    "postgresql://test:private@localhost/nesma_bloom",
    "postgresql://test:private@localhost/postgres",
    "postgresql://test:private@localhost/another_test",
    "postgresql://test:private@localhost/",
    "not-a-url",
    "https://localhost/nesma_bloom_test",
    `${safeUrl}&database=nesma_bloom`,
    `${safeUrl}&dbname=nesma_bloom`,
    `${safeUrl}&host=another-server`,
    `${safeUrl}&options=-csearch_path=other`,
  ])("rejects unsafe test configuration %j before constructing the app", (url) => {
    expect(() => buildTestApp({ DATABASE_URL: url })).toThrow(/Refusing test setup/);
  });

  it("rejects an unsafe DATABASE_URL_TEST from the shell", () => {
    vi.stubEnv("DATABASE_URL_TEST", "postgresql://test:private@localhost/nesma_bloom");
    expect(() => buildTestApp()).toThrow(/dedicated nesma_bloom_test/);
  });

  it("validates both forms of per-test URL overrides", () => {
    expect(() => buildTestEnv({
      DATABASE_URL_TEST: "postgresql://test:private@localhost/nesma_bloom",
    })).toThrow(/Refusing test setup/);
  });

  it("refuses non-test application environments", () => {
    expect(() => buildTestApp({ DATABASE_URL: safeUrl, NODE_ENV: "production" }))
      .toThrow(/NODE_ENV must be test/);
  });

  it("does not include connection credentials in rejection errors", () => {
    try {
      assertTestDatabaseUrl("postgresql://test:private@localhost/nesma_bloom");
      throw new Error("Expected rejection");
    } catch (error) {
      expect(String(error)).toMatch(/Refusing test setup/);
      expect(String(error)).not.toContain("private");
      expect(String(error)).not.toContain("postgresql://");
    }
  });
});
