"use client";

import { useTranslations } from "next-intl";

import { ErrorState, type PageErrorProps } from "@/components/ui/error-state";

export default function Error({ reset }: PageErrorProps) {
  const t = useTranslations("errors");

  return (
    <ErrorState title={t("wrongTitle")} message={t("wrongBody")}
      retryLabel={t("tryAgain")} onRetry={reset} />
  );
}
