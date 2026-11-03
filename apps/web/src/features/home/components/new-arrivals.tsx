import { Button } from "@/components/ui/button";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { CatalogProduct } from "@/features/catalog/types";
import { SectionHeading } from "@/features/home/components/section-heading";
import { getTranslations } from "next-intl/server";
export async function NewArrivals({
  products,
}: {
  products: CatalogProduct[] | null;
}) {
  const t = await getTranslations("home");

  return (
    <section
      className="bg-surface"
      aria-labelledby="arrivals-heading"
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            id="arrivals-heading"
            eyebrow={t("justAdded")}
            title={t("newArrivals")}
          />
          <Button href="/shop" variant="ghost">
            {t("shopNow")}
          </Button>
        </div>
        {products === null ? (
          <p className="mt-8 text-lg text-muted">
            {t("arrivalsUnavailable")}
          </p>
        ) : products.length === 0 ? (
          <p className="mt-8 text-lg text-muted">
            {t("arrivalsEmpty")}
          </p>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <li key={product.id} className="min-w-0">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
