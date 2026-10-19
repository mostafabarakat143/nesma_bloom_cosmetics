"use client";

import { useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  return (
    <PageContainer>
      <section className="max-w-xl">
        <h1 className="font-display text-5xl text-ink">{t("wrongTitle")}</h1>
        <p className="mt-4 text-lg text-muted">{t("wrongBody")}</p>
        <div className="mt-8">
          <Button type="button" onClick={() => reset()}>
            {t("tryAgain")}
          </Button>
        </div>
      </section>
    </PageContainer>
  );
}
