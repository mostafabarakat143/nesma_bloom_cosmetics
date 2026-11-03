import type { ShopSort } from "./lib/shop-query";

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
  stockQty: number | null;
  category: { id: number; name: string; };
  subcategory: { id: number; name: string; };
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
  | { status: "ok"; product: CatalogProduct; }
  | { status: "not_found"; }
  | { status: "unavailable"; };

export type ShopProductQuery = {
  q: string;
  categoryId: number | null;
  subcategoryId: number | null;
  minPriceMinor: number | null;
  maxPriceMinor: number | null;
  sort: ShopSort;
  page: number;
};

export type ReadyProduct = {
  id: number;
  name: string;
  priceMinor: number;
  currency: string;
  inStock: boolean;
  stockQty: number | null;
  imageUrl: string | null;
  imageAlt: string;
};

export type ProductState =
  | { state: "loading"; }
  | { state: "missing"; }
  | { state: "unavailable"; }
  | { state: "ready"; product: ReadyProduct; };
