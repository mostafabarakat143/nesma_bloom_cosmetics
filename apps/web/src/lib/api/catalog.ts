import { cache } from "react";

import { getApiUrl } from "@/lib/env";
import { SHOP_PAGE_SIZE, type ShopSort } from "@/lib/shop-query";

export type CatalogCategory = {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
};

export type CatalogSubcategory = {
  id: number;
  categoryId: number;
  name: string;
};

export type CatalogImage = {
  id: number;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type CatalogProduct = {
  id: number;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  inStock: boolean;
  /** Public stock hint. Express remains the authority when an order is placed. */
  stockQty: number | null;
  category: { id: number; name: string };
  subcategory: { id: number; name: string };
  images: CatalogImage[];
  image: CatalogImage | null;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type CatalogPage<T> = {
  items: T[];
  meta: PageMeta;
};

export type ProductLookup =
  | { status: "ok"; product: CatalogProduct }
  | { status: "not_found" }
  | { status: "unavailable" };

const PRODUCT_SORT: Record<
  ShopSort,
  { sortBy: "name" | "priceMinor" | "createdAt"; sortOrder: "asc" | "desc" }
> = {
  newest: { sortBy: "createdAt", sortOrder: "desc" },
  oldest: { sortBy: "createdAt", sortOrder: "asc" },
  "name-asc": { sortBy: "name", sortOrder: "asc" },
  "name-desc": { sortBy: "name", sortOrder: "desc" },
  "price-asc": { sortBy: "priceMinor", sortOrder: "asc" },
  "price-desc": { sortBy: "priceMinor", sortOrder: "desc" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function parseCategory(value: unknown): CatalogCategory | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "number" || !Number.isInteger(value.id) || value.id < 1) {
    return null;
  }
  if (typeof value.name !== "string" || value.name.trim() === "") {
    return null;
  }
  if (typeof value.slug !== "string" || value.slug.trim() === "") {
    return null;
  }

  const imageUrl =
    typeof value.imageUrl === "string" && isHttpUrl(value.imageUrl)
      ? value.imageUrl
      : null;

  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    imageUrl,
  };
}

function parseSubcategory(value: unknown): CatalogSubcategory | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "number" || !Number.isInteger(value.id) || value.id < 1) {
    return null;
  }
  if (
    typeof value.categoryId !== "number" ||
    !Number.isInteger(value.categoryId) ||
    value.categoryId < 1
  ) {
    return null;
  }
  if (typeof value.name !== "string" || value.name.trim() === "") {
    return null;
  }

  return {
    id: value.id,
    categoryId: value.categoryId,
    name: value.name,
  };
}

function parseImage(value: unknown): CatalogImage | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "number" || !Number.isInteger(value.id)) {
    return null;
  }
  if (typeof value.url !== "string" || !isHttpUrl(value.url)) {
    return null;
  }

  return {
    id: value.id,
    url: value.url,
    altText: typeof value.altText === "string" ? value.altText : null,
    isPrimary: value.isPrimary === true,
    sortOrder: typeof value.sortOrder === "number" ? value.sortOrder : 0,
  };
}

function parseNameRef(value: unknown): { id: number; name: string } | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "number" || !Number.isInteger(value.id) || value.id < 1) {
    return null;
  }
  if (typeof value.name !== "string" || value.name.trim() === "") {
    return null;
  }
  return { id: value.id, name: value.name };
}

function parseProduct(value: unknown): CatalogProduct | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "number" || !Number.isInteger(value.id) || value.id < 1) {
    return null;
  }
  if (typeof value.name !== "string" || value.name.trim() === "") {
    return null;
  }
  if (
    typeof value.priceMinor !== "number" ||
    !Number.isInteger(value.priceMinor) ||
    value.priceMinor < 0
  ) {
    return null;
  }
  if (typeof value.currency !== "string" || value.currency.trim() === "") {
    return null;
  }
  if (typeof value.inStock !== "boolean") {
    return null;
  }

  let stockQty: number | null = null;
  if ("stockQty" in value && value.stockQty !== undefined) {
    if (
      typeof value.stockQty !== "number" ||
      !Number.isInteger(value.stockQty) ||
      value.stockQty < 0 ||
      value.stockQty > 2_147_483_647
    ) {
      return null;
    }
    stockQty = value.stockQty;
  }

  const category = parseNameRef(value.category);
  const subcategory = parseNameRef(value.subcategory);
  if (!category || !subcategory) {
    return null;
  }

  const images = Array.isArray(value.images)
    ? value.images
        .map(parseImage)
        .filter((image): image is CatalogImage => image !== null)
        .sort((left, right) => {
          if (left.isPrimary !== right.isPrimary) {
            return left.isPrimary ? -1 : 1;
          }
          return left.sortOrder - right.sortOrder;
        })
    : [];

  const description =
    typeof value.description === "string" && value.description.trim() !== ""
      ? value.description
      : null;

  return {
    id: value.id,
    name: value.name,
    description,
    priceMinor: value.priceMinor,
    currency: value.currency,
    inStock: value.inStock,
    stockQty,
    category,
    subcategory,
    images,
    image: images[0] ?? null,
  };
}

