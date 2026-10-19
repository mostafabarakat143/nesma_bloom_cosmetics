import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("product");
  return { title: t("notFoundTitle") };
}

export default async function ProductNotFound() {
  const t = await getTranslations("product");

  return (
    <PageContainer>
      <section className="max-w-xl">
        <h1 className="font-display text-5xl text-ink">{t("notFoundTitle")}</h1>
        <p className="mt-4 text-lg text-muted">{t("notFoundBody")}</p>
        <div className="mt-8">
          <Button href="/shop">{t("backToShop")}</Button>
        </div>
      </section>
    </PageContainer>
  );
}
