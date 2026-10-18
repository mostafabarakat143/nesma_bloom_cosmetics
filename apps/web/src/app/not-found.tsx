import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <PageContainer>
      <section className="max-w-xl">
        <h1 className="font-display text-5xl text-ink">{t("notFoundTitle")}</h1>
        <p className="mt-4 text-lg text-muted">{t("notFoundBody")}</p>
        <div className="mt-8">
          <Button href="/">{t("backHome")}</Button>
        </div>
      </section>
    </PageContainer>
  );
}
