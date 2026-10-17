import type {
  Category,
  Product,
  ProductImage,
  Subcategory,
} from "../../generated/prisma/client.js";

export type ProductCategorySummary = {
  id: number;
  name: string;
  slug: string;
  status: Category["status"];
};

export type ProductSubcategorySummary = {
  id: number;
  name: string;
  slug: string;
  status: Subcategory["status"];
};

export type ProductImageDto = {
  id: number;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductDto = {
  id: number;
  subcategoryId: number;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  stockQty: number;
  isAvailable: boolean;
  /** Derived from stockQty only; not a purchasability guarantee. */
  inStock: boolean;
  status: Product["status"];
  createdAt: string;
  updatedAt: string;
  subcategory: ProductSubcategorySummary;
  category: ProductCategorySummary;
  images: ProductImageDto[];
};

export type ProductWithRelations = Product & {
  subcategory: Pick<Subcategory, "id" | "name" | "slug" | "status"> & {
    category: Pick<Category, "id" | "name" | "slug" | "status">;
  };
  images: ProductImage[];
};

export function toProductImageDto(image: ProductImage): ProductImageDto {
  return {
    id: image.id,
    url: image.url,
    altText: image.altText,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  };
}

export function toProductDto(product: ProductWithRelations): ProductDto {
  return {
    id: product.id,
    subcategoryId: product.subcategoryId,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    priceMinor: product.priceMinor,
    currency: product.currency,
    stockQty: product.stockQty,
    isAvailable: product.isAvailable,
    inStock: product.stockQty > 0,
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    subcategory: {
      id: product.subcategory.id,
      name: product.subcategory.name,
      slug: product.subcategory.slug,
      status: product.subcategory.status,
    },
    category: {
      id: product.subcategory.category.id,
      name: product.subcategory.category.name,
      slug: product.subcategory.category.slug,
      status: product.subcategory.category.status,
    },
    images: product.images.map(toProductImageDto),
  };
}
