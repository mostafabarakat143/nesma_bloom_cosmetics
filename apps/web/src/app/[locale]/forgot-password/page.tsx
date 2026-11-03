import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageContainer } from "@/components/layout/page-container";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

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
