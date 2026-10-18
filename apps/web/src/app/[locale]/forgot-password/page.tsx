import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PageContainer } from "@/components/layout/page-container";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("forgotTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <PageContainer>
      <AuthShell
        eyebrow={t("account")}
        title={t("forgotTitle")}
        description={t("forgotDescription")}
      >
        <ForgotPasswordForm />
      </AuthShell>
    </PageContainer>
  );
}