function parseMeta(value: unknown): PageMeta | null {
  if (!isRecord(value)) {
    return null;
  }
  const { page, pageSize, totalItems, totalPages } = value;
  if (
    typeof page !== "number" ||
    !Number.isInteger(page) ||
    page < 1 ||
    typeof pageSize !== "number" ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    typeof totalItems !== "number" ||
    !Number.isInteger(totalItems) ||
    totalItems < 0 ||
    typeof totalPages !== "number" ||
    !Number.isInteger(totalPages) ||
    totalPages < 0
  ) {
    return null;
  }

  return { page, pageSize, totalItems, totalPages };
}

async function getPage<T>(
  path: string,
  parseItem: (value: unknown) => T | null,
): Promise<CatalogPage<T> | null> {
  try {
    const response = await fetch(`${getApiUrl()}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return null;
    }

    const body: unknown = await response.json();
    if (
      !isRecord(body) ||
      body.status !== "success" ||
      !isRecord(body.data) ||
      !Array.isArray(body.data.items)
    ) {
      return null;
    }

    const meta = parseMeta(body.data.meta);
    if (!meta) {
      return null;
    }

    return {
      items: body.data.items
        .map(parseItem)
        .filter((item): item is T => item !== null),
      meta,
    };
  } catch {
    return null;
  }
}

export async function getCategories(): Promise<CatalogCategory[] | null> {
  const page = await getPage(
    "/api/v1/categories?page=1&pageSize=12&sortBy=name&sortOrder=asc&status=ACTIVE",
    parseCategory,
  );
  return page ? page.items : null;
}

export async function getNewArrivals(): Promise<CatalogProduct[] | null> {
  const page = await getPage(
    "/api/v1/products?page=1&pageSize=8&sortBy=createdAt&sortOrder=desc&status=ACTIVE&availability=AVAILABLE",
    parseProduct,
  );
  return page ? page.items : null;
}

export function listFilterCategories(): Promise<CatalogPage<CatalogCategory> | null> {
  return getPage(
    "/api/v1/categories?page=1&pageSize=100&sortBy=name&sortOrder=asc&status=ACTIVE",
    parseCategory,
  );
}

export function listFilterSubcategories(
  categoryId: number | null,
): Promise<CatalogPage<CatalogSubcategory> | null> {
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
    sortBy: "name",
    sortOrder: "asc",
    status: "ACTIVE",
  });
  if (categoryId !== null) {
    params.set("categoryId", String(categoryId));
  }
  return getPage(`/api/v1/subcategories?${params.toString()}`, parseSubcategory);
}

export type ShopProductQuery = {
  q: string;
  categoryId: number | null;
  subcategoryId: number | null;
  minPriceMinor: number | null;
  maxPriceMinor: number | null;
  sort: ShopSort;
  page: number;
};

/** Public catalog page. Status and availability stay on the guest-safe values. */
export function listShopProducts(
  query: ShopProductQuery,
): Promise<CatalogPage<CatalogProduct> | null> {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(SHOP_PAGE_SIZE));
  params.set("status", "ACTIVE");
  params.set("availability", "AVAILABLE");
  const sort = PRODUCT_SORT[query.sort];
  params.set("sortBy", sort.sortBy);
  params.set("sortOrder", sort.sortOrder);
  if (query.q) {
    params.set("search", query.q);
  }
  if (query.categoryId !== null) {
    params.set("categoryId", String(query.categoryId));
  }
  if (query.subcategoryId !== null) {
    params.set("subcategoryId", String(query.subcategoryId));
  }
  if (query.minPriceMinor !== null) {
    params.set("minPriceMinor", String(query.minPriceMinor));
  }
  if (query.maxPriceMinor !== null) {
    params.set("maxPriceMinor", String(query.maxPriceMinor));
  }
  return getPage(`/api/v1/products?${params.toString()}`, parseProduct);
}

async function fetchCatalogProduct(id: number): Promise<ProductLookup> {
  try {
    const response = await fetch(`${getApiUrl()}/api/v1/products/${id}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 404) {
      return { status: "not_found" };
    }
    if (!response.ok) {
      return { status: "unavailable" };
    }

    const body: unknown = await response.json();
    if (
      !isRecord(body) ||
      body.status !== "success" ||
      !isRecord(body.data)
    ) {
      return { status: "unavailable" };
    }

    const product = parseProduct(body.data.product);
    if (!product) {
      return { status: "unavailable" };
    }
    return { status: "ok", product };
  } catch {
    return { status: "unavailable" };
  }
}

/** One product fetch shared by metadata and the product page. */
export const getCatalogProduct = cache(fetchCatalogProduct);
