import { ProductCard } from "@/components/catalog/product-card";
import { SectionHeading } from "@/components/home/section-heading";
import { Button } from "@/components/ui/button";
import type { CatalogProduct } from "@/lib/api/catalog";

export function NewArrivals({
  products,
}: {
  products: CatalogProduct[] | null;
}) {
  return (
    <section
      className="bg-surface"
      aria-labelledby="arrivals-heading"
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            id="arrivals-heading"
            eyebrow="Just added"
            title="New arrivals"
          />
          <Button href="/shop" variant="ghost">
            Shop now
          </Button>
        </div>
        {products === null ? (
          <p className="mt-8 text-lg text-muted">
            New arrivals are temporarily unavailable.
          </p>
        ) : products.length === 0 ? (
          <p className="mt-8 text-lg text-muted">
            New arrivals will appear here when products are published.
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
