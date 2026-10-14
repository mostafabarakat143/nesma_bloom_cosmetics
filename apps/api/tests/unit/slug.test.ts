import { describe, expect, it } from "vitest";

import { normalizeSlug, slugifyFromName } from "../../src/common/utils/slug.js";

describe("slug utils", () => {
  it("normalizes and slugifies names", () => {
    expect(slugifyFromName("  Skin Care! ")).toBe("skin-care");
    expect(normalizeSlug("Make--Up")).toBe("make-up");
  });
});
