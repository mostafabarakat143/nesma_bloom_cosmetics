import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { getVerifiedUser } from "@/features/auth/services/session.server";
import { AddToOrder } from "@/features/catalog/components/add-to-order";
import { ProductGallery } from "@/features/catalog/components/product-gallery";
import { parsePositiveId } from "@/features/catalog/lib/shop-query";
import { getCatalogProduct } from "@/features/catalog/services/catalog.server";
import { formatMinorPrice } from "@/lib/money";

type ProductPageProps = {
  params: Promise<{ id: string; }>;
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const t = await getTranslations("product");
  const { id } = await params;
  const productId = parsePositiveId(id);
  if (productId === null || productId === "invalid") {
    return { title: t("notFoundTitle") };
  }

  const result = await getCatalogProduct(productId);
  if (result.status === "unavailable") {
    return { title: t("unavailableTitle") };
  }
  if (result.status !== "ok") {
    return { title: t("notFoundTitle") };
  }

  const description = result.product.description?.trim();
  return {
    title: result.product.name,
    description: description ? description.slice(0, 160) : undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const productId = parsePositiveId(id);
  if (productId === null || productId === "invalid") {
    notFound();
  }

  const result = await getCatalogProduct(productId);
  if (result.status === "not_found") {
    notFound();
  }

  const t = await getTranslations("product");
  const stock = await getTranslations("shop");

  if (result.status === "unavailable") {
    return (
      <PageContainer>
        <h1 className="font-display text-5xl text-ink">{t("unavailableTitle")}</h1>
        <p className="mt-4 max-w-xl text-lg text-muted">{t("unavailableBody")}</p>
        <div className="mt-8">
          <Button href="/shop" variant="secondary">
            {t("backToShop")}
          </Button>
        </div>
      </PageContainer>
    );
  }

  const { product } = result;
  const session = await getVerifiedUser();
  const ownerId = session.state === "authenticated" ? session.user.id : null;

  return (
    <PageContainer>
      <div className="grid items-start gap-10 lg:grid-cols-2">
        <ProductGallery
          key={product.id}
          images={product.images}
          name={product.name}
        />
        <div className="min-w-0">
          <p className="text-sm wrap-break-word text-muted">
            {product.category.name}
            <span aria-hidden="true"> / </span>
            {product.subcategory.name}
          </p>
          <h1 className="mt-2 font-display text-5xl leading-tight wrap-break-word text-ink">
            {product.name}
          </h1>
          {product.description ? (
            <p className="mt-6 leading-relaxed wrap-break-word whitespace-pre-line text-muted">
              {product.description}
            </p>
          ) : null}
          <p className="mt-6 text-lg text-ink">
            {formatMinorPrice(product.priceMinor, product.currency)}
          </p>
          {product.inStock ? null : (
            <p className="mt-2 text-sm text-rose-deep">{stock("outOfStock")}</p>
          )}
          <AddToOrder
            productId={product.id}
            inStock={product.inStock}
            stockQty={product.stockQty}
            ownerId={ownerId}
            accountUnavailable={session.state === "unavailable"}
          />
        </div>
      </div>
    </PageContainer>
  );
}
