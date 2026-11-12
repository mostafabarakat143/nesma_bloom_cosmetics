import type { CatalogStatus } from "../../generated/prisma/client.js";

export function isCatalogStatusPubliclyVisible(status: CatalogStatus): boolean {
  return status === "ACTIVE";
}

export function isPublicCategoryVisible(category: {
  status: CatalogStatus;
}): boolean {
  return isCatalogStatusPubliclyVisible(category.status);
}

export function isPublicSubcategoryVisible(input: {
  subcategoryStatus: CatalogStatus;
  parentCategoryStatus: CatalogStatus;
}): boolean {
  return (
    isCatalogStatusPubliclyVisible(input.subcategoryStatus) &&
    isCatalogStatusPubliclyVisible(input.parentCategoryStatus)
  );
}

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
