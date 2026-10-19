import { describe, expect, it } from "vitest";
import { z } from "zod";

import { formatZodErrorMessage } from "../../src/common/errors/zod-message.js";

describe("formatZodErrorMessage", () => {
  it("maps missing password and nested quantity", () => {
    const schema = z.object({
      password: z.string({ error: () => "Password is required." }),
      items: z.array(
        z.object({
          quantity: z.number({ error: () => "Quantity is required." }),
        }),
      ),
    });

    const missingPassword = schema.safeParse({});
    expect(missingPassword.success).toBe(false);
    if (!missingPassword.success) {
      expect(formatZodErrorMessage(missingPassword.error)).toBe(
        "Password is required.",
      );
    }

    const missingQty = schema.safeParse({
      password: "Password123!",
      items: [{}],
    });
    expect(missingQty.success).toBe(false);
    if (!missingQty.success) {
      expect(formatZodErrorMessage(missingQty.error)).toBe(
        "Quantity is required.",
      );
    }
  });

  it("maps invalid email", () => {
    const schema = z.object({
      email: z.string().email("Please enter a valid email address."),
    });
    const result = schema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodErrorMessage(result.error)).toBe(
        "Please enter a valid email address.",
      );
    }
  });
});
