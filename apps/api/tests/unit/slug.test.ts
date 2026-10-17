import { describe, expect, it } from "vitest";

import { normalizeSlug, slugifyFromName } from "../../src/common/utils/slug.js";

describe("slug utils", () => {
  it("normalizes and slugifies names", () => {
    expect(slugifyFromName("  Skin Care! ")).toBe("skin-care");
    expect(normalizeSlug("Make--Up")).toBe("make-up");
  });

  it("respects custom max length for product slugs", () => {
    const long = "a".repeat(250);
    expect(slugifyFromName(long, 220)).toHaveLength(220);
  });
});
