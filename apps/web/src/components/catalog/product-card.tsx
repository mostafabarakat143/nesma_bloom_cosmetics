import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { ProductImage } from "@/components/catalog/product-image";
import type { CatalogProduct } from "@/lib/api/catalog";
import { formatMinorPrice } from "@/lib/money";

export async function ProductCard({ product }: { product: CatalogProduct }) {
  const t = await getTranslations("shop");
  const imageAlt = product.image?.altText?.trim() || product.name;

  return (
    <article className="rounded-2xl border border-line bg-surface shadow-[0_8px_24px_rgb(52_42_46/6%)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-rose-deep">
      <Link href={`/products/${product.id}`} className="block rounded-2xl">
        <div className="relative aspect-[4/5] overflow-hidden rounded-t-2xl">
          <div className="absolute inset-0">
            <ProductImage url={product.image?.url ?? null} alt={imageAlt} />
          </div>
        </div>
        <div className="p-5">
          <p className="text-sm break-words text-muted">{product.category.name}</p>
          <h3 className="mt-1 font-display text-3xl leading-tight break-words text-ink">
            {product.name}
          </h3>
          <p className="mt-3 text-sm text-ink">
            {formatMinorPrice(product.priceMinor, product.currency)}
          </p>
          <p
            className={`mt-2 text-sm ${product.inStock ? "text-ink" : "text-rose-deep"}`}
          >
            {product.inStock ? t("inStock") : t("outOfStock")}
          </p>
        </div>
      </Link>
    </article>
  );
}
