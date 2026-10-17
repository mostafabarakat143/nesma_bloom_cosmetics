import { describe, expect, it } from "vitest";

import { AppError } from "../../src/common/errors/app-error.js";

describe("AppError", () => {
  it("creates operational client errors with the expected status and code", () => {
    const error = AppError.notFound("Category not found");

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Category not found");
    expect(error.isOperational).toBe(true);
  });

  it("marks internal errors as non-operational", () => {
    const error = AppError.internal();

    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(false);
  });
});
