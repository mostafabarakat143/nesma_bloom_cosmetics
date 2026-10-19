import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { redirectTo } from "@/i18n/redirect";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { PageContainer } from "@/components/layout/page-container";
import { safeNextPath } from "@/lib/auth/redirect";
import { getVerifiedUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("registerTitle") };
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
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
