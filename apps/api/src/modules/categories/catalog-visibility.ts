import type { CatalogStatus } from "../../generated/prisma/client.js";

/**
 * Parent visibility rule (catalog):
 * A subcategory or product must not appear in future public catalog endpoints
 * unless its own status is ACTIVE AND every ancestor category/subcategory is ACTIVE.
 *
 * Restoring a category (status → ACTIVE) does NOT automatically restore children;
 * each entity keeps its own status. Public subcategory APIs (Step 19) filter
 * Subcategory.status = ACTIVE AND Category.status = ACTIVE in Prisma queries.
 * Product public filters (Step 20+) must also check ancestor statuses.
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
