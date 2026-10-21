import { getTranslations } from "next-intl/server";

import { AddToOrder } from "@/components/catalog/add-to-order";
import { isDisplayableImageUrl } from "@/components/catalog/image-text-tone";
import { ProductImage } from "@/components/catalog/product-image";
import { Link } from "@/i18n/navigation";
import type { CatalogProduct } from "@/lib/api/catalog";
import { getVerifiedUser } from "@/lib/auth/session";
import { formatMinorPrice } from "@/lib/money";

export async function ProductCard({ product }: { product: CatalogProduct }) {
  const t = await getTranslations("product");
  const session = await getVerifiedUser();
  const imageAlt = product.image?.altText?.trim() || product.name;
  const stockLabel = product.inStock ? t("stockAvailable") : t("stockUnavailable");
  const hasImage = Boolean(
    product.image?.url && isDisplayableImageUrl(product.image.url),
  );
  // No image → white fill; use dark label text so it stays readable.
  const onLight = !hasImage;
  const textClass = onLight ? "text-ink" : "text-white";
  const mutedClass = onLight ? "text-ink/80" : "text-white/90";
  const stripClass = onLight
    ? "border-t border-ink/10 bg-white/40"
    : "border-t border-white/10 bg-ink/10";
  const focusClass = onLight
    ? "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
    : "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <article className="relative aspect-[3/4] overflow-hidden rounded-3xl shadow-[0_12px_32px_rgb(52_42_46/12%)]">
      <Link
        href={`/products/${product.id}`}
        className="absolute inset-0 bg-white"
        aria-label={product.name}
      >
        <ProductImage url={product.image?.url ?? null} alt={imageAlt} />
      </Link>

      <div
        className={`absolute inset-x-0 bottom-0 px-2.5 py-2 backdrop-blur-[2px] ${stripClass} ${textClass}`}
      >
        <Link
          href={`/products/${product.id}`}
          className={`block ${focusClass}`}
        >
          <h3 className="truncate font-display text-lg leading-none">
            {product.name}
          </h3>
          <div className="mt-1.5 flex items-baseline gap-3 pe-4">
            <p className="min-w-0 flex-1 truncate text-xs font-medium leading-none tracking-wide">
              {formatMinorPrice(product.priceMinor, product.currency)}
            </p>
            <p
              className={`shrink-0 text-xs font-medium leading-none tracking-wide ${mutedClass}`}
            >
              {stockLabel}
            </p>
          </div>
        </Link>
        <AddToOrder
          productId={product.id}
          inStock={product.inStock}
          stockQty={product.stockQty}
          ownerId={session.state === "authenticated" ? session.user.id : null}
          accountUnavailable={session.state === "unavailable"}
          compact
          compactOnLight={onLight}
        />
      </div>
    </article>
  );
}
