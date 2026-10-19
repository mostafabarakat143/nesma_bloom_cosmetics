import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/layout/page-container";

export default async function Loading() {
  const t = await getTranslations("home");

  return (
    <PageContainer>
      <p className="text-muted" role="status">
        {t("loading")}
      </p>
    </PageContainer>
  );
}
