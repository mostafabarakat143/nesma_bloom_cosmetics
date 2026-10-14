import type { CatalogStatus } from "../../generated/prisma/client.js";

/**
 * Parent visibility rule (catalog):
 * A subcategory or product must not appear in public catalog endpoints unless
 * its own status is ACTIVE AND every ancestor category/subcategory is ACTIVE.
 *
 * Restoring a category (status → ACTIVE) does NOT automatically restore children;
 * each entity keeps its own status.
 *
 * Public products also require Product.isAvailable = true (stockQty may be 0).
 */
export function isCatalogStatusPubliclyVisible(status: CatalogStatus): boolean {
  return status === "ACTIVE";
}

export function isPublicCategoryVisible(category: {
  status: CatalogStatus;
}): boolean {
  return isCatalogStatusPubliclyVisible(category.status);
}

/**
 * Future public subcategory listing predicate (documented for Steps 19+).
 */
export function isPublicSubcategoryVisible(input: {
  subcategoryStatus: CatalogStatus;
  parentCategoryStatus: CatalogStatus;
}): boolean {
  return (
    isCatalogStatusPubliclyVisible(input.subcategoryStatus) &&
    isCatalogStatusPubliclyVisible(input.parentCategoryStatus)
  );
}

/**
 * Future public product listing predicate (documented for Steps 19+).
 */
export function isPublicProductVisible(input: {
  productStatus: CatalogStatus;
  productIsAvailable: boolean;
  parentSubcategoryStatus: CatalogStatus;
  parentCategoryStatus: CatalogStatus;
}): boolean {
  return (
    isCatalogStatusPubliclyVisible(input.productStatus) &&
    input.productIsAvailable &&
    isCatalogStatusPubliclyVisible(input.parentSubcategoryStatus) &&
    isCatalogStatusPubliclyVisible(input.parentCategoryStatus)
  );
}
