import type { Request } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { slugifyFromName } from "../../common/utils/slug.js";
import type { Database } from "../../config/database.js";
import { isPublicProductVisible } from "../categories/catalog-visibility.js";
import { toProductDto, type ProductDto } from "./product.mapper.js";
import {
  clearPrimaryImages,
  createProduct,
  createProductImage,
  deleteProductImageRecord,
  findNextImageBySortOrder,
  findParentSubcategory,
  findProductById,
  findProductImage,
  findProductsPage,
  getMaxImageSortOrder,
  updateProduct,
  updateProductImageRecord,
  type ParentSubcategory,
} from "./product.repository.js";
import type {
  CreateProductBody,
  CreateProductImageBody,
  ListProductsQuery,
  UpdateProductBody,
  UpdateProductImageBody,
} from "./product.schema.js";

type AuthUser = NonNullable<Request["user"]>;

export type PaginatedProducts = {
  items: ProductDto[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

const ARCHIVED_PARENT_CONFLICT =
  "Cannot place an ACTIVE product under an archived category or subcategory";

const PRODUCT_SLUG_MAX = 220;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function uniqueTargetFields(error: unknown): string[] {
  if (
    typeof error !== "object" ||
    error === null ||
    !("meta" in error) ||
    typeof (error as { meta: unknown }).meta !== "object" ||
    (error as { meta: unknown }).meta === null
  ) {
    return [];
  }

  const meta = (error as { meta: { target?: unknown } }).meta;
  if (Array.isArray(meta.target)) {
    return meta.target.filter((field): field is string => typeof field === "string");
  }
  if (typeof meta.target === "string") {
    return [meta.target];
  }
  return [];
}

function mapProductUniqueError(error: unknown): AppError {
  const fields = uniqueTargetFields(error);
  if (fields.includes("sku")) {
    return AppError.conflict("Product SKU already exists");
  }
  if (fields.includes("slug")) {
    return AppError.conflict("Product slug already exists");
  }
  return AppError.conflict("Product violates a unique constraint");
}

function mapImageUniqueError(error: unknown): AppError {
  const fields = uniqueTargetFields(error);
  if (fields.includes("sort_order") || fields.includes("sortOrder")) {
    return AppError.conflict("Image sort order already in use for this product");
  }
  if (fields.includes("product_id") || fields.includes("productId")) {
    return AppError.conflict("Product already has a primary image");
  }
  return AppError.conflict("Image violates a unique constraint");
}

function assertCanFilterStatus(
  status: ListProductsQuery["status"],
  user?: AuthUser,
): void {
  if (status === "ACTIVE") {
    return;
  }
  if (!user || user.role !== "ADMIN") {
    throw AppError.forbidden("Insufficient permissions");
  }
}

function assertCanFilterAvailability(
  availability: ListProductsQuery["availability"],
  user?: AuthUser,
): void {
  if (availability === "AVAILABLE") {
    return;
  }
  if (!user || user.role !== "ADMIN") {
    throw AppError.forbidden("Insufficient permissions");
  }
}

function assertActiveAllowedUnderParents(
  productStatus: "ACTIVE" | "ARCHIVED",
  parent: ParentSubcategory,
): void {
  if (productStatus !== "ACTIVE") {
    return;
  }
  if (parent.status === "ARCHIVED" || parent.category.status === "ARCHIVED") {
    throw AppError.conflict(ARCHIVED_PARENT_CONFLICT);
  }
}

export async function listProducts(
  prisma: Database,
  query: ListProductsQuery,
  user?: AuthUser,
): Promise<PaginatedProducts> {
  assertCanFilterStatus(query.status, user);
  assertCanFilterAvailability(query.availability, user);

  // ACTIVE listings enforce ancestor ACTIVE in SQL for both findMany and count.
  const requireActiveParents = query.status === "ACTIVE";

  const { items, totalItems } = await findProductsPage(prisma, {
    status: query.status,
    requireActiveParents,
    availability: query.availability,
    categoryId: query.categoryId,
    subcategoryId: query.subcategoryId,
    search: query.search,
    minPriceMinor: query.minPriceMinor,
    maxPriceMinor: query.maxPriceMinor,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    page: query.page,
    pageSize: query.pageSize,
  });

  const totalPages =
    totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

  return {
    items: items.map(toProductDto),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function getProductById(
  prisma: Database,
  id: number,
  user?: AuthUser,
): Promise<ProductDto> {
  const product = await findProductById(prisma, id);
  if (!product) {
    throw AppError.notFound("Product not found");
  }

  const isAdmin = user?.role === "ADMIN";
  if (!isAdmin) {
    if (
      !isPublicProductVisible({
        productStatus: product.status,
        productIsAvailable: product.isAvailable,
        parentSubcategoryStatus: product.subcategory.status,
        parentCategoryStatus: product.subcategory.category.status,
      })
    ) {
      throw AppError.notFound("Product not found");
    }
  }

  return toProductDto(product);
}

export async function createProductService(
  prisma: Database,
  input: CreateProductBody,
): Promise<ProductDto> {
  const parent = await findParentSubcategory(prisma, input.subcategoryId);
  if (!parent) {
    throw AppError.notFound("Subcategory not found");
  }

  const status = input.status ?? "ACTIVE";
  assertActiveAllowedUnderParents(status, parent);

  let slug: string;
  try {
    slug = input.slug ?? slugifyFromName(input.name, PRODUCT_SLUG_MAX);
  } catch {
    throw AppError.badRequest("Unable to generate a valid slug from name");
  }

  try {
    const created = await createProduct(prisma, {
      name: input.name,
      slug,
      sku: input.sku,
      subcategoryId: input.subcategoryId,
      description: input.description,
      priceMinor: input.priceMinor,
      stockQty: input.stockQty,
      isAvailable: input.isAvailable,
      status,
    });
    return toProductDto(created);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw mapProductUniqueError(error);
    }
    throw error;
  }
}

export async function updateProductService(
  prisma: Database,
  id: number,
  input: UpdateProductBody,
): Promise<ProductDto> {
  const existing = await findProductById(prisma, id);
  if (!existing) {
    throw AppError.notFound("Product not found");
  }

  const nextSubcategoryId = input.subcategoryId ?? existing.subcategoryId;
  const nextStatus = input.status ?? existing.status;

  const parent = await findParentSubcategory(prisma, nextSubcategoryId);
  if (!parent) {
    throw AppError.notFound("Subcategory not found");
  }

  assertActiveAllowedUnderParents(nextStatus, parent);

  try {
    const updated = await updateProduct(prisma, id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.priceMinor !== undefined
        ? { priceMinor: input.priceMinor }
        : {}),
      ...(input.stockQty !== undefined ? { stockQty: input.stockQty } : {}),
      ...(input.isAvailable !== undefined
        ? { isAvailable: input.isAvailable }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.subcategoryId !== undefined
        ? { subcategory: { connect: { id: input.subcategoryId } } }
        : {}),
    });
    return toProductDto(updated);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw mapProductUniqueError(error);
    }
    throw error;
  }
}

