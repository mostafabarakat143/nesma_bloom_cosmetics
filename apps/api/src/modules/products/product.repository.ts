import type {
  CatalogStatus,
  Prisma,
  ProductImage,
} from "../../generated/prisma/client.js";

import type { Database } from "../../config/database.js";
import type { ProductWithRelations } from "./product.mapper.js";
import type { ListProductsQuery } from "./product.schema.js";

const subcategoryInclude = {
  subcategory: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
      },
    },
  },
  images: {
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.ProductInclude;

export type ParentSubcategory = {
  id: string;
  status: CatalogStatus;
  category: {
    id: string;
    status: CatalogStatus;
  };
};

export type ProductListFilters = {
  status: CatalogStatus | "ALL";
  /** When true, require ACTIVE subcategory and ACTIVE category. */
  requireActiveParents: boolean;
  availability: ListProductsQuery["availability"];
  categoryId?: string;
  subcategoryId?: string;
  search?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  sortBy: ListProductsQuery["sortBy"];
  sortOrder: ListProductsQuery["sortOrder"];
  page: number;
  pageSize: number;
};

function buildWhere(
  filters: Omit<ProductListFilters, "sortBy" | "sortOrder" | "page" | "pageSize">,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters.availability === "AVAILABLE") {
    where.isAvailable = true;
  } else if (filters.availability === "UNAVAILABLE") {
    where.isAvailable = false;
  }

  if (filters.subcategoryId) {
    where.subcategoryId = filters.subcategoryId;
  }

  if (filters.search) {
    where.name = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  if (
    filters.minPriceMinor !== undefined ||
    filters.maxPriceMinor !== undefined
  ) {
    where.priceMinor = {
      ...(filters.minPriceMinor !== undefined
        ? { gte: filters.minPriceMinor }
        : {}),
      ...(filters.maxPriceMinor !== undefined
        ? { lte: filters.maxPriceMinor }
        : {}),
    };
  }

  if (filters.requireActiveParents || filters.categoryId) {
    const categoryWhere: Prisma.CategoryWhereInput = {};
    if (filters.requireActiveParents) {
      categoryWhere.status = "ACTIVE";
    }
    if (filters.categoryId) {
      categoryWhere.id = filters.categoryId;
    }

    where.subcategory = {
      ...(filters.requireActiveParents ? { status: "ACTIVE" as const } : {}),
      category: categoryWhere,
    };
  }

  return where;
}

function buildOrderBy(
  sortBy: ProductListFilters["sortBy"],
  sortOrder: ProductListFilters["sortOrder"],
): Prisma.ProductOrderByWithRelationInput[] {
  return [{ [sortBy]: sortOrder }, { id: "asc" }];
}

export async function findProductsPage(
  prisma: Database,
  filters: ProductListFilters,
): Promise<{ items: ProductWithRelations[]; totalItems: number }> {
  const where = buildWhere(filters);
  const orderBy = buildOrderBy(filters.sortBy, filters.sortOrder);
  const skip = (filters.page - 1) * filters.pageSize;

  const [totalItems, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: filters.pageSize,
      include: subcategoryInclude,
    }),
  ]);

  return { items, totalItems };
}

export async function findProductById(
  prisma: Database,
  id: string,
): Promise<ProductWithRelations | null> {
  return prisma.product.findUnique({
    where: { id },
    include: subcategoryInclude,
  });
}

export async function findParentSubcategory(
  prisma: Database,
  subcategoryId: string,
): Promise<ParentSubcategory | null> {
  return prisma.subcategory.findUnique({
    where: { id: subcategoryId },
    select: {
      id: true,
      status: true,
      category: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });
}

export async function createProduct(
  prisma: Database,
  data: {
    name: string;
    slug: string;
    sku: string;
    subcategoryId: string;
    description?: string | null;
    priceMinor: number;
    stockQty: number;
    isAvailable?: boolean;
    status?: CatalogStatus;
  },
): Promise<ProductWithRelations> {
  return prisma.product.create({
    data: {
      name: data.name,
      slug: data.slug,
      sku: data.sku,
      subcategoryId: data.subcategoryId,
      description: data.description ?? null,
      priceMinor: data.priceMinor,
      currency: "EGP",
      stockQty: data.stockQty,
      isAvailable: data.isAvailable ?? true,
      status: data.status ?? "ACTIVE",
    },
    include: subcategoryInclude,
  });
}

export async function updateProduct(
  prisma: Database,
  id: string,
  data: Prisma.ProductUpdateInput,
): Promise<ProductWithRelations> {
  return prisma.product.update({
    where: { id },
    data,
    include: subcategoryInclude,
  });
}

export async function findProductImage(
  prisma: Database,
  productId: string,
  imageId: string,
): Promise<ProductImage | null> {
  return prisma.productImage.findFirst({
    where: { id: imageId, productId },
  });
}

export async function getMaxImageSortOrder(
  prisma: Database | Prisma.TransactionClient,
  productId: string,
): Promise<number | null> {
  const result = await prisma.productImage.aggregate({
    where: { productId },
    _max: { sortOrder: true },
  });
  return result._max.sortOrder;
}

export async function createProductImage(
  prisma: Database | Prisma.TransactionClient,
  data: {
    productId: string;
    url: string;
    altText?: string | null;
    sortOrder: number;
    isPrimary: boolean;
  },
): Promise<ProductImage> {
  return prisma.productImage.create({
    data: {
      productId: data.productId,
      url: data.url,
      altText: data.altText ?? null,
      sortOrder: data.sortOrder,
      isPrimary: data.isPrimary,
    },
  });
}

export async function updateProductImageRecord(
  prisma: Database | Prisma.TransactionClient,
  imageId: string,
  data: Prisma.ProductImageUpdateInput,
): Promise<ProductImage> {
  return prisma.productImage.update({
    where: { id: imageId },
    data,
  });
}

export async function clearPrimaryImages(
  prisma: Database | Prisma.TransactionClient,
  productId: string,
  exceptImageId?: string,
): Promise<void> {
  await prisma.productImage.updateMany({
    where: {
      productId,
      isPrimary: true,
      ...(exceptImageId ? { id: { not: exceptImageId } } : {}),
    },
    data: { isPrimary: false },
  });
}

export async function deleteProductImageRecord(
  prisma: Database | Prisma.TransactionClient,
  imageId: string,
): Promise<void> {
  await prisma.productImage.delete({ where: { id: imageId } });
}

export async function findNextImageBySortOrder(
  prisma: Database | Prisma.TransactionClient,
  productId: string,
): Promise<ProductImage | null> {
  return prisma.productImage.findFirst({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}
