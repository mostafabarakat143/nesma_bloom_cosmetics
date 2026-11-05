import { describe, expect, it } from "vitest";

import {
  MAX_DB_INT,
  positiveIntIdField,
  positiveIntIdSchema,
} from "../../src/common/validation/ids.js";
import { createOrderBodySchema } from "../../src/modules/orders/order.schema.js";

describe("request ID validation", () => {
  it.each([1, "1", MAX_DB_INT, String(MAX_DB_INT)])(
    "accepts database integer ID %j",
    (value) => {
      expect(positiveIntIdSchema.parse(value)).toBe(Number(value));
    },
  );

  it.each([
    true, false, null, undefined, [], [1], { valueOf: () => 1 },
    "", " ", " 1 ", "1.0", "1e2", "0x10", 0, -1, 1.5,
    Number.NaN, Number.POSITIVE_INFINITY, MAX_DB_INT + 1,
  ])("rejects invalid ID %j", (value) => {
    expect(positiveIntIdSchema.safeParse(value).success).toBe(false);
    expect(positiveIntIdField("Product ID").safeParse(value).success).toBe(false);
  });

  it("preserves a field-specific message for missing IDs", () => {
    const result = positiveIntIdField("Product ID").safeParse(undefined);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Product ID is required.");
    }
  });

  it("rejects boolean checkout product IDs instead of ordering product 1", () => {
    expect(createOrderBodySchema.safeParse({
      items: [{ productId: true, quantity: 1 }],
    }).success).toBe(false);
    expect(createOrderBodySchema.parse({
      items: [{ productId: "1", quantity: 1 }],
    }).items[0]?.productId).toBe(1);
  });
});
