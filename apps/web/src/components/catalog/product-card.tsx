import { getTranslations } from "next-intl/server";

import { AddToOrder } from "@/components/catalog/add-to-order";
import { ProductImage } from "@/components/catalog/product-image";
import { Link } from "@/i18n/navigation";
import type { CatalogProduct } from "@/lib/api/catalog";
import { getVerifiedUser } from "@/lib/auth/session";
import { formatMinorPrice } from "@/lib/money";

export async function ProductCard({ product }: { product: CatalogProduct }) {
  const t = await getTranslations("shop");
  const session = await getVerifiedUser();
  const imageAlt = product.image?.altText?.trim() || product.name;

  return (
    <article className="rounded-2xl border border-line bg-surface shadow-[0_8px_24px_rgb(52_42_46/6%)]">
      <Link href={`/products/${product.id}`} className="block rounded-2xl">
        <div className="relative aspect-[3/2] overflow-hidden rounded-t-2xl">
          <div className="absolute inset-0">
            <ProductImage url={product.image?.url ?? null} alt={imageAlt} />
          </div>
        </div>
        <div className="px-4 pt-4">
          <h3 className="font-display text-2xl leading-tight break-words text-ink">
            {product.name}
          </h3>
          <p className="mt-2 text-sm text-ink">
            {formatMinorPrice(product.priceMinor, product.currency)}
          </p>
          {product.inStock ? null : (
            <p className="mt-2 text-sm text-rose-deep">{t("outOfStock")}</p>
          )}
        </div>
      </Link>
      <div className="px-4 pb-4">
        <AddToOrder
          productId={product.id}
          inStock={product.inStock}
          stockQty={product.stockQty}
          ownerId={session.state === "authenticated" ? session.user.id : null}
          accountUnavailable={session.state === "unavailable"}
          compact
        />
      </div>
    </article>
  );
}
