import type { Request } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { slugifyFromName } from "../../common/utils/slug.js";
import type { Database } from "../../config/database.js";
import { toCategoryDto, type CategoryDto } from "./category.mapper.js";

type AuthUser = NonNullable<Request["user"]>;
import {
  createCategory,
  findCategoriesPage,
  findCategoryById,
  updateCategory,
} from "./category.repository.js";
import type {
  CreateCategoryBody,
  ListCategoriesQuery,
  UpdateCategoryBody,
} from "./category.schema.js";

export type PaginatedCategories = {
  items: CategoryDto[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function assertCanFilterStatus(
  status: ListCategoriesQuery["status"],
  user?: AuthUser,
): void {
  if (status === "ACTIVE") {
    return;
  }

  if (!user) {
    throw AppError.forbidden("Insufficient permissions");
  }

  if (user.role !== "ADMIN") {
    throw AppError.forbidden("Insufficient permissions");
  }
}

export async function listCategories(
  prisma: Database,
  query: ListCategoriesQuery,
  user?: AuthUser,
): Promise<PaginatedCategories> {
  assertCanFilterStatus(query.status, user);

  const { items, totalItems } = await findCategoriesPage(prisma, {
    status: query.status,
    search: query.search,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    page: query.page,
    pageSize: query.pageSize,
  });

  const totalPages =
    totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

  return {
    items: items.map(toCategoryDto),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function getCategoryById(
  prisma: Database,
  id: string,
  user?: AuthUser,
): Promise<CategoryDto> {
  const category = await findCategoryById(prisma, id);
  if (!category) {
    throw AppError.notFound("Category not found");
  }

  if (category.status === "ARCHIVED") {
    if (user?.role === "ADMIN") {
      return toCategoryDto(category);
    }
    throw AppError.notFound("Category not found");
  }

  return toCategoryDto(category);
}

export async function createCategoryService(
  prisma: Database,
  input: CreateCategoryBody,
): Promise<CategoryDto> {
  let slug: string;
  try {
    slug = input.slug ?? slugifyFromName(input.name);
  } catch {
    throw AppError.badRequest("Unable to generate a valid slug from name");
  }

  try {
    const category = await createCategory(prisma, {
      name: input.name,
      slug,
      description: input.description,
      status: input.status,
    });
    return toCategoryDto(category);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict("Category slug already exists");
    }
    throw error;
  }
}

export async function updateCategoryService(
  prisma: Database,
  id: string,
  input: UpdateCategoryBody,
): Promise<CategoryDto> {
  const existing = await findCategoryById(prisma, id);
  if (!existing) {
    throw AppError.notFound("Category not found");
  }

  // Name updates do not auto-change slug; slug changes only when explicitly sent.
  try {
    const category = await updateCategory(prisma, id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    return toCategoryDto(category);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict("Category slug already exists");
    }
    throw error;
  }
}

/**
 * Soft-delete via archival. Idempotent: already-ARCHIVED returns 200 with DTO.
 * Does not cascade-archive children; public catalog must filter by parent status later.
 */
export async function archiveCategoryService(
  prisma: Database,
  id: string,
): Promise<CategoryDto> {
  const existing = await findCategoryById(prisma, id);
  if (!existing) {
    throw AppError.notFound("Category not found");
  }

  if (existing.status === "ARCHIVED") {
    return toCategoryDto(existing);
  }

  const category = await updateCategory(prisma, id, { status: "ARCHIVED" });
  return toCategoryDto(category);
}
