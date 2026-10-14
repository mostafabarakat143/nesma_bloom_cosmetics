import type {
  CatalogStatus,
  Category,
  Prisma,
} from "../../generated/prisma/client.js";

import type { Database } from "../../config/database.js";
import type { ListSubcategoriesQuery } from "./subcategory.schema.js";
import type { SubcategoryWithCategory } from "./subcategory.mapper.js";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
} as const;

export type SubcategoryListFilters = {
  status: CatalogStatus | "ALL";
  /** When true, require parent Category.status = ACTIVE (public storefront). */
  requireActiveParent: boolean;
  categoryId?: string;
  search?: string;
  sortBy: ListSubcategoriesQuery["sortBy"];
  sortOrder: ListSubcategoriesQuery["sortOrder"];
  page: number;
  pageSize: number;
};

function buildWhere(
  filters: Pick<
    SubcategoryListFilters,
    "status" | "requireActiveParent" | "categoryId" | "search"
  >,
): Prisma.SubcategoryWhereInput {
  const where: Prisma.SubcategoryWhereInput = {};

  if (filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.search) {
    where.name = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  if (filters.requireActiveParent) {
    where.category = { status: "ACTIVE" };
  }

  return where;
}

function buildOrderBy(
  sortBy: SubcategoryListFilters["sortBy"],
  sortOrder: SubcategoryListFilters["sortOrder"],
): Prisma.SubcategoryOrderByWithRelationInput[] {
  return [{ [sortBy]: sortOrder }, { id: "asc" }];
}

export async function findSubcategoriesPage(
  prisma: Database,
  filters: SubcategoryListFilters,
): Promise<{ items: SubcategoryWithCategory[]; totalItems: number }> {
  const where = buildWhere(filters);
  const orderBy = buildOrderBy(filters.sortBy, filters.sortOrder);
  const skip = (filters.page - 1) * filters.pageSize;

  const [totalItems, items] = await prisma.$transaction([
    prisma.subcategory.count({ where }),
    prisma.subcategory.findMany({
      where,
      orderBy,
      skip,
      take: filters.pageSize,
      include: { category: { select: categorySelect } },
    }),
  ]);

  return { items, totalItems };
}

export async function findSubcategoryById(
  prisma: Database,
  id: string,
): Promise<SubcategoryWithCategory | null> {
  return prisma.subcategory.findUnique({
    where: { id },
    include: { category: { select: categorySelect } },
  });
}

export async function findParentCategory(
  prisma: Database,
  categoryId: string,
): Promise<Pick<Category, "id" | "name" | "slug" | "status"> | null> {
  return prisma.category.findUnique({
    where: { id: categoryId },
    select: categorySelect,
  });
}

export async function createSubcategory(
  prisma: Database,
  data: {
    name: string;
    slug: string;
    categoryId: string;
    description?: string | null;
    status?: CatalogStatus;
  },
): Promise<SubcategoryWithCategory> {
  return prisma.subcategory.create({
    data: {
      name: data.name,
      slug: data.slug,
      categoryId: data.categoryId,
      description: data.description ?? null,
      status: data.status ?? "ACTIVE",
    },
    include: { category: { select: categorySelect } },
  });
}

export async function updateSubcategory(
  prisma: Database,
  id: string,
  data: Prisma.SubcategoryUpdateInput,
): Promise<SubcategoryWithCategory> {
  return prisma.subcategory.update({
    where: { id },
    data,
    include: { category: { select: categorySelect } },
  });
}
