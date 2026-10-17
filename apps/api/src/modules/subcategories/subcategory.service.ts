import type { Request } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { slugifyFromName } from "../../common/utils/slug.js";
import type { Database } from "../../config/database.js";
import { isPublicSubcategoryVisible } from "../categories/catalog-visibility.js";
import {
  toSubcategoryDto,
  type SubcategoryDto,
} from "./subcategory.mapper.js";
import {
  createSubcategory,
  findParentCategory,
  findSubcategoriesPage,
  findSubcategoryById,
  updateSubcategory,
} from "./subcategory.repository.js";
import type {
  CreateSubcategoryBody,
  ListSubcategoriesQuery,
  UpdateSubcategoryBody,
} from "./subcategory.schema.js";

type AuthUser = NonNullable<Request["user"]>;

export type PaginatedSubcategories = {
  items: SubcategoryDto[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

const ARCHIVED_PARENT_CONFLICT =
  "Cannot place an ACTIVE subcategory under an archived category";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function assertCanFilterStatus(
  status: ListSubcategoriesQuery["status"],
  user?: AuthUser,
): void {
  if (status === "ACTIVE") {
    return;
  }

  if (!user || user.role !== "ADMIN") {
    throw AppError.forbidden("Insufficient permissions");
  }
}

function assertActiveAllowedUnderParent(
  subcategoryStatus: "ACTIVE" | "ARCHIVED",
  parentStatus: "ACTIVE" | "ARCHIVED",
): void {
  if (subcategoryStatus === "ACTIVE" && parentStatus === "ARCHIVED") {
    throw AppError.conflict(ARCHIVED_PARENT_CONFLICT);
  }
}

export async function listSubcategories(
  prisma: Database,
  query: ListSubcategoriesQuery,
  user?: AuthUser,
): Promise<PaginatedSubcategories> {
  assertCanFilterStatus(query.status, user);

  // ACTIVE listings (public default and admin storefront view): enforce parent ACTIVE in SQL
  // for both findMany and count. ADMIN ARCHIVED/ALL may include archived parents.
  const requireActiveParent = query.status === "ACTIVE";

  const { items, totalItems } = await findSubcategoriesPage(prisma, {
    status: query.status,
    requireActiveParent,
    categoryId: query.categoryId,
    search: query.search,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    page: query.page,
    pageSize: query.pageSize,
  });

  const totalPages =
    totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

  return {
    items: items.map(toSubcategoryDto),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function getSubcategoryById(
  prisma: Database,
  id: number,
  user?: AuthUser,
): Promise<SubcategoryDto> {
  const subcategory = await findSubcategoryById(prisma, id);
  if (!subcategory) {
    throw AppError.notFound("Subcategory not found");
  }

  const isAdmin = user?.role === "ADMIN";
  if (!isAdmin) {
    if (
      !isPublicSubcategoryVisible({
        subcategoryStatus: subcategory.status,
        parentCategoryStatus: subcategory.category.status,
      })
    ) {
      throw AppError.notFound("Subcategory not found");
    }
  }

  return toSubcategoryDto(subcategory);
}

export async function createSubcategoryService(
  prisma: Database,
  input: CreateSubcategoryBody,
): Promise<SubcategoryDto> {
  const parent = await findParentCategory(prisma, input.categoryId);
  if (!parent) {
    throw AppError.notFound("Category not found");
  }

  const status = input.status ?? "ACTIVE";
  assertActiveAllowedUnderParent(status, parent.status);

  let slug: string;
  try {
    slug = input.slug ?? slugifyFromName(input.name);
  } catch {
    throw AppError.badRequest("Unable to generate a valid slug from name");
  }

  try {
    const created = await createSubcategory(prisma, {
      name: input.name,
      slug,
      categoryId: input.categoryId,
      description: input.description,
      status,
    });
    return toSubcategoryDto(created);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict(
        "Subcategory slug already exists in this category",
      );
    }
    throw error;
  }
}

export async function updateSubcategoryService(
  prisma: Database,
  id: number,
  input: UpdateSubcategoryBody,
): Promise<SubcategoryDto> {
  const existing = await findSubcategoryById(prisma, id);
  if (!existing) {
    throw AppError.notFound("Subcategory not found");
  }

  const nextCategoryId = input.categoryId ?? existing.categoryId;
  const nextStatus = input.status ?? existing.status;

  const parent = await findParentCategory(prisma, nextCategoryId);
  if (!parent) {
    throw AppError.notFound("Category not found");
  }

  assertActiveAllowedUnderParent(nextStatus, parent.status);

  // Name updates do not auto-change slug; slug changes only when explicitly sent.
  try {
    const updated = await updateSubcategory(prisma, id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.categoryId !== undefined
        ? { category: { connect: { id: input.categoryId } } }
        : {}),
    });
    return toSubcategoryDto(updated);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict(
        "Subcategory slug already exists in this category",
      );
    }
    throw error;
  }
}

/**
 * Soft-delete via archival. Idempotent. Does not hard-delete products.
 */
export async function archiveSubcategoryService(
  prisma: Database,
  id: number,
): Promise<SubcategoryDto> {
  const existing = await findSubcategoryById(prisma, id);
  if (!existing) {
    throw AppError.notFound("Subcategory not found");
  }

  if (existing.status === "ARCHIVED") {
    return toSubcategoryDto(existing);
  }

  const archived = await updateSubcategory(prisma, id, {
    status: "ARCHIVED",
  });
  return toSubcategoryDto(archived);
}