/**
 * Soft-delete via archival. Idempotent. Does not delete images or order items.
 */
export async function archiveProductService(
  prisma: Database,
  id: number,
): Promise<ProductDto> {
  const existing = await findProductById(prisma, id);
  if (!existing) {
    throw AppError.notFound("Product not found");
  }

  if (existing.status === "ARCHIVED") {
    return toProductDto(existing);
  }

  const archived = await updateProduct(prisma, id, { status: "ARCHIVED" });
  return toProductDto(archived);
}

export async function addProductImageService(
  prisma: Database,
  productId: number,
  input: CreateProductImageBody,
): Promise<ProductDto> {
  const product = await findProductById(prisma, productId);
  if (!product) {
    throw AppError.notFound("Product not found");
  }

  const isPrimary = input.isPrimary ?? false;

  try {
    await prisma.$transaction(async (tx) => {
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const max = await getMaxImageSortOrder(tx, productId);
        sortOrder = max === null ? 0 : max + 1;
      }

      if (isPrimary) {
        await clearPrimaryImages(tx, productId);
      }

      await createProductImage(tx, {
        productId,
        url: input.url,
        altText: input.altText,
        sortOrder,
        isPrimary,
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw mapImageUniqueError(error);
    }
    throw error;
  }

  const refreshed = await findProductById(prisma, productId);
  if (!refreshed) {
    throw AppError.notFound("Product not found");
  }
  return toProductDto(refreshed);
}

export async function updateProductImageService(
  prisma: Database,
  productId: number,
  imageId: number,
  input: UpdateProductImageBody,
): Promise<ProductDto> {
  const product = await findProductById(prisma, productId);
  if (!product) {
    throw AppError.notFound("Product not found");
  }

  const image = await findProductImage(prisma, productId, imageId);
  if (!image) {
    throw AppError.notFound("Product image not found");
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (input.isPrimary === true) {
        await clearPrimaryImages(tx, productId, imageId);
      }

      await updateProductImageRecord(tx, imageId, {
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.altText !== undefined ? { altText: input.altText } : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
        ...(input.isPrimary !== undefined
          ? { isPrimary: input.isPrimary }
          : {}),
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw mapImageUniqueError(error);
    }
    throw error;
  }

  const refreshed = await findProductById(prisma, productId);
  if (!refreshed) {
    throw AppError.notFound("Product not found");
  }
  return toProductDto(refreshed);
}

export async function deleteProductImageService(
  prisma: Database,
  productId: number,
  imageId: number,
): Promise<ProductDto> {
  const product = await findProductById(prisma, productId);
  if (!product) {
    throw AppError.notFound("Product not found");
  }

  const image = await findProductImage(prisma, productId, imageId);
  if (!image) {
    throw AppError.notFound("Product image not found");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const wasPrimary = image.isPrimary;
      await deleteProductImageRecord(tx, imageId);

      if (wasPrimary) {
        const next = await findNextImageBySortOrder(tx, productId);
        if (next) {
          await updateProductImageRecord(tx, next.id, { isPrimary: true });
        }
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw mapImageUniqueError(error);
    }
    throw error;
  }

  const refreshed = await findProductById(prisma, productId);
  if (!refreshed) {
    throw AppError.notFound("Product not found");
  }
  return toProductDto(refreshed);
}
