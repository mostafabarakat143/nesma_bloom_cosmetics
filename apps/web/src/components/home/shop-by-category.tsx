import { getTranslations } from "next-intl/server";

import { CategoryCard } from "@/components/catalog/category-card";
import { SectionHeading } from "@/components/home/section-heading";
import { Button } from "@/components/ui/button";
import type { CatalogCategory } from "@/lib/api/catalog";

export async function ShopByCategory({
  categories,
}: {
  categories: CatalogCategory[] | null;
}) {
  const t = await getTranslations("home");

  return (
    <section
      className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20"
      aria-labelledby="categories-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading id="categories-heading" title={t("shopByCategory")} />
        <Button href="/shop" variant="ghost">
          {t("shopNow")}
        </Button>
      </div>
      {categories === null ? (
        <p className="mt-8 text-lg text-muted">
          {t("categoriesUnavailable")}
        </p>
      ) : categories.length === 0 ? (
        <p className="mt-8 text-lg text-muted">
          {t("categoriesEmpty")}
        </p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li key={category.id} className="min-w-0">
              <CategoryCard
                category={category}
                href={`/shop?categoryId=${category.id}`}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
