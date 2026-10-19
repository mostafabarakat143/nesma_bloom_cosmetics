import type { CatalogStatus, Category, Prisma } from "../../generated/prisma/client.js";

import type { Database } from "../../config/database.js";
import type { ListCategoriesQuery } from "./category.schema.js";

export type CategoryListFilters = {
  status?: CatalogStatus | "ALL";
  search?: string;
  sortBy: ListCategoriesQuery["sortBy"];
  sortOrder: ListCategoriesQuery["sortOrder"];
  page: number;
  pageSize: number;
};

function buildWhere(
  filters: Pick<CategoryListFilters, "status" | "search">,
): Prisma.CategoryWhereInput {
  const where: Prisma.CategoryWhereInput = {};

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters.search) {
    where.name = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  return where;
}

/**
 * Secondary sort by id keeps pagination stable when primary values tie.
 */
function buildOrderBy(
  sortBy: CategoryListFilters["sortBy"],
  sortOrder: CategoryListFilters["sortOrder"],
): Prisma.CategoryOrderByWithRelationInput[] {
  return [{ [sortBy]: sortOrder }, { id: "asc" }];
}

export async function findCategoriesPage(
  prisma: Database,
  filters: CategoryListFilters,
): Promise<{ items: Category[]; totalItems: number }> {
  const where = buildWhere(filters);
  const orderBy = buildOrderBy(filters.sortBy, filters.sortOrder);
  const skip = (filters.page - 1) * filters.pageSize;

  const [totalItems, items] = await prisma.$transaction([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      orderBy,
      skip,
      take: filters.pageSize,
    }),
  ]);

  return { items, totalItems };
}

export async function findCategoryById(
  prisma: Database,
  id: number,
): Promise<Category | null> {
  return prisma.category.findUnique({ where: { id } });
}

export async function createCategory(
  prisma: Database,
  data: {
    name: string;
    slug: string;
    imageUrl: string;
    status?: CatalogStatus;
  },
): Promise<Category> {
  return prisma.category.create({
    data: {
      name: data.name,
      slug: data.slug,
      imageUrl: data.imageUrl,
      status: data.status ?? "ACTIVE",
    },
  });
}

export async function updateCategory(
  prisma: Database,
  id: number,
  data: Prisma.CategoryUpdateInput,
): Promise<Category> {
  return prisma.category.update({
    where: { id },
    data,
  });
}
