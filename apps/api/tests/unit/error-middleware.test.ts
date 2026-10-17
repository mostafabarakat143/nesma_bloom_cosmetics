import { describe, expect, it } from "vitest";

import { isDatabaseUnavailableError } from "../../src/common/middlewares/error.middleware.js";

describe("isDatabaseUnavailableError", () => {
  it("detects Prisma connection codes", () => {
    expect(isDatabaseUnavailableError({ code: "P1001" })).toBe(true);
    expect(isDatabaseUnavailableError({ code: "P1017" })).toBe(true);
  });

  it("detects common connection messages", () => {
    expect(
      isDatabaseUnavailableError(new Error("Can't reach database server")),
    ).toBe(true);
  });

  it("ignores ordinary errors", () => {
    expect(isDatabaseUnavailableError(new Error("Validation failed"))).toBe(
      false,
    );
  });
});
