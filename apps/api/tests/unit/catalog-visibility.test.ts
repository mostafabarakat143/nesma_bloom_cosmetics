import { describe, expect, it } from "vitest";

import {
  isPublicCategoryVisible,
  isPublicProductVisible,
  isPublicSubcategoryVisible,
} from "../../src/modules/categories/catalog-visibility.js";

describe("catalog parent visibility rules", () => {
  it("hides archived categories from public view", () => {
    expect(isPublicCategoryVisible({ status: "ACTIVE" })).toBe(true);
    expect(isPublicCategoryVisible({ status: "ARCHIVED" })).toBe(false);
  });

  it("hides subcategories under archived parent categories", () => {
    expect(
      isPublicSubcategoryVisible({
        subcategoryStatus: "ACTIVE",
        parentCategoryStatus: "ARCHIVED",
      }),
    ).toBe(false);

    expect(
      isPublicSubcategoryVisible({
        subcategoryStatus: "ACTIVE",
        parentCategoryStatus: "ACTIVE",
      }),
    ).toBe(true);
  });

  it("hides products under archived ancestor categories even if product is ACTIVE", () => {
    expect(
      isPublicProductVisible({
        productStatus: "ACTIVE",
        productIsAvailable: true,
        parentSubcategoryStatus: "ACTIVE",
        parentCategoryStatus: "ARCHIVED",
      }),
    ).toBe(false);
  });
});
