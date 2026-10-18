import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AddToOrder } from "@/components/catalog/add-to-order";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { getCatalogProduct } from "@/lib/api/catalog";
import { getVerifiedUser } from "@/lib/auth/session";
import { formatMinorPrice } from "@/lib/money";
import { parsePositiveId } from "@/lib/shop-query";

type ProductPageProps = {
  params: Promise<{ id: string }>;
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
  const nav = await getTranslations("common");

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
      <Breadcrumbs
        items={[
          { label: nav("home"), href: "/" },
          { label: nav("shop"), href: "/shop" },
          {
            label: product.category.name,
            href: `/shop?categoryId=${product.category.id}`,
          },
          {
            label: product.subcategory.name,
            href: `/shop?categoryId=${product.category.id}&subcategoryId=${product.subcategory.id}`,
          },
          { label: product.name, current: true },
        ]}
      />
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-2">
        <ProductGallery
          key={product.id}
          images={product.images}
          name={product.name}
        />
        <div className="min-w-0">
          <p className="text-sm break-words text-muted">
            {product.category.name}
            <span aria-hidden="true"> / </span>
            {product.subcategory.name}
          </p>
          <h1 className="mt-2 font-display text-5xl leading-tight break-words text-ink">
            {product.name}
          </h1>
          {product.description ? (
            <p className="mt-6 leading-relaxed break-words whitespace-pre-line text-muted">
              {product.description}
            </p>
          ) : null}
          <p className="mt-6 text-lg text-ink">
            {formatMinorPrice(product.priceMinor, product.currency)}
          </p>
          <p
            className={`mt-2 text-sm ${product.inStock ? "text-ink" : "text-rose-deep"}`}
          >
            {product.inStock ? stock("inStock") : stock("outOfStock")}
          </p>
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
