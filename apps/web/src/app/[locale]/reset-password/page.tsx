import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { ResetTokenCapture } from "@/components/auth/reset-token";
import { PageContainer } from "@/components/layout/page-container";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("resetTitle"), referrer: "no-referrer" };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <PageContainer>
      <AuthShell eyebrow={t("account")} title={t("resetTitle")} description={t("resetDescription")}>
        <Suspense
          fallback={
            <p className="text-sm text-muted" role="status">
              {t("loadingReset")}
            </p>
          }
        >
          <ResetTokenCapture>
            <ResetPasswordForm />
          </ResetTokenCapture>
        </Suspense>
      </AuthShell>
    </PageContainer>
  );
}
