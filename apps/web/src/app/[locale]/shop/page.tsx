import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { redirectTo } from "@/i18n/redirect";
import { Suspense } from "react";

import { EmptyState } from "@/components/catalog/empty-state";
import { Pagination } from "@/components/catalog/pagination";
import { ProductFilters } from "@/components/catalog/product-filters";
import { ProductGrid } from "@/components/catalog/product-grid";
import { PageContainer } from "@/components/layout/page-container";
import {
  listFilterCategories,
  listFilterSubcategories,
  listShopProducts,
} from "@/lib/api/catalog";
import { parseShopQuery, shopHref, type ShopQuery } from "@/lib/shop-query";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shop");
  return { title: t("title"), description: t("description") };
}

type ShopPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function withoutIncompatibleFilters(
  query: ShopQuery,
  categories: { id: number }[] | null,
  categoryPages: number | null,
  subcategories: { id: number; categoryId: number }[] | null,
  subcategoryPages: number | null,
): ShopQuery | null {
  if (
    categories &&
    categoryPages !== null &&
    categoryPages <= 1 &&
    query.categoryId !== null &&
    !categories.some((category) => category.id === query.categoryId)
  ) {
    return { ...query, categoryId: null, subcategoryId: null, page: 1 };
  }

  if (
    subcategories &&
    subcategoryPages !== null &&
    subcategoryPages <= 1 &&
    query.subcategoryId !== null &&
    !subcategories.some(
      (subcategory) =>
        subcategory.id === query.subcategoryId &&
        (query.categoryId === null ||
          subcategory.categoryId === query.categoryId),
    )
  ) {
    return { ...query, subcategoryId: null, page: 1 };
  }

  return null;
}

async function ShopLoadingState() {
  const t = await getTranslations("shop");
  return (
    <p className="text-muted" role="status">
      {t("loading")}
    </p>
  );
}

async function ShopProductResults({ query }: { query: ShopQuery }) {
  const products = await listShopProducts({
    q: query.q,
    categoryId: query.categoryId,
    subcategoryId: query.subcategoryId,
    minPriceMinor: query.minPriceMinor,
    maxPriceMinor: query.maxPriceMinor,
    sort: query.sort,
    page: query.page,
  });

  const hasFilters = Boolean(
    query.q ||
      query.categoryId !== null ||
      query.subcategoryId !== null ||
      query.minPriceMinor !== null ||
      query.maxPriceMinor !== null ||
      query.sort !== "newest",
  );

  const t = await getTranslations("shop");

  if (products === null) {
    return (
      <EmptyState
        title={t("unavailableTitle")}
        message={t("unavailableMessage")}
      />
    );
  }

  if (products.items.length === 0 && query.page > 1) {
    return (
      <EmptyState
        title={t("noPageTitle")}
        message={t("noPageMessage")}
        href={shopHref({ ...query, page: 1 })}
        action={t("backFirst")}
      />
    );
  }

  if (products.items.length === 0) {
    return (
      <EmptyState
        title={hasFilters ? t("noMatchTitle") : t("noProductsTitle")}
        message={hasFilters ? t("noMatchMessage") : t("noProductsMessage")}
        href={hasFilters ? "/shop" : undefined}
        action={hasFilters ? t("clearFilters") : undefined}
      />
    );
  }

  return (
    <>
      <p className="text-sm text-muted">
        {t("productCount", { count: products.meta.totalItems })}
      </p>
      <div className="mt-6">
        <ProductGrid products={products.items} />
      </div>
      <Pagination query={query} totalPages={products.meta.totalPages} />
    </>
  );
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const parsed = parseShopQuery(await searchParams);
  if (parsed.redirectTo) {
    await redirectTo(parsed.redirectTo);
  }

  const { query } = parsed;
  const [categoriesPage, subcategoriesPage] = await Promise.all([
    listFilterCategories(),
    listFilterSubcategories(query.categoryId),
  ]);
  const cleaned = withoutIncompatibleFilters(
    query,
    categoriesPage?.items ?? null,
    categoriesPage?.meta.totalPages ?? null,
    subcategoriesPage?.items ?? null,
    subcategoriesPage?.meta.totalPages ?? null,
  );
  if (cleaned) {
    await redirectTo(shopHref(cleaned));
  }

  const t = await getTranslations("shop");

  return (
    <PageContainer>
      <h1 className="font-display text-5xl text-ink">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{t("intro")}</p>
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <ProductFilters
          query={query}
          categories={categoriesPage?.items ?? null}
          subcategories={subcategoriesPage?.items ?? null}
        />
        <div className="min-w-0">
          {query.priceError ? (
            <EmptyState
              title={t("priceCorrectionTitle")}
              message={t("priceCorrectionMessage")}
            />
          ) : (
            <Suspense fallback={<ShopLoadingState />}>
              <ShopProductResults query={query} />
            </Suspense>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
