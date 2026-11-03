import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { redirectTo } from "@/i18n/redirect";

import { PageContainer } from "@/components/layout/page-container";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";
import { safeNextPath } from "@/features/auth/lib/session";
import { getVerifiedUser } from "@/features/auth/services/session.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("registerTitle") };
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const t = await getTranslations("auth");
  const session = await getVerifiedUser();
  if (session.state === "authenticated") {
    await redirectTo(nextPath);
  }

  return (
    <PageContainer>
      <AuthShell
        eyebrow={t("account")}
        title={t("registerTitle")}
        description={t("registerDescription")}
      >
        <RegisterForm nextPath={nextPath} />
      </AuthShell>
    </PageContainer>
  );
}
